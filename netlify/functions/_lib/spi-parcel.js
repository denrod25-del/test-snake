// Port of Property Intelligence parcel lookup for Netlify (CommonJS).
const { loadJson } = require('./spi-load');

const STREET_EXPAND = {
  ST: 'STREET',
  STREET: 'ST',
  AVE: 'AVENUE',
  AVENUE: 'AVE',
  BLVD: 'BOULEVARD',
  BOULEVARD: 'BLVD',
  DR: 'DRIVE',
  DRIVE: 'DR',
  RD: 'ROAD',
  ROAD: 'RD',
  LN: 'LANE',
  LANE: 'LN',
  CT: 'COURT',
  COURT: 'CT',
  CIR: 'CIRCLE',
  CIRCLE: 'CIR',
  PL: 'PLACE',
  PLACE: 'PL',
  TER: 'TERRACE',
  TERRACE: 'TER',
  HWY: 'HIGHWAY',
  HIGHWAY: 'HWY',
  PKWY: 'PARKWAY',
  PARKWAY: 'PKWY',
};

const CITY_TRAILING_RE =
  /\s+(WEST\s+PALM\s+BEACH|BOCA\s+RATON|JUPITER|PALM\s+BEACH\s+GARDENS|ROYAL\s+PALM\s+BEACH|BOYNTON\s+BEACH|DELRAY\s+BEACH|LAKE\s+WORTH(?:\s+BEACH)?|GREENACRES|RIVIERA\s+BEACH|PALM\s+BEACH|LAKE\s+PARK|MANGONIA\s+PARK|NORTH\s+PALM\s+BEACH|SOUTH\s+PALM\s+BEACH|HYPOLUXO|LANTANA|MANALAPAN|GULF\s+STREAM|OCEAN\s+RIDGE|BRINY\s+BREEZES|CLOUD\s+LAKE|GLEN\s+RIDGE|HAVERHILL|ATLANTA)\s*$/i;

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

/**
 * Strip city/state/zip/unit so ArcGIS SITE_ADDR_STR LIKE matches work.
 */
