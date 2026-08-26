// Live-EPA fallback: what the API does when data/water/ has not been ingested.
//
// Points the function at an EMPTY dataset directory and stubs `fetch`, so these
// exercise the fallback path end to end without touching the network.
//
// All payloads are SYNTHETIC and use fictional FL999xxxx PWSIDs. Field names
// and casing mirror what Envirofacts actually returns, including the uppercase
// column names it sometimes emits.
//
// Run:  node water-quality/tests/api-live.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);

// An empty directory: every readDataset() call misses, which is what triggers
// the live path.
const EMPTY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fwq-live-'));
process.env.FWQ_DATA_DIR = EMPTY_DIR;

const { handler } = require(path.join(REPO_ROOT, 'netlify', 'functions', 'water-api.js'));

// --- synthetic Envirofacts payloads ---------------------------------------

const GEO_ROWS = [
  { PWSID: 'FL9990001', STATE_SERVED: 'FL', COUNTY_SERVED: 'PALM BEACH',
    CITY_SERVED: 'EXAMPLE GARDENS', ZIP_CODE_SERVED: '33410' },
  { PWSID: 'FL9990001', STATE_SERVED: 'FL', COUNTY_SERVED: 'PALM BEACH',
    CITY_SERVED: 'NORTH EXAMPLE', ZIP_CODE_SERVED: '33408' },
  { PWSID: 'FL9990002', STATE_SERVED: 'FL', COUNTY_SERVED: 'PALM BEACH',
    CITY_SERVED: 'EXAMPLE GARDENS', ZIP_CODE_SERVED: '33410' },
];

const SYSTEM_ROWS = [
  { PWSID: 'FL9990001', PWS_NAME: 'EXAMPLE SHORELINE UTILITY AUTHORITY',
    PWS_TYPE_CODE: 'CWS', PRIMARY_SOURCE_CODE: 'GW',
    POPULATION_SERVED_COUNT: '78000', PWS_ACTIVITY_CODE: 'A' },
  { PWSID: 'FL9990002', PWS_NAME: 'EXAMPLE SHORELINE RV PARK',
    PWS_TYPE_CODE: 'TNCWS', PRIMARY_SOURCE_CODE: 'GW',
    POPULATION_SERVED_COUNT: '80', PWS_ACTIVITY_CODE: 'A' },
];

const VIOLATION_ROWS = [
  { PWSID: 'FL9990001', VIOLATION_ID: '9000001', VIOLATION_CATEGORY_CODE: 'MCL',
    CONTAMINANT_CODE: '2950', COMPL_PER_BEGIN_DATE: '01/01/2024',
    CALCULATED_RTC_DATE: '06/15/2024', IS_HEALTH_BASED_IND: 'Y',
    VIOLATION_STATUS: 'Resolved' },
  { PWSID: 'FL9990001', VIOLATION_ID: '9000002', VIOLATION_CATEGORY_CODE: 'MR',
    CONTAMINANT_CODE: '9999', COMPL_PER_BEGIN_DATE: '2025-01-01',
    IS_HEALTH_BASED_IND: 'N', VIOLATION_STATUS: 'Unaddressed' },
];

const realFetch = globalThis.fetch;

/** Route a stubbed Envirofacts URL to the right synthetic table. */
function epaStub({ fail: failOn = null, empty = false } = {}) {
  globalThis.fetch = async (url) => {
    if (failOn && String(url).includes(failOn)) throw new Error('ECONNREFUSED');
    const ok = (rows) => ({ ok: true, status: 200, json: async () => rows });
    if (empty) return { ok: false, status: 404 };
    if (String(url).includes('geographic_area')) return ok(GEO_ROWS);
    if (String(url).includes('water_system')) return ok(SYSTEM_ROWS);
    if (String(url).includes('violation')) return ok(VIOLATION_ROWS);
    return ok([]);
  };
  return () => { globalThis.fetch = realFetch; };
}

function get(endpoint, query = {}) {
  return handler({
    httpMethod: 'GET',
    path: `/api/water/${endpoint}`,
    queryStringParameters: query,
    rawQuery: new URLSearchParams(query).toString(),
    headers: { 'x-nf-client-connection-ip': `live-${Math.random()}` },
  });
}

