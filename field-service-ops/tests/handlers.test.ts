import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('create-public-request handler', () => {
  it('rejects client shop_id', async () => {
    const { handler } = require('../netlify/functions/create-public-request.js');
    const res = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ slug: 'dogfood', shopId: 'forged' }),
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('forged_shop_id');
  });

  it('requires auth on payment intent', async () => {
    const { handler } = require('../netlify/functions/create-payment-intent.js');
    const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
    expect(res.statusCode).toBe(401);
  });

  it('requires auth on briefing proxy', async () => {
    const { handler } = require('../netlify/functions/property-briefing-proxy.js');
    const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
    expect(res.statusCode).toBe(401);
  });
});
