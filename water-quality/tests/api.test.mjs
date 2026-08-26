// Tests for netlify/functions/water-api.js.
//
// Generates a dataset into a temporary directory using the Python pipeline's
// fixtures, points the function at it, and exercises every endpoint.
//
// Run:  node water-quality/tests/api.test.mjs
// (also runs as part of `npm run test:water`)

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);

// Build a dataset from the synthetic fixtures into a temp directory and point
// the function at it. Never touches the committed data/water/, so this suite
// behaves identically whether or not a real ingest has run.
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fwq-api-'));
process.env.FWQ_DATA_DIR = DATA_DIR;

{
  execFileSync('python3', ['-c', `
import sys; sys.path.insert(0, ${JSON.stringify(path.join(REPO_ROOT, 'water-quality'))})
from datetime import datetime, timezone
from pathlib import Path
from fwq import build, utilities
from tests import fixtures
config = utilities.UtilityConfig.from_dict({
    "slug": "example", "name": "Example Shoreline Utility Authority",
    "priority_analytes": {"ids": ["pfoa", "pfos", "lead", "tthm"]},
})
config.pwsid = fixtures.SYNTHETIC_PWSID_A
result = build.ingest_state(
    fixtures.FakeClient(), focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
    retrieved_at=datetime(2026, 8, 15, tzinfo=timezone.utc),
    # Keep the learned contaminant-code map out of the shipped package data.
    codemap_path=Path(${JSON.stringify(DATA_DIR)}) / "sdwis_contaminant_codes.json")
build.write_dataset(result, {"example": config}, out_dir=${JSON.stringify(DATA_DIR)})
`], { cwd: path.join(REPO_ROOT, 'water-quality'), stdio: 'inherit' });
}

const { handler, _internals } = require(path.join(REPO_ROOT, 'netlify', 'functions', 'water-api.js'));

function get(endpoint, query = {}) {
  return handler({
    httpMethod: 'GET',
    path: `/api/water/${endpoint}`,
    queryStringParameters: query,
    rawQuery: new URLSearchParams(query).toString(),
    headers: { 'x-nf-client-connection-ip': `test-${Math.random()}` },
  });
}

async function getJson(endpoint, query) {
  const res = await get(endpoint, query);
  return { status: res.statusCode, body: JSON.parse(res.body), headers: res.headers };
}

test('rejects non-GET methods', async () => {
  const res = await handler({ httpMethod: 'POST', path: '/api/water/health', headers: {} });
  assert.equal(res.statusCode, 405);
});

test('answers CORS preflight', async () => {
  const res = await handler({ httpMethod: 'OPTIONS', path: '/api/water/health', headers: {} });
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
});

test('unknown endpoint lists the available ones', async () => {
  const { status, body } = await getJson('nope');
  assert.equal(status, 404);
  assert.ok(body.available.includes('lookup'));
});

test('health reports dataset status and counts', async () => {
  const { status, body } = await getJson('health');
  assert.equal(status, 200);
  assert.ok(body.meta.status, 'a trust status must always be present');
  assert.ok(body.counts.systems > 0);
  assert.ok(body.endpoints.lookup);
});

test('analytes returns the dictionary with limits and citations', async () => {
  const { status, body } = await getJson('analytes');
  assert.equal(status, 200);
  assert.ok(body.count > 50);
  const pfoa = body.analytes.find((a) => a.id === 'pfoa');
  const mcl = pfoa.limits.find((l) => l.kind === 'MCL');
  assert.equal(mcl.value, 4.0);
  assert.equal(mcl.unit, 'ng/L');
  assert.ok(mcl.citation, 'every limit must cite an authority');
});

test('analytes filters by group', async () => {
  const { body } = await getJson('analytes', { group: 'pfas' });
  assert.ok(body.count >= 20);
  assert.ok(body.analytes.every((a) => a.group === 'pfas'));
});

test('analytes 404s on an unknown id', async () => {
  const { status } = await getJson('analytes', { id: 'unobtainium' });
  assert.equal(status, 404);
});

test('systems supports filtering and pagination', async () => {
  const all = await getJson('systems');
  assert.equal(all.status, 200);
  assert.ok(all.body.total > 0);

  const paged = await getJson('systems', { limit: '1' });
  assert.equal(paged.body.systems.length, 1);
  assert.equal(paged.body.total, all.body.total);

  const byCounty = await getJson('systems', { county: 'Palm Beach' });
  assert.ok(byCounty.body.total > 0);
  assert.ok(byCounty.body.systems.every(
    (s) => s.serviceArea.counties.includes('Palm Beach')));
});

