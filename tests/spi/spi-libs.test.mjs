import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  hashShopApiKey,
  extractShopApiKey,
  keyPrefix,
} = require('../../netlify/functions/_lib/shop-auth.js');
const { checkRateLimit } = require('../../netlify/functions/_lib/rate-limit.js');
const {
  isPlumbing,
  flattenParcelMap,
  matchRows,
  streetCore,
  activeCities,
  enrichEquipmentWithYearBuilt,
} = require('../../netlify/functions/_lib/spi-permits.js');
const { assembleOpportunities } = require('../../netlify/functions/_lib/spi-opportunities.js');
const {
  assembleBuilding,
  stripUnitAndCity,
  addressQueryVariants,
  normalizeStreetKey,
  pickPrimaryParcel,
  resolvedPrimary,
} = require('../../netlify/functions/_lib/spi-parcel.js');

describe('shop-auth', () => {
  it('hashes keys deterministically', () => {
    const a = hashShopApiKey('ds_shop_test');
    const b = hashShopApiKey('ds_shop_test');
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it('extracts X-Api-Key and Bearer', () => {
    assert.equal(
      extractShopApiKey({ headers: { 'x-api-key': 'abc' } }),
      'abc'
    );
    assert.equal(
      extractShopApiKey({ headers: { Authorization: 'Bearer xyz' } }),
      'xyz'
    );
    assert.equal(extractShopApiKey({ headers: {} }), null);
  });

  it('prefixes keys', () => {
    assert.equal(keyPrefix('ds_shop_abcdef123456'), 'ds_shop_abcd');
  });
});

describe('rate-limit bucketKey', () => {
  it('scopes by shop id when bucketKey set', () => {
    const event = { headers: { 'x-forwarded-for': '1.2.3.4' } };
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(event, { name: 't-shop', max: 3, bucketKey: 'shop-a' });
      assert.equal(r.allowed, true);
    }
    const blocked = checkRateLimit(event, { name: 't-shop', max: 3, bucketKey: 'shop-a' });
    assert.equal(blocked.allowed, false);
    const other = checkRateLimit(event, { name: 't-shop', max: 3, bucketKey: 'shop-b' });
    assert.equal(other.allowed, true);
  });
});

describe('spi-permits helpers', () => {
  it('detects plumbing keywords', () => {
    assert.equal(isPlumbing({ type: 'Plumbing', description: '' }), true);
    assert.equal(isPlumbing({ type: 'Roof', description: 'shingles' }), false);
    assert.equal(isPlumbing({ type: 'Mechanical', description: 'Replace water heater' }), true);
  });

  it('flattens permitsByParcel', () => {
    const rows = flattenParcelMap({
      A1: [{ permitNumber: '1', type: 'Plumbing' }],
      B2: [{ permitNumber: '2', type: 'Roof' }],
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].parcelId, 'A1');
  });

  it('matches by parcel id', () => {
    const hits = matchRows(
      [
        { parcelId: '00-43-44-01', address: '100 Main St', type: 'Plumbing' },
        { parcelId: '999', address: '200 Oak', type: 'Roof' },
      ],
      { pcn: '00434401', address: '100 Main St, City' }
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].type, 'Plumbing');
  });

  it('matches street across St/Street and city suffix', () => {
    assert.equal(streetCore('1100 25TH ST, WEST PALM BEACH FL'), '1100 25TH');
    const hits = matchRows(
      [{ parcelId: 'x', address: '1100 25TH STREET', type: 'Plumbing' }],
      { address: '1100 25TH ST West Palm Beach FL 33407' }
    );
    assert.equal(hits.length, 1);
  });

  it('activeCities skips sample scope', () => {
    const cities = activeCities({
      coverage: [
        { slug: 'west-palm-beach', status: 'active', dataFile: 'x', scope: '90-day' },
        { slug: 'boynton', status: 'stale', dataFile: 'y', scope: 'Sample illustrative' },
        { slug: 'palm-beach', status: 'active', dataFile: 'z', scope: 'Sample illustrative permits' },
      ],
    });
    assert.equal(cities.length, 1);
    assert.equal(cities[0].slug, 'west-palm-beach');
  });

  it('enriches equipment age from yearBuilt', () => {
    const out = enrichEquipmentWithYearBuilt(
      { status: 'unavailable', data: null, message: 'none' },
      1975
    );
    assert.equal(out.status, 'live');
    assert.equal(out.data.propertyYearBuilt, 1975);
    assert.ok(out.data.propertyAgeYears > 40);
  });
});

