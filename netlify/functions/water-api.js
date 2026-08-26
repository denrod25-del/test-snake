// netlify/functions/water-api.js
// ----------------------------------------------------------------------------
// Florida Water Quality API — read-only public endpoints over the normalized
// dataset that `water-quality/` writes into `data/water/`.
//
// Routed from /api/water/* by netlify.toml. All endpoints are GET, all are
// public (this is public-agency data), and all are CORS-open so third parties
// can consume them.
//
//   GET /api/water/health                     dataset freshness + source status
//   GET /api/water/analytes                   the analyte dictionary and limits
//   GET /api/water/analytes?group=pfas        filtered by group
//   GET /api/water/utilities                  utilities built out end to end
//   GET /api/water/systems?county=Palm Beach  system inventory, filterable
//   GET /api/water/system?pwsid=FL0000000     one system's full profile
//   GET /api/water/lookup?zip=33410[&city=]   ZIP/city -> candidate utilities
//
// Every payload carries a `meta` block with a data-trust status (live/cached/
// blocked/...) and the generation timestamp, matching assets/data-trust.js. A
// caller should never have to guess how fresh an answer is.
//
// The dataset files are committed to the repo and bundled with the function, so
// these endpoints do no upstream I/O and cannot be slowed down or taken offline
// by EPA's servers.
// ----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const { checkRateLimit, rateLimitResponse } = require('./_lib/rate-limit');
const envirofacts = require('./_lib/envirofacts');

// FWQ_DATA_DIR lets the test harness point the function at a fixture dataset
// instead of the committed one. Unset in production.
const DATA_DIR = process.env.FWQ_DATA_DIR
  || path.join(__dirname, '..', '..', 'data', 'water');

// Cache parsed files for the life of the warm container. The dataset only
// changes on deploy, so re-reading per request would be pure waste.
const cache = new Map();

