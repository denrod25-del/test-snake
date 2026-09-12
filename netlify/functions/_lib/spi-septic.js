// Septic/sewer + well/municipal assemble for SPI.
//
// Mirrors spi-flood: load the layer registry, pick the county's layers, run an
// ArcGIS point-intersect against the parcel centroid, map the fields.
//
// One thing differs from flood, and it is the whole reason this file is careful:
// an EMPTY result is itself evidence here. If a county's sanitary sewer service
// areas are mapped countywide, a parcel outside all of them is on an onsite
// septic system. That inference is only legal when the registry entry declares
// coverage "countywide" — for a partial layer (one utility, or unincorporated
// only), an empty result means "not mapped here", which is evidence of nothing.
// Lenders and inspectors act on these answers, so unknown is a valid answer and
// must stay cheap to return.

const { loadJson } = require('./spi-load');
const { pick, arcgisQuery } = require('./spi-parcel');

const CONFIDENCE = {
  // Point falls inside an existing service-area polygon.
  INSIDE: 0.85,
  // County's service areas are mapped countywide and the point is outside them all.
  OUTSIDE: 0.7,
  // County GIS is typically accurate to 10-30 m; near an edge we stop trusting it.
  BOUNDARY_PENALTY: 0.15,
};

const BOUNDARY_METERS = 75;

function gradeFor(confidence) {
  if (confidence >= 0.9) return 'verified';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'moderate';
  if (confidence > 0) return 'low';
  return 'unknown';
}

// A polygon marked planned/proposed does not change today's answer — a parcel
// inside a future sewer expansion is still on septic until the line is built.
function classifyServiceStatus(value) {
  const v = String(value == null ? '' : value).toUpperCase().trim();
  if (!v) return 'unknown';
  if (/PLAN|PROPOS|FUTURE|UNDER (DESIGN|CONSTRUCTION)|PHASE ?[2-9]/.test(v)) return 'planned';
  if (/EXIST|ACTIVE|CURRENT|IN.SERVICE|SERVED|COMPLETE/.test(v)) return 'existing';
  return 'unknown';
}

function determination(value, confidence, basis, explanation, source) {
  const c = Math.max(0, Math.min(1, Number(Number(confidence).toFixed(3))));
  return {
    value,
    confidence: c,
    grade: gradeFor(c),
    basis,
    explanation,
    source: source || null,
  };
}

function noData(explanation) {
  return determination('unknown', 0, 'no_data', explanation, null);
}

