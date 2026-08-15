// Port of Property Intelligence parcel lookup for Netlify (CommonJS).
const { loadJson } = require('./spi-load');

function pick(attrs, keys) {
  if (!attrs || !keys) return null;
  const list = Array.isArray(keys) ? keys : [keys];
  for (let i = 0; i < list.length; i++) {
    const k = list[i];
    if (attrs[k] != null && String(attrs[k]).trim() !== '') {
      return typeof attrs[k] === 'string' ? String(attrs[k]).trim() : attrs[k];
    }
    const lower = String(k).toLowerCase();
    for (const ak in attrs) {
      if (
        ak.toLowerCase() === lower &&
        attrs[ak] != null &&
        String(attrs[ak]).trim() !== ''
      ) {
        return typeof attrs[ak] === 'string' ? String(attrs[ak]).trim() : attrs[ak];
      }
    }
  }
  return null;
}

function buildAddress(attrs, map) {
  const parts = (map.address || []).map((k) => pick(attrs, [k])).filter(Boolean);
  if (parts.length) return parts.join(' ').replace(/\s+/g, ' ').trim();
  return (
    pick(attrs, ['SITE_ADDR', 'SITEADDR', 'SITUS', 'ADDRESS', 'PROP_ADDR', 'FULL_ADDRESS']) ||
    null
  );
}

function centroid(geom) {
  if (!geom) return null;
  if (geom.x != null && geom.y != null) return { lon: geom.x, lat: geom.y };
  const rings = geom.rings || (geom.points && [geom.points]);
  if (!rings || !rings[0] || !rings[0].length) return null;
  let sx = 0;
  let sy = 0;
  const ring = rings[0];
  for (let i = 0; i < ring.length; i++) {
    sx += ring[i][0];
    sy += ring[i][1];
  }
  return { lon: sx / ring.length, lat: sy / ring.length };
}

async function arcgisQuery(endpoint, params, timeoutMs = 20000) {
  const q = new URLSearchParams(params);
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer = null;
  try {
    if (ctrl) timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${endpoint}?${q.toString()}`, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'ArcGIS error');
    return data;
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('GIS request timed out');
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @returns {{ status, source, data?, candidates?, message? }}
 */
async function assembleParcel({ address, countySlug = 'palm-beach', loadJsonFn = loadJson, fetchFn } = {}) {
  const group = {
    status: 'unavailable',
    source: 'data/parcels/registry.json',
    data: null,
  };
  const q = String(address || '').trim();
  if (!q) {
    group.message = 'Address is required.';
    return group;
  }

  let registry;
  try {
    registry = await loadJsonFn('data/parcels/registry.json');
  } catch (err) {
    group.message = `Could not load parcel registry: ${err.message || err}`;
    return group;
  }

  const county = registry.counties && registry.counties[countySlug];
  if (!county || (county.status !== 'live' && county.status !== 'cached')) {
    group.status = 'coming-soon';
    group.message = `County GIS is not wired for ${countySlug}.`;
    return group;
  }

  const map = county.map || {};
  const addrField = (map.address && map.address[0]) || 'SITE_ADDR_STR';
  let where = `UPPER(${addrField}) LIKE '%${q.toUpperCase().replace(/'/g, "''")}%'`;
  if (county.extraWhere) where = `(${where}) AND (${county.extraWhere})`;

  const queryParams = {
    where,
    outFields: (county.outFields || ['*']).join(','),
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
  };
  if (county.supportsPagination !== false) queryParams.resultRecordCount = '8';

  const queryImpl = fetchFn || arcgisQuery;
  let data;
  try {
    data = await queryImpl(county.endpoint, queryParams);
  } catch (err) {
    group.message = err.message || String(err);
    return group;
  }

  const features = data.features || [];
  const parcels = features.map((f) => {
    const a = f.attributes || {};
    return {
      countySlug,
      countyName: county.name,
      paUrl: county.paUrl,
      dataStatus: county.status || 'live',
      pcn: pick(a, map.pcn || county.idFields || []),
      owner: [pick(a, map.owner || []), pick(a, ['OWNER_NAME2'])].filter(Boolean).join(' '),
      address: buildAddress(a, map),
      market: pick(a, map.market || []),
      assessed: pick(a, map.assessed || []),
      yearBuilt: pick(a, map.yearBuilt || ['YRBLT', 'YEAR_BUILT']),
      buildingType: pick(a, map.buildingType || map.landUse || []) || null,
      legal: pick(a, ['LEGAL1', 'LEGAL']),
      centroid: centroid(f.geometry),
    };
  });

  group.status = county.status === 'cached' ? 'cached' : 'live';
  group.source = county.endpoint;

  if (!parcels.length) {
    group.message = 'No parcels matched this address.';
    group.data = { parcels: [] };
    return group;
  }

  if (parcels.length > 1) {
    group.candidates = parcels.map((p) => ({
      pcn: p.pcn,
      address: p.address,
      owner: p.owner,
      yearBuilt: p.yearBuilt,
    }));
    group.message = 'Multiple parcels matched; provide a more specific address or pick a candidate.';
    group.data = { parcels };
    return group;
  }

  const p = parcels[0];
  group.data = {
    pcn: p.pcn,
    address: p.address,
    owner: p.owner,
    yearBuilt: p.yearBuilt,
    market: p.market,
    assessed: p.assessed,
    legal: p.legal,
    centroid: p.centroid,
    countySlug: p.countySlug,
    countyName: p.countyName,
    paUrl: p.paUrl,
  };
  return group;
}

/**
 * Building-type group: Coming Soon unless parcel exposes a sourced field.
 */
function assembleBuilding(parcelGroup) {
  const p = parcelGroup && parcelGroup.data;
  if (!p || parcelGroup.candidates) {
    return {
      status: 'unavailable',
      source: 'parcel',
      data: null,
      message: 'Need a single resolved parcel first.',
    };
  }
  const sourced = p.buildingType;
  // Re-read from raw not available here — yearBuilt is on parcel; building type only if set
  if (sourced) {
    return {
      status: parcelGroup.status,
      source: parcelGroup.source,
      data: { buildingType: sourced, yearBuilt: p.yearBuilt || null },
    };
  }
  return {
    status: 'coming-soon',
    source: 'parcel-gis',
    data: { yearBuilt: p.yearBuilt || null, buildingType: null },
    message: 'Building type is not exposed on this county PA GIS map yet.',
  };
}

module.exports = {
  pick,
  assembleParcel,
  assembleBuilding,
  arcgisQuery,
};