test('systems rejects a malformed ZIP filter', async () => {
  const { status, body } = await getJson('systems', { zip: 'abcde' });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_zip');
});

test('system requires a well-formed PWSID', async () => {
  assert.equal((await getJson('system')).status, 400);
  assert.equal((await getJson('system', { pwsid: 'nope' })).status, 400);
  // Path traversal via the pwsid parameter must be rejected by the format check.
  assert.equal((await getJson('system', { pwsid: '../../index' })).status, 400);
});

test('system returns a full profile with provenance on every result', async () => {
  const { status, body } = await getJson('system', { pwsid: 'FL9990001' });
  assert.equal(status, 200);
  assert.equal(body.system.pwsid, 'FL9990001');
  assert.ok(body.summary.pfas.hazardIndex);
  assert.ok(body.results.length > 0);
  for (const r of body.results) {
    assert.ok(r.provenance && r.provenance.source, `${r.analyteId} lacks provenance`);
  }
});

test('a non-detect is never returned as an exceedance', async () => {
  const { body } = await getJson('system', { pwsid: 'FL9990001' });
  const exceeded = new Set(body.exceedances.map((e) => e.analyteId));
  for (const r of body.results) {
    if (!r.detected) {
      assert.equal(r.comparison, undefined, `${r.analyteId}: non-detect has a comparison`);
      assert.ok(!exceeded.has(r.analyteId), `${r.analyteId}: non-detect listed as exceedance`);
    }
  }
});

test('system falls back to an inventory record with an explanatory note', async () => {
  const { status, body } = await getJson('system', { pwsid: 'FL9990003' });
  assert.equal(status, 200);
  assert.ok(body.note.includes('Inventory record only'));
  assert.deepEqual(body.results, []);
});

test('system 404s on a well-formed but unknown PWSID', async () => {
  const { status, body } = await getJson('system', { pwsid: 'FL0000000' });
  assert.equal(status, 404);
  assert.equal(body.error, 'system_not_found');
});

test('lookup ranks candidates and refuses to claim certainty on a shared ZIP', async () => {
  const { status, body } = await getJson('lookup', { zip: '33410' });
  assert.equal(status, 200);
  assert.equal(body.candidateCount, 2);
  assert.equal(body.isDefinitive, false);
  assert.match(body.caveat, /mail routes/);
  assert.equal(body.candidates[0].systemType, 'community',
    'the community system must outrank the transient one');
  assert.ok(body.candidates[0].profileUrl.includes('pwsid='));
});

test('lookup narrows with a city and matches the Python implementation', async () => {
  const { body } = await getJson('lookup', { zip: '33410', city: 'North Example' });
  assert.equal(body.method, 'zip+city');
  assert.equal(body.candidates[0].pwsid, 'FL9990001');

  const python = JSON.parse(execFileSync('python3', [
    '-m', 'fwq', '--out', DATA_DIR, 'lookup', '--zip', '33410', '--city', 'North Example',
  ], { cwd: path.join(REPO_ROOT, 'water-quality'), encoding: 'utf8' }));

  assert.deepEqual(
    body.candidates.map((c) => [c.pwsid, c.confidence]),
    python.candidates.map((c) => [c.pwsid, c.confidence]),
    'the JS and Python rankers must agree, or the API contradicts the CLI',
  );
});

test('lookup explains an unserved ZIP instead of returning a bare empty list', async () => {
  const { status, body } = await getJson('lookup', { zip: '90210' });
  assert.equal(status, 200);
  assert.equal(body.candidateCount, 0);
  assert.match(body.caveat, /private wells/);
});

test('lookup requires a query', async () => {
  assert.equal((await getJson('lookup')).status, 400);
});

// --- address lookup -------------------------------------------------------
// fetch is stubbed for every case below; none of these touch the network.

const realFetch = globalThis.fetch;
function stubGeocoder(impl) {
  globalThis.fetch = impl;
  return () => { globalThis.fetch = realFetch; };
}
function censusMatch({ zip = '33410', city = 'EXAMPLE GARDENS', state = 'FL' } = {}) {
  return {
    ok: true,
    json: async () => ({ result: { addressMatches: [{
      matchedAddress: `1 EXAMPLE ST, ${city}, ${state}, ${zip}`,
      addressComponents: { zip, city, state },
      coordinates: { x: -80.1, y: 26.8 },
    }] } }),
  };
}