function pointParams(layer, lon, lat, extra) {
  return Object.assign(
    {
      geometry: `${lon},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: layer.outFields || '*',
      returnGeometry: 'false',
      f: 'json',
    },
    extra || {}
  );
}

// Only asked when the intersect came back empty. Being just inside a service
// area still means service is available, so the risk sits on the other side:
// asserting septic for a house 20 m from the sewer boundary. One extra query,
// and only in the case that needs it.
async function isNearBoundary(layer, lon, lat, queryImpl) {
  try {
    const data = await queryImpl(
      layer.endpoint,
      pointParams(layer, lon, lat, {
        distance: String(BOUNDARY_METERS),
        units: 'esriSRUnit_Meter',
      })
    );
    return (data.features || []).length > 0;
  } catch (err) {
    return false; // a failed proximity probe must not change the answer
  }
}

/**
 * Resolves one axis (wastewater or potable water) against one service-area layer.
 * `insideValue` is what containment proves; `outsideValue` is what being outside
 * a countywide layer implies.
 */
async function assembleAxis({
  layer,
  lon,
  lat,
  queryImpl,
  insideValue,
  outsideValue,
  axisLabel,
  flags,
}) {
  if (!layer || layer.status !== 'live' || !layer.endpoint) {
    return noData(`No live ${axisLabel} service-area layer for this county.`);
  }

  let data;
  try {
    data = await queryImpl(layer.endpoint, pointParams(layer, lon, lat));
  } catch (err) {
    return noData(`${axisLabel} layer query failed: ${err.message || String(err)}`);
  }

  const map = layer.map || {};
  const features = data.features || [];
  const labelled = features.map((f) => {
    const a = f.attributes || {};
    return {
      status: classifyServiceStatus(pick(a, map.status || ['STATUS', 'SERVICE_STATUS', 'PHASE'])),
      name: pick(a, map.name || ['SERVICE_AREA', 'NAME', 'LABEL']),
      provider: pick(a, map.provider || ['UTILITY', 'PROVIDER', 'AGENCY']),
    };
  });

  const source = {
    endpoint: layer.endpoint,
    provider: layer.provider || null,
    label: layer.label || null,
    asOf: layer.dataAsOf || null,
  };

  const existing = labelled.find((f) => f.status !== 'planned');
  if (existing) {
    const where = existing.name || existing.provider || 'a mapped service area';
    return determination(
      insideValue,
      CONFIDENCE.INSIDE,
      'inside_service_area',
      `Inside ${where}.`,
      source
    );
  }

  if (labelled.length > 0 && flags.indexOf('planned_service_expansion') === -1) {
    flags.push('planned_service_expansion');
  }

  // Outside every existing polygon. Only meaningful for a countywide layer.
  if (layer.coverage !== 'countywide') {
    return noData(
      `This ${axisLabel} layer covers only part of the county, so being outside it proves nothing.`
    );
  }

  let confidence = CONFIDENCE.OUTSIDE;
  if (await isNearBoundary(layer, lon, lat, queryImpl)) {
    confidence -= CONFIDENCE.BOUNDARY_PENALTY;
    if (flags.indexOf('near_service_boundary') === -1) flags.push('near_service_boundary');
  }

  return determination(
    outsideValue,
    confidence,
    'outside_service_area',
    `Outside every mapped ${axisLabel} service area in this county.`,
    source
  );
}

async function assembleSeptic({
  lon,
  lat,
  countySlug = 'palm-beach',
  loadJsonFn = loadJson,
  fetchFn,
} = {}) {
  const group = {
    status: 'unavailable',
    source: 'data/signals/septic-layers.json',
    data: null,
  };

  if (lon == null || lat == null || !Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) {
    group.message = 'Parcel centroid required for septic/well lookup.';
    return group;
  }

  let config;
  try {
    config = await loadJsonFn('data/signals/septic-layers.json');
  } catch (err) {
    group.message = err.message || String(err);
    return group;
  }

  const entry = (config.layers || {})[countySlug] || null;
  const sewerLayer = entry && entry.sewer;
  const waterLayer = entry && entry.water;

  const anyLive =
    (sewerLayer && sewerLayer.status === 'live' && sewerLayer.endpoint) ||
    (waterLayer && waterLayer.status === 'live' && waterLayer.endpoint);

  if (!anyLive) {
    group.status = 'coming-soon';
    group.message = 'No live water/sewer service-area layer for this county yet.';
    return group;
  }

  const queryImpl = fetchFn || arcgisQuery;
  const flags = [];

  const [wastewater, waterSource] = await Promise.all([
    assembleAxis({
      layer: sewerLayer,
      lon,
      lat,
      queryImpl,
      insideValue: 'sewer',
      outsideValue: 'septic',
      axisLabel: 'sanitary sewer',
      flags,
    }),
    assembleAxis({
      layer: waterLayer,
      lon,
      lat,
      queryImpl,
      insideValue: 'municipal',
      outsideValue: 'well',
      axisLabel: 'potable water',
      flags,
    }),
  ]);

  group.status = 'live';
  group.data = {
    wastewater,
    waterSource,
    flags,
    verification:
      'County GIS lags physical connections. Confirm with the county health department or the serving utility before relying on this for a transaction, permit, or installation.',
  };
  return group;
}

module.exports = {
  assembleSeptic,
  assembleAxis,
  classifyServiceStatus,
  gradeFor,
  CONFIDENCE,
  BOUNDARY_METERS,
};
