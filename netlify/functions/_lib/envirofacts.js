// netlify/functions/_lib/envirofacts.js
// ----------------------------------------------------------------------------
// Minimal live client for EPA's Envirofacts SDWIS service, used as a fallback
// when data/water/ has not been ingested yet.
//
// SCOPE IS DELIBERATELY NARROW. This fetches only inventory metadata (system
// names, types, population, service areas) and violations (categorical). It
// does NOT fetch or interpret sample results.
//
// That boundary is the whole point. Sample results require unit conversion,
// analyte-name resolution, and non-detect handling — the exact logic that
// `water-quality/fwq/` implements carefully and covers with ~180 tests. A
// second implementation of it here would drift from the first, and the drift
// would land in the safety-critical direction: a mis-converted PFAS value or a
// non-detect read as a measurement. So lab results only ever come from the
// ingested dataset, and the live path says so rather than guessing.
//
// URL shape (1-indexed, inclusive paging, 404 for an empty result set):
//   {base}/{program}.{table}/{col}/{op}/{value}/.../{first}:{last}/JSON
// ----------------------------------------------------------------------------

const BASE_URL = process.env.EPA_BASE_URL || 'https://data.epa.gov/efservice';

// Envirofacts is occasionally slow. A serverless function has a hard ceiling of
// its own, so fail fast and let the caller degrade rather than time out.
const TIMEOUT_MS = 7000;
const MAX_ROWS = 500;

/** Envirofacts chokes on raw spaces and slashes inside path segments. */
function encodeValue(value) {
  return String(value).replace(/ /g, '%20').replace(/\//g, '%2F');
}

function buildUrl(table, filters = [], rows = [1, MAX_ROWS]) {
  const qualified = table.includes('.') ? table : `sdwis.${table}`;
  const parts = [BASE_URL, qualified];
  for (const [col, op, val] of filters) parts.push(col, op, encodeValue(val));
  parts.push(`${rows[0]}:${rows[1]}`, 'JSON');
  return parts.join('/');
}

/** Column casing flips between Envirofacts releases. Pin it to lowercase. */
function lowerKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) out[String(k).toLowerCase()] = v;
  return out;
}

class EnvirofactsUnavailable extends Error {}

async function getRows(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new EnvirofactsUnavailable(`${url}: ${err.message}`);
  }
  // Envirofacts answers 404 for an empty result set rather than [].
  if (res.status === 404) return [];
  if (!res.ok) throw new EnvirofactsUnavailable(`${url}: HTTP ${res.status}`);
  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new EnvirofactsUnavailable(`${url}: invalid JSON`);
  }
  return Array.isArray(body) ? body.map(lowerKeys) : [];
}

// --- field mapping ----------------------------------------------------------
// Mirrors fwq/normalize.py so a live record is shaped identically to an
// ingested one. The renderers and the ranker must not be able to tell them
// apart, apart from the provenance block.

const SYSTEM_TYPES = {
  CWS: 'community',
  NTNCWS: 'non-transient non-community',
  TNCWS: 'transient non-community',
};

const SOURCE_CODES = {
  GW: 'groundwater',
  SW: 'surface water',
  GU: 'groundwater under direct influence of surface water',
  GWP: 'purchased groundwater',
  SWP: 'purchased surface water',
  GUP: 'purchased groundwater under surface influence',
};