function readDataset(name) {
  if (cache.has(name)) return cache.get(name);
  const file = path.join(DATA_DIR, `${name}.json`);
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`water-api: failed to read ${name}.json`, err.message);
    }
  }
  cache.set(name, parsed);
  return parsed;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(statusCode, body, { maxAge = 300 } = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=86400`,
      ...CORS,
    },
    body: JSON.stringify(body),
  };
}

function fail(statusCode, code, message, extra = {}) {
  return json(statusCode, { error: code, message, ...extra }, { maxAge: 0 });
}

// A request for data we have not ingested yet is not a server error. It gets a
// 503 with the reason and the trust status, so a client can render "coming
// soon" or "source blocked" rather than a generic failure.
function notIngested(dataset) {
  return json(503, {
    error: 'dataset_unavailable',
    message:
      `The "${dataset}" dataset has not been generated yet. It is produced by ` +
      'the scheduled ingest workflow (.github/workflows/ingest-water-quality.yml) ' +
      'or locally via `python -m fwq ingest`.',
    meta: { dataset, status: 'coming-soon' },
  }, { maxAge: 0 });
}

const PWSID_RE = /^[A-Z]{2}\d{7}$/;

function normalizeZip(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 5);
  return digits.length === 5 ? digits : null;
}

function normPlace(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// --- endpoint handlers ------------------------------------------------------

function handleHealth() {
  const index = readDataset('index');
  if (!index) return notIngested('index');
  const probe = readDataset('source-probe');
  return json(200, {
    meta: index.meta,
    counts: index.counts,
    endpoints: index.endpoints,
    sources: index.sources,
    lastSourceProbe: probe ? probe.checkedAt : null,
  }, { maxAge: 60 });
}

function handleAnalytes(params) {
  const dataset = readDataset('analytes');
  if (!dataset) return notIngested('analytes');

  let analytes = dataset.analytes;
  const group = params.get('group');
  if (group) {
    analytes = analytes.filter((a) => a.group === group.toLowerCase());
  }
  const id = params.get('id');
  if (id) {
    analytes = analytes.filter((a) => a.id === id.toLowerCase());
    if (analytes.length === 0) {
      return fail(404, 'analyte_not_found', `No analyte with id "${id}".`);
    }
  }
  return json(200, {
    meta: dataset.meta,
    version: dataset.version,
    limitReview: dataset.limitReview,
    hazardIndex: dataset.hazardIndex,
    count: analytes.length,
    analytes,
  }, { maxAge: 3600 });
}

function handleUtilities() {
  const dataset = readDataset('utilities');
  if (!dataset) return notIngested('utilities');
  return json(200, dataset);
}

function handleSystems(params) {
  const dataset = readDataset('systems');
  if (!dataset) return notIngested('systems');

  let systems = dataset.systems;

  const county = params.get('county');
  if (county) {
    const needle = normPlace(county);
    systems = systems.filter((s) =>
      (s.serviceArea?.counties || []).some((c) => normPlace(c) === needle));
  }

  const zip = params.get('zip');
  if (zip) {
    const clean = normalizeZip(zip);
    if (!clean) return fail(400, 'invalid_zip', 'ZIP must be five digits.');
    systems = systems.filter((s) => (s.serviceArea?.zips || []).includes(clean));
  }

  const type = params.get('type');
  if (type) {
    const needle = type.toLowerCase();
    systems = systems.filter((s) => (s.systemType || '').toLowerCase() === needle);
  }

  const q = params.get('q');
  if (q) {
    const needle = q.toLowerCase();
    systems = systems.filter((s) => s.name.toLowerCase().includes(needle));
  }

  if (params.get('activeOnly') === 'true') {
    systems = systems.filter((s) => s.isActive !== false);
  }

  const total = systems.length;
  const limit = Math.min(Number(params.get('limit')) || 100, 1000);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);

  return json(200, {
    meta: dataset.meta,
    total,
    limit,
    offset,
    systems: systems.slice(offset, offset + limit),
  });
}

// Live single-system profile: inventory plus violations, both of which are
// categorical and need no unit handling. `results` stays empty on purpose and
// the note says why — a JS reimplementation of the result normalizer is exactly
// the duplication this design refuses.
async function liveSystem(pwsid) {
  let system;
  let violations = [];
  try {
    system = await envirofacts.systemById(pwsid);
    if (system) violations = await envirofacts.violationsFor(pwsid);
  } catch (err) {
    console.warn('water-api: live EPA system fetch failed', err.message);
    return json(503, {
      error: 'upstream_unavailable',
      message:
        'The dataset has not been ingested yet, and EPA could not be reached to ' +
        'answer this live. Try again shortly.',
      meta: { dataset: 'systems', status: 'broken' },
    }, { maxAge: 0 });
  }

  if (!system) {
    return fail(404, 'system_not_found', `EPA reports no system ${pwsid}.`);
  }

  const open = violations.filter((v) => v.resolved === false);
  return json(200, {
    system,
    generatedAt: new Date().toISOString(),
    summary: {
      resultCount: 0,
      analytesMeasured: 0,
      exceedanceCount: 0,
      violations: {
        total: violations.length,
        open: open.length,
        openHealthBased: open.filter((v) => v.isHealthBased).length,
        healthBased: violations.filter((v) => v.isHealthBased).length,
      },
      activeBoilWaterNotices: 0,
      pfas: null,
    },
    priorityResults: [],
    exceedances: [],
    results: [],
    violations: violations.sort((a, b) =>
      String(b.beginDate || '').localeCompare(String(a.beginDate || ''))),
    boilWaterNotices: [],
    consumerConfidenceReports: [],
    meta: {
      dataset: 'systems',
      status: 'live',
      note:
        'Queried EPA SDWIS directly because this deployment has not ingested the ' +
        'dataset yet.',
    },
    note:
      'Live EPA query. System details and Safe Drinking Water Act violations are ' +
      'shown. Sample results — including PFAS — are not available live: they need ' +
      'unit conversion and non-detect handling that only the ingest pipeline does, ' +
      'and approximating that here would risk misreporting a contaminant level. ' +
      'Run the ingest to populate them.',
  }, { maxAge: 600 });
}

async function handleSystem(params) {
  const pwsid = String(params.get('pwsid') || '').trim().toUpperCase();
  if (!pwsid) return fail(400, 'missing_pwsid', 'Pass ?pwsid=FL0000000.');
  if (!PWSID_RE.test(pwsid)) {
    return fail(400, 'invalid_pwsid',
      'A PWSID is two letters followed by seven digits, e.g. FL4500123.');
  }

  // The filename is built from a strictly validated PWSID, so it cannot
  // traverse out of the profile directory.
  const profile = readDataset(path.join('systems', pwsid));
  if (profile) return json(200, profile);

  // Fall back to the inventory so a valid system without a deep profile still
  // answers with what is known, rather than a bare 404.
  const dataset = readDataset('systems');
  if (!dataset) return liveSystem(pwsid);
  const system = dataset.systems.find((s) => s.pwsid === pwsid);
  if (!system) {
    return fail(404, 'system_not_found',
      `No system ${pwsid} in the dataset. Try /api/water/lookup?zip=... to find one.`);
  }
  return json(200, {
    system,
    generatedAt: dataset.meta.generatedAt,
    summary: null,
    results: [],
    violations: [],
    boilWaterNotices: [],
    consumerConfidenceReports: [],
    note:
      'Inventory record only. Sample results, violations, and notices are ' +
      'ingested for utilities built out in water-quality/fwq/data/utilities/; ' +
      'this system is not one of them yet.',
  });
}

// A lookup that found nothing is a valid answer, not an error, so it returns
// 200 with a caveat explaining why rather than an empty list a caller has to
// interpret. Mirrors fwq.geo._empty_lookup.
function emptyLookup(query, caveat, geocode = null) {
  const payload = {
    query,
    method: 'none',
    isDefinitive: false,
    candidateCount: 0,
    candidates: [],
    caveat,
  };
  if (geocode) payload.geocode = geocode;
  return payload;
}

// Ranking lives here, once, so the indexed path and the live-EPA fallback
// cannot drift apart and give a caller different answers for the same ZIP.
// `infos` accepts either shape: the service index stores zips/counties flat,
// the live client nests them under serviceArea.
function rankCandidates(infos, { zip, city, cityMatches = new Set() }) {
  const typeWeight = {
    community: 1.0,
    'non-transient non-community': 0.4,
    'transient non-community': 0.15,
  };

  const candidates = infos.map((info) => {
    const area = info.serviceArea || {};
    const zips = info.zips || area.zips || [];
    const counties = info.counties || area.counties || [];
    const pwsid = info.pwsid;
    const reasons = [`Reported as serving ${zip ? `ZIP ${normalizeZip(zip)}` : city}`];
    let confidence = typeWeight[info.systemType] ?? 0.3;

    if (city && cityMatches.has(pwsid)) {
      confidence += 0.35;
      reasons.push(`also reports serving ${city}`);
    } else if (city && cityMatches.size > 0) {
      confidence -= 0.15;
    }
    if (zips.length > 0) {
      confidence += Math.min(0.2, 1 / zips.length);
      reasons.push(`serves ${zips.length} ZIP code(s) in total`);
    }
    if (info.isActive === false) {
      confidence -= 0.5;
      reasons.push('marked inactive in SDWIS');
    }

    return {
      pwsid,
      name: info.name || pwsid,
      confidence: Math.round(Math.max(0, Math.min(1, confidence)) * 1000) / 1000,
      reasons,
      populationServed: info.populationServed ?? null,
      systemType: info.systemType ?? null,
      counties,
      profileUrl: `/api/water/system?pwsid=${pwsid}`,
    };
  });

  candidates.sort((a, b) =>
    b.confidence - a.confidence
    || (b.populationServed || 0) - (a.populationServed || 0)
    || a.name.localeCompare(b.name));
  return candidates;
}

const CENSUS_GEOCODER =
  'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const GEOCODE_TIMEOUT_MS = 6000;

/**
 * Geocode a one-line address with the Census Bureau geocoder (free, no key).
 *
 * Returns `{ geo }` on a match, `{ geo: null }` when the address matches
 * nothing, and `{ unavailable: true }` when the geocoder could not be reached.
 * Those last two are different failures and the caller must word them
 * differently — only one of them is the user's to fix.
 */
async function geocodeAddress(address) {
  const url =
    `${CENSUS_GEOCODER}?address=${encodeURIComponent(address)}` +
    '&benchmark=Public_AR_Current&format=json';
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!res.ok) return { unavailable: true };
    const body = await res.json();
    const match = ((body.result || {}).addressMatches || [])[0];
    if (!match) return { geo: null };
    const c = match.addressComponents || {};
    const xy = match.coordinates || {};
    return {
      geo: {
        matchedAddress: match.matchedAddress || null,
        zip: normalizeZip(c.zip || ''),
        city: c.city || null,
        state: c.state || null,
        lat: xy.y ?? null,
        lon: xy.x ?? null,
      },
    };
  } catch (err) {
    console.warn('water-api: geocoder unavailable', err.message);
    return { unavailable: true };
  }
}

// When data/water/ has not been ingested, answer a ZIP lookup by querying EPA
// directly. This is only viable because the question is small — one ZIP's
// service-area rows plus the matching inventory — and because it needs no unit
// conversion or non-detect handling. Sample results are NOT fetched live; see
// the header of _lib/envirofacts.js for why.
async function liveLookup({ zip, city, address, geocode }) {
  const clean = normalizeZip(zip);
  if (!clean) {
    return fail(400, 'invalid_zip',
      'Live lookup needs a ZIP. Pass ?zip=33410, or ingest the dataset for city search.');
  }

  let systems;
  try {
    ({ systems } = await envirofacts.systemsForZip(clean));
  } catch (err) {
    console.warn('water-api: live EPA lookup failed', err.message);
    return json(503, {
      error: 'upstream_unavailable',
      message:
        'The dataset has not been ingested yet, and EPA could not be reached to ' +
        'answer this live. Try again shortly.',
      meta: { dataset: 'service-index', status: 'broken' },
    }, { maxAge: 0 });
  }

  if (systems.length === 0) {
    return json(200, emptyLookup(
      { zip: clean, city: city || null, address: address || null },
      'EPA reports no water system serving this ZIP. It may be served by private ' +
      'wells, by a system that has not reported this ZIP to SDWIS, or the ZIP may ' +
      'be outside Florida.',
      geocode,
    ), { maxAge: 600 });
  }

  const cityMatches = new Set();
  if (city) {
    const needle = normPlace(city);
    for (const s of systems) {
      if ((s.serviceArea.cities || []).some((c) => normPlace(c) === needle)) {
        cityMatches.add(s.pwsid);
      }
    }
  }

  const candidates = rankCandidates(systems, { zip: clean, city, cityMatches });
  return json(200, {
    query: { zip: clean, city: city || null, address: address || null },
    method: geocode ? 'live-epa+geocode' : 'live-epa',
    ...(geocode ? { geocode } : {}),
    isDefinitive: candidates.length === 1,
    candidateCount: candidates.length,
    candidates,
    meta: {
      dataset: 'service-index',
      status: 'live',
      note:
        'Queried EPA SDWIS directly because this deployment has not ingested the ' +
        'dataset yet. Utility identification is complete; sample results and ' +
        'PFAS data require the ingest.',
    },
    caveat:
      'ZIP codes are mail routes, not water service areas. This is a ranked list ' +
      'of systems that report serving this ZIP, not a determination of who bills ' +
      'you. Confirm against your water bill.',
  }, { maxAge: 600 });
}

async function handleLookup(params) {
  const index = readDataset('service-index');
  if (!index) {
    // Fall through to a live EPA query rather than 503-ing. The address branch
    // below still needs to run first so ?address= works in live mode too.
    const address0 = params.get('address');
    let zip0 = params.get('zip');
    let city0 = params.get('city');
    let geocode0 = null;
    if (!zip0 && !city0 && !address0) {
      return fail(400, 'missing_query',
        'Pass ?zip=33410, ?city=Jupiter, or ?address=1 Main St, Jupiter FL.');
    }
    if (address0 && !zip0) {
      const { geo, unavailable } = await geocodeAddress(address0);
      if (unavailable) {
        return json(200, emptyLookup({ address: address0 },
          'The address geocoder could not be reached, so this address could not be ' +
          'resolved. Try a ZIP code lookup instead.'), { maxAge: 0 });
      }
      if (!geo) {
        return json(200, emptyLookup({ address: address0 },
          'That address could not be geocoded. Check the spelling, or look up your ' +
          'ZIP code instead.'), { maxAge: 0 });
      }
      if (geo.state && geo.state.toUpperCase() !== 'FL') {
        return json(200, emptyLookup({ address: address0 },
          `That address geocoded to ${geo.state}, outside this dataset's Florida coverage.`));
      }
      geocode0 = geo;
      zip0 = geo.zip;
      city0 = city0 || geo.city;
    }
    return liveLookup({ zip: zip0, city: city0, address: address0, geocode: geocode0 });
  }

  let zip = params.get('zip');
  let city = params.get('city');
  const address = params.get('address');
  if (!zip && !city && !address) {
    return fail(400, 'missing_query',
      'Pass ?zip=33410, ?city=Jupiter, or ?address=1 Main St, Jupiter FL.');
  }

  let caveat =
    'ZIP codes are mail routes, not water service areas. This is a ranked list ' +
    'of systems that report serving this area, not a determination of who bills ' +
    'you. Confirm against your water bill.';

  let geocode = null;
  let method;

  // Address resolution geocodes to a point, then falls back to ZIP+city
  // matching, because no service-area geometry is wired yet. The response says
  // which method was used so a caller can tell a real point-in-polygon answer
  // from this approximation once geometry lands.
  if (address && !zip) {
    const { geo, unavailable } = await geocodeAddress(address);
    if (unavailable) {
      return json(200, emptyLookup(
        { address },
        'The address geocoder could not be reached, so this address could not be ' +
        'resolved. Try a ZIP code lookup instead.',
      ), { maxAge: 0 });
    }
    if (!geo) {
      return json(200, emptyLookup(
        { address },
        'That address could not be geocoded. Check the spelling, or look up your ' +
        'ZIP code instead.',
      ), { maxAge: 0 });
    }
    if (geo.state && geo.state.toUpperCase() !== 'FL') {
      return json(200, emptyLookup(
        { address },
        `That address geocoded to ${geo.state}, outside this dataset's Florida coverage.`,
      ));
    }
    if (!geo.zip) {
      return json(200, emptyLookup(
        { address },
        'That address geocoded without a ZIP code, so it could not be matched to a utility.',
      ));
    }
    geocode = geo;
    zip = geo.zip;
    city = city || geo.city;
    caveat =
      'Resolved by geocoding the address and matching its ZIP and city against ' +
      'SDWIS-reported service areas. This is not a service-area boundary lookup: ' +
      'utility service-area geometry is not yet wired, so an address near a ' +
      'boundary may match the wrong system. Confirm against your water bill.';
  }

  let pwsids;
  if (zip) {
    const clean = normalizeZip(zip);
    if (!clean) return fail(400, 'invalid_zip', 'ZIP must be five digits.');
    pwsids = index.byZip[clean] || [];
    method = geocode ? 'geocode+zip+city' : (city ? 'zip+city' : 'zip');
  } else {
    pwsids = index.byCity[normPlace(city)] || [];
    method = 'city';
  }

  if (pwsids.length === 0) {
    return json(200, emptyLookup(
      { zip: zip || null, city: city || null, address: address || null },
      'No water system in the dataset reports serving this area. It may be ' +
      'served by private wells, by a system that has not reported it to SDWIS, ' +
      'or it may be outside Florida.',
      geocode,
    ));
  }

  const cityMatches = city ? new Set(index.byCity[normPlace(city)] || []) : new Set();
  const candidates = rankCandidates(
    pwsids.map((pwsid) => ({ pwsid, ...(index.systems[pwsid] || {}) })),
    { zip, city, cityMatches },
  );

  return json(200, {
    query: { zip: zip || null, city: city || null, address: address || null },
    method,
    generatedAt: index.generatedAt,
    ...(geocode ? { geocode } : {}),
    isDefinitive: candidates.length === 1,
    candidateCount: candidates.length,
    candidates,
    caveat,
  });
}