test('address lookup geocodes then ranks, and labels the method used', async () => {
  let requested = null;
  const restore = stubGeocoder(async (url) => { requested = url; return censusMatch(); });
  try {
    const { status, body } = await getJson('lookup', { address: '1 Example St, Example Gardens FL' });
    assert.equal(status, 200);
    assert.equal(body.method, 'geocode+zip+city');
    assert.equal(body.candidateCount, 2);
    assert.equal(body.candidates[0].pwsid, 'FL9990001');
    assert.equal(body.geocode.zip, '33410');
    assert.match(body.caveat, /not a service-area boundary lookup/);
    assert.ok(requested.includes('onelineaddress'), 'must call the Census geocoder');
    assert.ok(!requested.includes(' '), 'address must be URL-encoded');
  } finally { restore(); }
});

test('an unreachable geocoder is not reported as a bad address', async () => {
  const restore = stubGeocoder(async () => { throw new Error('ETIMEDOUT'); });
  try {
    const { status, body } = await getJson('lookup', { address: '1 Example St' });
    assert.equal(status, 200, 'a dead upstream is not the caller’s error to fix');
    assert.equal(body.candidateCount, 0);
    assert.match(body.caveat, /could not be reached/);
    assert.doesNotMatch(body.caveat, /could not be geocoded/,
      'must not blame the address when the geocoder is down');
  } finally { restore(); }
});

test('a non-200 from the geocoder is treated as unreachable, not as no-match', async () => {
  const restore = stubGeocoder(async () => ({ ok: false, status: 503 }));
  try {
    const { body } = await getJson('lookup', { address: '1 Example St' });
    assert.match(body.caveat, /could not be reached/);
  } finally { restore(); }
});

test('an address that matches nothing says so and points at ZIP lookup', async () => {
  const restore = stubGeocoder(async () => ({
    ok: true, json: async () => ({ result: { addressMatches: [] } }),
  }));
  try {
    const { body } = await getJson('lookup', { address: 'nowhere at all' });
    assert.equal(body.candidateCount, 0);
    assert.match(body.caveat, /could not be geocoded/);
    assert.match(body.caveat, /ZIP/);
  } finally { restore(); }
});

test('an out-of-state address is refused rather than matched on ZIP alone', async () => {
  const restore = stubGeocoder(async () =>
    censusMatch({ zip: '90210', city: 'BEVERLY HILLS', state: 'CA' }));
  try {
    const { body } = await getJson('lookup', { address: '1 Example St, Beverly Hills CA' });
    assert.equal(body.candidateCount, 0);
    assert.match(body.caveat, /outside this dataset/);
  } finally { restore(); }
});

test('an explicit zip wins over address, and skips the geocoder entirely', async () => {
  let called = false;
  const restore = stubGeocoder(async () => { called = true; return censusMatch(); });
  try {
    const { body } = await getJson('lookup', { zip: '33408', address: '1 Example St' });
    assert.equal(body.method, 'zip');
    assert.equal(called, false, 'no reason to geocode when a ZIP was given');
  } finally { restore(); }
});

test('address lookup matches the Python implementation', async () => {
  const restore = stubGeocoder(async () => censusMatch());
  try {
    const { body } = await getJson('lookup', { address: '1 Example St' });
    const python = JSON.parse(execFileSync('python3', [
      '-m', 'fwq', '--out', DATA_DIR, 'lookup', '--zip', '33410', '--city', 'EXAMPLE GARDENS',
    ], { cwd: path.join(REPO_ROOT, 'water-quality'), encoding: 'utf8' }));
    assert.deepEqual(
      body.candidates.map((c) => [c.pwsid, c.confidence]),
      python.candidates.map((c) => [c.pwsid, c.confidence]),
      'the address path must rank identically to the equivalent ZIP+city lookup',
    );
  } finally { restore(); }
});

test('utilities withholds an unverified website URL', async () => {
  const { status, body } = await getJson('utilities');
  assert.equal(status, 200);
  const seacoast = body.utilities.find((u) => u.slug === 'seacoast');
  if (seacoast) {
    assert.equal(seacoast.website, null,
      'an unprobed URL must not be published as a working link');
  }
});

test('responses are cacheable and CORS-open', async () => {
  const { headers } = await getJson('analytes');
  assert.match(headers['Cache-Control'], /max-age=\d+/);
  assert.equal(headers['Access-Control-Allow-Origin'], '*');
});

test.after(() => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});