function stripUnitAndCity(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.split(',')[0].trim();
  s = s.replace(/\s+(FL|FLORIDA)\s+\d{5}(-\d{4})?\s*$/i, '');
  s = s.replace(/\s+\d{5}(-\d{4})?\s*$/, '');
  s = s.replace(CITY_TRAILING_RE, '');
  s = s.replace(/\s+(APT|APARTMENT|UNIT|STE|SUITE|#)\s*\.?\s*[A-Z0-9-]+$/i, '');
  return s.replace(/\s+/g, ' ').trim();
}

function expandStreetSuffix(upperStreet) {
  const parts = upperStreet.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1].replace(/\./g, '');
  const alt = STREET_EXPAND[last];
  if (!alt) return null;
  return parts.slice(0, -1).concat(alt).join(' ');
}

/**
 * Ordered address fragments to try against ArcGIS LIKE.
 * Shorter street-only forms first (better SITE_ADDR_STR hit rate).
 */
function addressQueryVariants(raw) {
  const base = stripUnitAndCity(raw);
  if (!base) return [];
  const upper = base.toUpperCase().replace(/\./g, '');
  const variants = [];
  const seen = new Set();
  function add(v) {
    const t = String(v || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    variants.push(t);
  }
  add(upper);
  const expanded = expandStreetSuffix(upper);
  if (expanded) add(expanded);
  // Prefer shorter first for LIKE '%…%'
  variants.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return variants;
}

function normalizeStreetKey(addr) {
  let s = stripUnitAndCity(addr).toUpperCase().replace(/\./g, '');
  s = s.replace(/\s+/g, ' ').trim();
  const parts = s.split(' ');
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const canon = STREET_EXPAND[last];
    // Collapse ST/STREET etc. to the short form when both exist
    if (canon && canon.length < last.length) {
      parts[parts.length - 1] = canon;
    } else if (STREET_EXPAND[last] && last.length > 2) {
      // long form → short if mapped to short
      const short = Object.keys(STREET_EXPAND).find(
        (k) => STREET_EXPAND[k] === last && k.length <= 4
      );
      if (short) parts[parts.length - 1] = short;
    }
  }
  return parts.join(' ');
}

function escapeSqlLiteral(s) {
  return String(s).replace(/'/g, "''");
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

function mapFeature(f, countySlug, county, map) {
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
}

function flatParcel(p) {
  return {
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
    buildingType: p.buildingType || null,
  };
}

/**
 * When ArcGIS returns multiple rows, pick a primary if unambiguous.
 * @returns {{ primary, reason } | null}
 */
function pickPrimaryParcel(parcels, queryStreet) {
  if (!parcels || parcels.length <= 1) {
    return parcels && parcels[0] ? { primary: parcels[0], reason: 'single' } : null;
  }

  const qKey = normalizeStreetKey(queryStreet || '');
  const exact = parcels.filter((p) => {
    const key = normalizeStreetKey(p.address || '');
    return key && qKey && (key === qKey || key.startsWith(qKey) || qKey.startsWith(key));
  });
  const pool = exact.length ? exact : parcels;

  // Same normalized site address → pick best row (prefer PCN)
  const byAddr = new Map();
  for (const p of pool) {
    const key = normalizeStreetKey(p.address || '') || String(p.pcn || '') || JSON.stringify(p.centroid);
    if (!byAddr.has(key)) byAddr.set(key, []);
    byAddr.get(key).push(p);
  }
  if (byAddr.size === 1) {
    const rows = [...byAddr.values()][0];
    const withPcn = rows.find((r) => r.pcn);
    return {
      primary: withPcn || rows[0],
      reason: 'same_site_address',
    };
  }

  // One exact street match among many broader LIKE hits
  if (exact.length === 1) {
    return { primary: exact[0], reason: 'exact_street' };
  }

  // Unique PCN among the pool
  const pcns = new Set(pool.map((p) => p.pcn).filter(Boolean));
  if (pcns.size === 1) {
    const pcn = [...pcns][0];
    return {
      primary: pool.find((p) => p.pcn === pcn) || pool[0],
      reason: 'same_pcn',
    };
  }

  return null;
}

/**
 * @returns {{ status, source, data?, candidates?, message?, autoPicked?, queryTried? }}
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
  const variants = addressQueryVariants(q);
  if (!variants.length) {
    group.message = 'Address is required.';
    return group;
  }

  const queryImpl = fetchFn || arcgisQuery;
  let parcels = [];
  const queryTried = [];

  for (const variant of variants) {
    let where = `UPPER(${addrField}) LIKE '%${escapeSqlLiteral(variant)}%'`;
    if (county.extraWhere) where = `(${where}) AND (${county.extraWhere})`;

    const queryParams = {
      where,
      outFields: (county.outFields || ['*']).join(','),
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    };
    if (county.supportsPagination !== false) queryParams.resultRecordCount = '8';

    let data;
    try {
      data = await queryImpl(county.endpoint, queryParams);
    } catch (err) {
      group.message = err.message || String(err);
      return group;
    }

    const features = data.features || [];
    queryTried.push({ variant, hitCount: features.length });
    if (!features.length) continue;

    parcels = features.map((f) => mapFeature(f, countySlug, county, map));
    break;
  }

  group.status = county.status === 'cached' ? 'cached' : 'live';
  group.source = county.endpoint;
  group.queryTried = queryTried;

  if (!parcels.length) {
    group.message = 'No parcels matched this address.';
    group.data = { parcels: [] };
    return group;
  }

  if (parcels.length === 1) {
    group.data = flatParcel(parcels[0]);
    return group;
  }

  const picked = pickPrimaryParcel(parcels, variants[0] || q);
  group.candidates = parcels.map((p) => ({
    pcn: p.pcn,
    address: p.address,
    owner: p.owner,
    yearBuilt: p.yearBuilt,
  }));

  if (picked) {
    group.data = flatParcel(picked.primary);
    group.autoPicked = true;
    group.autoPickReason = picked.reason;
    group.message =
      'Multiple GIS rows matched; auto-selected a primary parcel. Candidates listed for confirmation.';
    return group;
  }

  group.message = 'Multiple parcels matched; provide a more specific address or pick a candidate.';
  group.data = { parcels };
  return group;
}

/**
 * Building-type group: Coming Soon unless parcel exposes a sourced field.
 */
function assembleBuilding(parcelGroup) {
  const p = parcelGroup && parcelGroup.data;
  if (!p || Array.isArray(p.parcels)) {
    return {
      status: 'unavailable',
      source: 'parcel',
      data: null,
      message: 'Need a single resolved parcel first.',
    };
  }
  const sourced = p.buildingType;
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

function resolvedPrimary(parcelGroup) {
  const p = parcelGroup && parcelGroup.data;
  if (!p || Array.isArray(p.parcels)) return null;
  return p;
}

module.exports = {
  pick,
  assembleParcel,
  assembleBuilding,
  arcgisQuery,
  stripUnitAndCity,
  addressQueryVariants,
  normalizeStreetKey,
  pickPrimaryParcel,
  resolvedPrimary,
};