// --- entry point ------------------------------------------------------------

const ROUTES = {
  health: handleHealth,
  analytes: handleAnalytes,
  utilities: handleUtilities,
  systems: handleSystems,
  system: handleSystem,
  lookup: handleLookup,
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return fail(405, 'method_not_allowed', 'This API is read-only; use GET.');
  }

  const limit = checkRateLimit(event, { name: 'water-api', windowMs: 60_000, max: 120 });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSec);

  // Path is /api/water/<endpoint> before the redirect, /.netlify/functions/... after.
  const rawPath = event.path || '';
  const segments = rawPath.split('/').filter(Boolean);
  let endpoint = segments[segments.length - 1] || '';
  if (endpoint === 'water-api' || endpoint === 'water') endpoint = 'health';

  const params = new URLSearchParams(event.rawQuery || '');
  for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
    if (!params.has(key)) params.set(key, value);
  }

  const route = ROUTES[endpoint];
  if (!route) {
    return fail(404, 'unknown_endpoint',
      `No endpoint "${endpoint}".`, { available: Object.keys(ROUTES) });
  }

  try {
    // Awaited, not returned bare: handleLookup is async, and a bare return
    // would let a rejection escape this catch and surface as an opaque 502.
    return await route(params);
  } catch (err) {
    console.error('water-api error', endpoint, err);
    return fail(500, 'internal_error', 'The request could not be completed.');
  }
};

// Exported for the Node test harness in water-quality/tests/api.test.mjs.
exports._internals = { normalizeZip, normPlace, readDataset, PWSID_RE };