async function getJson(endpoint, query) {
  const res = await get(endpoint, query);
  return { status: res.statusCode, body: JSON.parse(res.body), headers: res.headers };
}

// --- lookup ---------------------------------------------------------------

test('ZIP lookup falls back to a live EPA query instead of 503', async () => {
  const restore = epaStub();
  try {
    const { status, body } = await getJson('lookup', { zip: '33410' });
    assert.equal(status, 200);
    assert.equal(body.method, 'live-epa');
    assert.equal(body.meta.status, 'live');
    assert.equal(body.candidateCount, 2);
    assert.match(body.meta.note, /has not ingested the dataset/);
  } finally { restore(); }
});

test('live ranking matches the ingested path: community outranks transient', async () => {
  const restore = epaStub();
  try {
    const { body } = await getJson('lookup', { zip: '33410' });
    assert.equal(body.candidates[0].pwsid, 'FL9990001');
    assert.equal(body.candidates[0].systemType, 'community');
    assert.equal(body.candidates[1].systemType, 'transient non-community');
    assert.ok(body.candidates[0].confidence > body.candidates[1].confidence);
  } finally { restore(); }
});

test('live lookup maps SDWIS codes and title-cases place names', async () => {
  const restore = epaStub();
  try {
    const { body } = await getJson('lookup', { zip: '33410' });
    const top = body.candidates[0];
    assert.equal(top.populationServed, 78000);
    assert.deepEqual(top.counties, ['Palm Beach']);
    assert.ok(top.reasons.some((r) => r.includes('2 ZIP code(s)')));
  } finally { restore(); }
});

test('a city narrows the live ranking too', async () => {
  const restore = epaStub();
  try {
    const { body } = await getJson('lookup', { zip: '33410', city: 'North Example' });
    assert.equal(body.candidates[0].pwsid, 'FL9990001');
    assert.ok(body.candidates[0].reasons.some((r) => /also reports serving/.test(r)));
  } finally { restore(); }
});

test('a ZIP EPA does not serve returns an explanation, not an error', async () => {
  const restore = epaStub({ empty: true });
  try {
    const { status, body } = await getJson('lookup', { zip: '90210' });
    assert.equal(status, 200);
    assert.equal(body.candidateCount, 0);
    assert.match(body.caveat, /EPA reports no water system/);
  } finally { restore(); }
});

test('EPA being unreachable is reported as upstream, not as no results', async () => {
  const restore = epaStub({ fail: 'geographic_area' });
  try {
    const { status, body, headers } = await getJson('lookup', { zip: '33410' });
    assert.equal(status, 503);
    assert.equal(body.error, 'upstream_unavailable');
    assert.equal(body.meta.status, 'broken');
    // An outage must not be cached, or the CDN pins the failure in place after
    // EPA recovers.
    assert.match(headers['Cache-Control'], /max-age=0/);
  } finally { restore(); }
});

test('address lookup works in live mode, geocoder then EPA', async () => {
  const restoreEpa = epaStub();
  const epaFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('geocoding.geo.census.gov')) {
      return { ok: true, json: async () => ({ result: { addressMatches: [{
        matchedAddress: '1 EXAMPLE ST, EXAMPLE GARDENS, FL, 33410',
        addressComponents: { zip: '33410', city: 'EXAMPLE GARDENS', state: 'FL' },
        coordinates: { x: -80.1, y: 26.8 },
      }] } }) };
    }
    return epaFetch(url);
  };
  try {
    const { status, body } = await getJson('lookup', { address: '1 Example St' });
    assert.equal(status, 200);
    assert.equal(body.method, 'live-epa+geocode');
    assert.equal(body.geocode.zip, '33410');
    assert.equal(body.candidateCount, 2);
  } finally { restoreEpa(); }
});

test('city-only search still needs the ingest and says so', async () => {
  const restore = epaStub();
  try {
    const { status, body } = await getJson('lookup', { city: 'Jupiter' });
    assert.equal(status, 400);
    assert.match(body.message, /ingest the dataset for city search/);
  } finally { restore(); }
});

