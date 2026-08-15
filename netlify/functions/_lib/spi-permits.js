// Municipal permit match from full city permitsByParcel caches.
const { loadJson } = require('./spi-load');

const PLUMBING_RE =
  /plumb|water\s*heater|repipe|sewer|backflow|drain|potable|irrigation|water\s*line|gas\s*line|fixture|wh\b/i;

function normalizeId(s) {
  return String(s || '').replace(/[-\s]/g, '').toUpperCase();
}

function isPlumbing(row) {
  const blob = [row.type, row.subtype, row.description].filter(Boolean).join(' ');
  return PLUMBING_RE.test(blob);
}

function activeCities(index) {
  return (index.coverage || []).filter(
    (c) => c.status === 'active' && c.dataFile && !/sample|illustrative/i.test(c.scope || '')
  );
}

function flattenParcelMap(permitsByParcel) {
  const out = [];
  if (!permitsByParcel || typeof permitsByParcel !== 'object') return out;
  for (const [parcelId, rows] of Object.entries(permitsByParcel)) {
    const list = Array.isArray(rows) ? rows : [rows];
    for (const row of list) {
      out.push({ ...row, parcelId: row.parcelId || parcelId });
    }
  }
  return out;
}

function matchRows(rows, { pcn, address }) {
  const np = normalizeId(pcn);
  const street = String(address || '')
    .toUpperCase()
    .split(',')[0]
    .trim();
  const hits = [];
  for (const row of rows) {
    const rpcn = normalizeId(row.parcelId);
    const rad = String(row.address || '').toUpperCase();
    if (np && rpcn && (rpcn === np || rpcn.includes(np) || np.includes(rpcn))) {
      hits.push(row);
      continue;
    }
    if (street.length > 8 && rad.includes(street.slice(0, 12))) hits.push(row);
  }
  return hits;
}

function summarizePermit(row) {
  return {
    permitNumber: row.permitNumber || null,
    parcelId: row.parcelId || null,
    address: row.address || null,
    type: row.type || null,
    subtype: row.subtype || null,
    description: row.description || null,
    status: row.status || null,
    appliedDate: row.appliedDate || null,
    issuedDate: row.issuedDate || null,
    finalDate: row.finalDate || null,
    url: row.url || null,
    plumbing: isPlumbing(row),
  };
}

/**
 * @returns {{ permits: group, equipmentAge: group }}
 */
async function assemblePermits({
  pcn,
  address,
  loadJsonFn = loadJson,
} = {}) {
  const permitsGroup = {
    status: 'unavailable',
    source: 'data/permits/',
    data: null,
  };
  const equipmentAge = {
    status: 'unavailable',
    source: 'permits+yearBuilt',
    data: null,
  };

  let index;
  try {
    index = await loadJsonFn('data/permits/index.json');
  } catch (err) {
    permitsGroup.message = err.message || String(err);
    return { permits: permitsGroup, equipmentAge };
  }

  const cities = activeCities(index);
  if (!cities.length) {
    permitsGroup.message = 'No active municipal permit caches configured.';
    return { permits: permitsGroup, equipmentAge };
  }

  const allHits = [];
  const sources = [];
  const windows = [];

  for (const city of cities) {
    let file;
    try {
      file = await loadJsonFn(city.dataFile);
    } catch (err) {
      // Continue other cities; note failure
      sources.push({ slug: city.slug, error: err.message || String(err) });
      continue;
    }
    const rows = flattenParcelMap(file.permitsByParcel || {});
    const hits = matchRows(rows, { pcn, address });
    for (const h of hits) allHits.push({ ...h, _city: city.slug });
    sources.push({
      slug: city.slug,
      status: city.status,
      scope: city.scope || null,
      permitCount: city.permitCount || file.permitCount || null,
      lastUpdated: city.lastUpdated || file.generated || null,
    });
    windows.push({
      slug: city.slug,
      note: city.scope || 'Active municipal cache (typically ~90-day EnerGov window)',
    });
  }

  if (!sources.some((s) => !s.error)) {
    permitsGroup.message = 'Could not load any active municipal permit files.';
    return { permits: permitsGroup, equipmentAge };
  }

  const summarized = allHits.map(summarizePermit);
  const plumbing = summarized.filter((r) => r.plumbing);
  const other = summarized.filter((r) => !r.plumbing);

  permitsGroup.status = 'cached';
  permitsGroup.source = sources.map((s) => s.slug).join(', ');
  permitsGroup.data = {
    coverageWindow: windows,
    plumbing: plumbing.slice(0, 25),
    other: other.slice(0, 15),
    matchCount: summarized.length,
    citiesLoaded: sources,
  };

  if (!summarized.length) {
    permitsGroup.message =
      'No permits matched in active Cached municipal files (coverage is typically a rolling ~90-day window — absence here is not proof of no historical work).';
  }

  // Equipment age hints from last plumbing permit dates
  const dates = plumbing
    .map((p) => p.finalDate || p.issuedDate || p.appliedDate)
    .filter(Boolean)
    .sort()
    .reverse();
  if (dates.length) {
    equipmentAge.status = 'cached';
    equipmentAge.source = 'plumbing permits (cached municipal)';
    equipmentAge.data = {
      lastPlumbingWorkDate: dates[0],
      recentPlumbingPermitCount: plumbing.length,
      note: 'Inferred from Cached permit dates within the municipal scrape window only.',
    };
  } else {
    equipmentAge.status = 'unavailable';
    equipmentAge.message =
      'No plumbing permits matched in the active ~90-day municipal caches; cannot infer equipment age from permits.';
  }

  return { permits: permitsGroup, equipmentAge };
}

function enrichEquipmentWithYearBuilt(equipmentAge, yearBuilt) {
  const yb = Number(yearBuilt);
  if (!Number.isFinite(yb) || yb < 1800) return equipmentAge;
  const ageYears = new Date().getFullYear() - yb;
  const next = { ...equipmentAge, data: { ...(equipmentAge.data || {}) } };
  next.data.propertyYearBuilt = yb;
  next.data.propertyAgeYears = ageYears;
  if (next.status === 'unavailable') {
    next.status = 'live';
    next.source = 'parcel yearBuilt';
    next.message =
      'No recent Cached plumbing permits; property age from PA GIS year built only (not a replacement schedule).';
  }
  return next;
}

module.exports = {
  assemblePermits,
  enrichEquipmentWithYearBuilt,
  isPlumbing,
  flattenParcelMap,
  matchRows,
  activeCities,
  PLUMBING_RE,
};
