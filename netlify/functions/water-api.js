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

function handleSystem(params) {
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
  if (!dataset) return notIngested('systems');
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

function handleLookup(params) {
  const index = readDataset('service-index');
  if (!index) return notIngested('service-index');

  const zip = params.get('zip');
  const city = params.get('city');
  if (!zip && !city) {
    return fail(400, 'missing_query', 'Pass ?zip=33410 or ?city=Jupiter.');
  }

  const caveat =
    'ZIP codes are mail routes, not water service areas. This is a ranked list ' +
    'of systems that report serving this area, not a determination of who bills ' +
    'you. Confirm against your water bill.';

  let pwsids;
  let method;
  if (zip) {
    const clean = normalizeZip(zip);
    if (!clean) return fail(400, 'invalid_zip', 'ZIP must be five digits.');
    pwsids = index.byZip[clean] || [];
    method = city ? 'zip+city' : 'zip';
  } else {
    pwsids = index.byCity[normPlace(city)] || [];
    method = 'city';
  }

  if (pwsids.length === 0) {
    return json(200, {
      query: { zip: zip || null, city: city || null },
      method: 'none',
      isDefinitive: false,
      candidateCount: 0,
      candidates: [],
      caveat:
        'No water system in the dataset reports serving this area. It may be ' +
        'served by private wells, by a system that has not reported it to SDWIS, ' +
        'or it may be outside Florida.',
    });
  }

  const cityMatches = city ? new Set(index.byCity[normPlace(city)] || []) : new Set();
  const typeWeight = {
    community: 1.0,
    'non-transient non-community': 0.4,
    'transient non-community': 0.15,
  };

  const candidates = pwsids.map((pwsid) => {
    const info = index.systems[pwsid] || {};
    const reasons = [`Reported as serving ${zip ? `ZIP ${normalizeZip(zip)}` : city}`];
    let confidence = typeWeight[info.systemType] ?? 0.3;

    if (city && cityMatches.has(pwsid)) {
      confidence += 0.35;
      reasons.push(`also reports serving ${city}`);
    } else if (city && cityMatches.size > 0) {
      confidence -= 0.15;
    }
    const zipCount = (info.zips || []).length;
    if (zipCount > 0) {
      confidence += Math.min(0.2, 1 / zipCount);
      reasons.push(`serves ${zipCount} ZIP code(s) in total`);
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
      counties: info.counties || [],
      profileUrl: `/api/water/system?pwsid=${pwsid}`,
    };
  });

  candidates.sort((a, b) =>
    b.confidence - a.confidence
    || (b.populationServed || 0) - (a.populationServed || 0)
    || a.name.localeCompare(b.name));

  return json(200, {
    query: { zip: zip || null, city: city || null },
    method,
    generatedAt: index.generatedAt,
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
    return route(params);
  } catch (err) {
    console.error('water-api error', endpoint, err);
    return fail(500, 'internal_error', 'The request could not be completed.');
  }
};

// Exported for the Node test harness in water-quality/tests/api.test.mjs.
exports._internals = { normalizeZip, normPlace, readDataset, PWSID_RE };
