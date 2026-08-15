import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handler, handlePropertyBriefing } = require('../../netlify/functions/property-briefing.js');

describe('property-briefing handler', () => {
  it('handles OPTIONS and rejects non-GET', async () => {
    const opt = await handler({ httpMethod: 'OPTIONS', headers: {} });
    assert.equal(opt.statusCode, 204);
    const bad = await handler({ httpMethod: 'POST', headers: {} });
    assert.equal(bad.statusCode, 405);
  });

  it('rejects missing API key', async () => {
    const res = await handler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: { address: '100 Main St' },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(JSON.parse(res.body).error, 'missing_api_key');
  });

  it('rejects missing address when authenticated', async () => {
    const res = await handlePropertyBriefing(
      { httpMethod: 'GET', headers: { 'x-api-key': 'x' }, queryStringParameters: {} },
      {
        requireShopApiKey: async () => ({ shop: { id: 's1', name: 'Test Shop' } }),
      }
    );
    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error, 'missing_address');
  });

  it('returns briefing with Coming Soon water/sewer (AE2)', async () => {
    const res = await handlePropertyBriefing(
      {
        httpMethod: 'GET',
        headers: { 'x-api-key': 'x' },
        queryStringParameters: { address: '1 Test St' },
      },
      {
        requireShopApiKey: async () => ({ shop: { id: 's1', name: 'Test Shop' } }),
        assembleParcel: async () => ({
          status: 'live',
          source: 'gis',
          data: {
            pcn: '123',
            address: '1 Test St',
            yearBuilt: 1970,
            centroid: { lon: -80.1, lat: 26.7 },
            countySlug: 'palm-beach',
          },
        }),
        assembleFlood: async () => ({
          status: 'live',
          source: 'flood',
          data: { zone: 'X', sfha: 'F' },
        }),
        assemblePermits: async () => ({
          permits: {
            status: 'cached',
            source: 'wpb',
            data: {
              coverageWindow: [{ slug: 'west-palm-beach', note: '90-day' }],
              plumbing: [],
              other: [],
              matchCount: 0,
            },
          },
          equipmentAge: { status: 'unavailable', data: null },
        }),
      }
    );
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.groups.waterSewer.status, 'coming-soon');
    assert.equal(body.groups.opportunities.label, 'research_hint');
    assert.ok(body.links.propertyIntelligence);
  });
});