describe('spi-opportunities', () => {
  it('scores aging home without plumbing permits', () => {
    const out = assembleOpportunities({
      parcel: { data: { yearBuilt: 1960 } },
      permits: { data: { plumbing: [], coverageWindow: [{ slug: 'wpb' }] } },
      flood: { status: 'unavailable' },
    });
    assert.equal(out.label, 'research_hint');
    assert.ok(out.data.score >= 40);
    assert.ok(out.data.ranked.length >= 1);
    assert.match(out.disclaimer, /not confirmed jobs/i);
  });

  it('returns unavailable without inputs', () => {
    const out = assembleOpportunities({});
    assert.equal(out.status, 'unavailable');
  });

  it('reduces urgency when water heater permit present', () => {
    const base = assembleOpportunities({
      parcel: { data: { yearBuilt: 1980 } },
      permits: { data: { plumbing: [], coverageWindow: [] } },
    });
    const withWh = assembleOpportunities({
      parcel: { data: { yearBuilt: 1980 } },
      permits: {
        data: {
          plumbing: [{ type: 'Plumbing', description: 'water heater replacement' }],
          coverageWindow: [],
        },
      },
    });
    assert.ok(withWh.data.score < base.data.score);
  });
});

describe('assembleBuilding', () => {
  it('marks building type coming-soon when unsourced', () => {
    const g = assembleBuilding({
      status: 'live',
      source: 'gis',
      data: { yearBuilt: 1990, pcn: '1' },
    });
    assert.equal(g.status, 'coming-soon');
    assert.equal(g.data.yearBuilt, 1990);
  });

  it('works with auto-picked parcel that still lists candidates', () => {
    const g = assembleBuilding({
      status: 'live',
      source: 'gis',
      candidates: [{ pcn: '1' }, { pcn: '2' }],
      autoPicked: true,
      data: { yearBuilt: 1969, pcn: '1', address: '1100 25TH ST' },
    });
    assert.equal(g.status, 'coming-soon');
    assert.equal(g.data.yearBuilt, 1969);
  });
});

describe('address query hardening', () => {
  it('strips city/state/zip/unit', () => {
    assert.equal(
      stripUnitAndCity('1100 25TH ST, West Palm Beach, FL 33407'),
      '1100 25TH ST'
    );
    assert.equal(
      stripUnitAndCity('1100 25TH ST WEST PALM BEACH FL 33407'),
      '1100 25TH ST'
    );
    assert.equal(stripUnitAndCity('100 Main St Apt 2B'), '100 Main St');
  });

  it('builds St/Street variants', () => {
    const v = addressQueryVariants('1100 25TH STREET, West Palm Beach FL');
    assert.ok(v.includes('1100 25TH ST') || v.includes('1100 25TH STREET'));
    assert.ok(v.some((x) => x.includes('1100 25TH')));
    assert.ok(v[0].length <= v[v.length - 1].length);
  });

  it('normalizes street keys across suffix', () => {
    assert.equal(normalizeStreetKey('1100 25TH STREET'), normalizeStreetKey('1100 25TH ST'));
  });

  it('auto-picks when same site address', () => {
    const picked = pickPrimaryParcel(
      [
        { pcn: null, address: '1100 25TH ST', yearBuilt: 1969, owner: 'A' },
        { pcn: 'ABC', address: '1100 25TH STREET', yearBuilt: 1969, owner: 'A' },
      ],
      '1100 25TH ST'
    );
    assert.ok(picked);
    assert.equal(picked.primary.pcn, 'ABC');
    assert.equal(picked.reason, 'same_site_address');
  });

  it('resolvedPrimary ignores unresolved multi-match bags', () => {
    assert.equal(resolvedPrimary({ data: { parcels: [{ pcn: '1' }] } }), null);
    assert.equal(resolvedPrimary({ data: { pcn: '1', address: 'x' } }).pcn, '1');
  });
});