// --- system ---------------------------------------------------------------

test('system profile falls back to live EPA with violations', async () => {
  const restore = epaStub();
  try {
    const { status, body } = await getJson('system', { pwsid: 'FL9990001' });
    assert.equal(status, 200);
    assert.equal(body.meta.status, 'live');
    assert.equal(body.system.name, 'EXAMPLE SHORELINE UTILITY AUTHORITY');
    assert.equal(body.system.primarySource, 'groundwater');
    assert.equal(body.violations.length, 2);
    assert.equal(body.summary.violations.healthBased, 1);
    assert.equal(body.summary.violations.open, 1);
    assert.equal(body.summary.violations.openHealthBased, 0);
  } finally { restore(); }
});

test('live profile returns no sample results and explains the refusal', async () => {
  const restore = epaStub();
  try {
    const { body } = await getJson('system', { pwsid: 'FL9990001' });
    assert.deepEqual(body.results, []);
    assert.deepEqual(body.exceedances, []);
    assert.equal(body.summary.pfas, null);
    // The reason matters: this is a deliberate refusal to reimplement unit
    // conversion and non-detect handling in JS, not an oversight.
    assert.match(body.note, /unit conversion and non-detect handling/);
    assert.match(body.note, /Run the ingest/);
  } finally { restore(); }
});

test('live violations resolve return-to-compliance dates', async () => {
  const restore = epaStub();
  try {
    const { body } = await getJson('system', { pwsid: 'FL9990001' });
    const byId = Object.fromEntries(body.violations.map((v) => [v.violationId, v]));
    assert.equal(byId['9000001'].resolved, true, 'has an RTC date');
    assert.equal(byId['9000001'].beginDate, '2024-01-01');
    assert.equal(byId['9000002'].resolved, false, 'unaddressed');
    assert.equal(byId['9000002'].beginDate, '2025-01-01');
  } finally { restore(); }
});

test('a live violation surfaces the raw SDWIS code rather than inventing a name', async () => {
  const restore = epaStub();
  try {
    const { body } = await getJson('system', { pwsid: 'FL9990001' });
    const v = body.violations.find((x) => x.violationId === '9000001');
    assert.equal(v.analyteId, null);
    assert.match(v.analyteName, /SDWIS contaminant 2950/);
  } finally { restore(); }
});

test('an unknown PWSID 404s in live mode', async () => {
  const restore = epaStub({ empty: true });
  try {
    const { status, body } = await getJson('system', { pwsid: 'FL0000000' });
    assert.equal(status, 404);
    assert.equal(body.error, 'system_not_found');
  } finally { restore(); }
});

test('a malformed PWSID is still rejected before any network call', async () => {
  let called = false;
  const restore = stubCounting(() => { called = true; });
  try {
    assert.equal((await getJson('system', { pwsid: '../../etc/passwd' })).status, 400);
    assert.equal(called, false, 'must not query EPA with unvalidated input');
  } finally { restore(); }

  function stubCounting(onCall) {
    globalThis.fetch = async (url) => { onCall(); return { ok: false, status: 404 }; };
    return () => { globalThis.fetch = realFetch; };
  }
});

test('endpoints needing the full dataset still say coming-soon', async () => {
  // /systems is a whole-state inventory; there is no small live query for it,
  // so it must keep saying the dataset is not ingested rather than pretend.
  const restore = epaStub();
  try {
    const { status, body } = await getJson('systems');
    assert.equal(status, 503);
    assert.equal(body.meta.status, 'coming-soon');
  } finally { restore(); }
});

test('the analyte dictionary is unaffected by the live path', async () => {
  const { status } = await getJson('analytes');
  // No dataset dir means no analytes.json either, so this is coming-soon here;
  // in a real deploy analytes.json is committed and this serves normally.
  assert.ok([200, 503].includes(status));
});

test.after(() => {
  globalThis.fetch = realFetch;
  fs.rmSync(EMPTY_DIR, { recursive: true, force: true });
});