function toInt(value) {
  const n = parseInt(String(value ?? '').replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

/** SDWIS stores place names in caps. Title-case them. */
function titleize(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w.length <= 3 && w === w.toUpperCase() && w.endsWith('.')
      ? w
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function mapSystem(row, geoRows = []) {
  const pwsid = String(row.pwsid || '').toUpperCase();
  const mine = geoRows.filter((g) => String(g.pwsid || '').toUpperCase() === pwsid);
  const counties = new Set();
  const cities = new Set();
  const zips = new Set();
  for (const g of mine) {
    if (g.county_served) counties.add(titleize(g.county_served));
    if (g.city_served) cities.add(titleize(g.city_served));
    const z = String(g.zip_code_served || '').replace(/\D/g, '').slice(0, 5);
    if (z.length === 5) zips.add(z);
  }
  const activity = String(row.pws_activity_code || '').toUpperCase();
  return {
    pwsid,
    name: row.pws_name || pwsid,
    systemType: SYSTEM_TYPES[String(row.pws_type_code || '').toUpperCase()]
      || row.pws_type_code || null,
    ownerType: row.owner_type_code || null,
    primarySource: SOURCE_CODES[String(row.primary_source_code || '').toUpperCase()]
      || row.primary_source_code || null,
    populationServed: toInt(row.population_served_count),
    serviceConnections: toInt(row.service_connections_count),
    isActive: activity ? activity === 'A' : null,
    serviceArea: {
      counties: [...counties].sort(),
      cities: [...cities].sort(),
      zips: [...zips].sort(),
    },
    phone: row.phone_number || null,
    provenance: {
      source: 'epa-sdwis',
      retrievedAt: new Date().toISOString(),
      sourceUrl: `${BASE_URL}/sdwis.water_system`,
      sourceRowId: pwsid,
      note: 'Fetched live from EPA at request time, not from the ingested dataset.',
    },
  };
}

const HEALTH_BASED_CATEGORIES = new Set(['MCL', 'MRDL', 'TT']);

function parseDate(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

function mapViolation(row) {
  const category = String(row.violation_category_code || '').toUpperCase() || 'OTHER';
  const rtc = parseDate(row.calculated_rtc_date || row.rtc_date);
  const status = String(row.violation_status || '').toLowerCase();
  let resolved = null;
  if (rtc) resolved = true;
  else if (['resolved', 'archived', 'returned to compliance'].includes(status)) resolved = true;
  else if (['unaddressed', 'addressed', 'open'].includes(status)) resolved = false;

  const healthFlag = String(row.is_health_based_ind || '').toUpperCase();
  return {
    pwsid: String(row.pwsid || '').toUpperCase(),
    violationId: String(row.violation_id || ''),
    category,
    typeLabel: row.violation_code || null,
    // Contaminant names need the SDWIS code reference table, which the ingest
    // learns. Live, we surface the raw code rather than inventing a name.
    analyteId: null,
    analyteName: row.contaminant_code ? `SDWIS contaminant ${row.contaminant_code}` : null,
    isHealthBased: healthFlag ? healthFlag === 'Y' : HEALTH_BASED_CATEGORIES.has(category),
    beginDate: parseDate(row.compl_per_begin_date || row.non_compl_per_begin_date),
    endDate: parseDate(row.compl_per_end_date || row.non_compl_per_end_date),
    resolved,
    complianceStatus: row.violation_status || null,
    provenance: {
      source: 'epa-sdwis',
      retrievedAt: new Date().toISOString(),
      sourceUrl: `${BASE_URL}/sdwis.violation`,
      sourceRowId: String(row.violation_id || ''),
      note: 'Fetched live from EPA at request time, not from the ingested dataset.',
    },
  };
}

// --- public queries ---------------------------------------------------------

/** Systems reporting service to a ZIP, with their service areas attached. */
async function systemsForZip(zip, state = 'FL') {
  const geo = await getRows(buildUrl('geographic_area', [
    ['zip_code_served', 'equals', zip],
    ['state_served', 'equals', state],
  ]));
  const pwsids = [...new Set(geo.map((g) => String(g.pwsid || '').toUpperCase()).filter(Boolean))];
  if (pwsids.length === 0) return { systems: [], geo: [] };

  // One `in` filter keeps this to a single round trip. PWSIDs are 9 chars, so
  // even a dozen stays well inside a sane URL length.
  const rows = await getRows(buildUrl('water_system', [
    ['pwsid', 'in', pwsids.slice(0, 40).join(',')],
  ]));
  // Service areas for these systems beyond this one ZIP, so the ranker can see
  // how many ZIPs each serves — that is one of its signals.
  const fullGeo = await getRows(buildUrl('geographic_area', [
    ['pwsid', 'in', pwsids.slice(0, 40).join(',')],
  ])).catch(() => geo);

  return { systems: rows.map((r) => mapSystem(r, fullGeo)), geo: fullGeo };
}

async function systemById(pwsid) {
  const rows = await getRows(buildUrl('water_system', [['pwsid', 'equals', pwsid]]));
  if (rows.length === 0) return null;
  const geo = await getRows(buildUrl('geographic_area', [['pwsid', 'equals', pwsid]]))
    .catch(() => []);
  return mapSystem(rows[0], geo);
}

async function violationsFor(pwsid) {
  const rows = await getRows(buildUrl('violation', [['pwsid', 'equals', pwsid]]));
  return rows.map(mapViolation);
}

module.exports = {
  BASE_URL,
  EnvirofactsUnavailable,
  buildUrl,
  systemsForZip,
  systemById,
  violationsFor,
  _internals: { mapSystem, mapViolation, titleize, parseDate, lowerKeys },
};
