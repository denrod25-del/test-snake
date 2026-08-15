// Flood zone assemble for SPI (port of Property Intelligence lookupFlood).
const { loadJson } = require('./spi-load');
const { pick, arcgisQuery } = require('./spi-parcel');

async function assembleFlood({ lon, lat, countySlug = 'palm-beach', loadJsonFn = loadJson, fetchFn } = {}) {
  const group = {
    status: 'unavailable',
    source: 'data/signals/flood-layers.json',
    data: null,
  };
  if (lon == null || lat == null || !Number.isFinite(Number(lon)) || !Number.isFinite(Number(lat))) {
    group.message = 'Parcel centroid required for flood lookup.';
    return group;
  }

  let floodConfig;
  try {
    floodConfig = await loadJsonFn('data/signals/flood-layers.json');
  } catch (err) {
    group.message = err.message || String(err);
    return group;
  }

  const layers = floodConfig.layers || {};
  let layer = layers[countySlug];
  let usedDefault = false;
  if (!layer || layer.status !== 'live' || !layer.endpoint) {
    layer = floodConfig.defaultLayer || null;
    usedDefault = !!layer;
  }
  if (!layer || layer.status !== 'live' || !layer.endpoint) {
    group.status = 'coming-soon';
    group.message = 'No live flood GIS layer for this county.';
    return group;
  }

  const queryImpl = fetchFn || arcgisQuery;
  let data;
  try {
    data = await queryImpl(layer.endpoint, {
      geometry: `${lon},${lat}`,
      geometryType: 'esriGeometryPoint',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: layer.outFields || '*',
      returnGeometry: 'false',
      f: 'json',
    });
  } catch (err) {
    group.message = err.message || String(err);
    return group;
  }

  const f = (data.features || [])[0];
  const map = layer.map || {};
  group.status = 'live';
  group.source = layer.endpoint + (usedDefault ? ' (FEMA NFHL default)' : '');
  if (!f) {
    group.message = 'No flood polygon intersected this point.';
    group.data = { zone: null };
    return group;
  }
  const a = f.attributes || {};
  group.data = {
    zone: pick(a, map.zone || ['FLD_ZONE', 'FZONE']),
    subtype: pick(a, map.subtype || ['ZONE_SUBTY', 'ZONESUBTY']),
    sfha: pick(a, map.sfha || ['SFHA_TF']),
    bfe: pick(a, map.bfe || ['STATIC_BFE', 'ELEV']),
    depth: pick(a, map.depth || ['DEPTH']),
    firmId: pick(a, map.firmId || ['DFIRM_ID']),
    label: layer.label || null,
  };
  return group;
}

module.exports = { assembleFlood };
