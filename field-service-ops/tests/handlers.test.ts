import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('handlers auth gates', () => {
  it('rejects client shop_id on public request', async () => {
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
    const res = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ shopId: 's', invoiceId: 'i', jobId: 'j', amountCents: 1000 }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('requires auth on briefing proxy', async () => {
    const { handler } = require('../netlify/functions/property-briefing-proxy.js');
    const res = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ shopId: 's', jobId: 'j' }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('owner-only gate on set-spi-key without token', async () => {
    const { handler } = require('../netlify/functions/set-spi-key.js');
    const res = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ shopId: 's', spiKey: 'k' }),
    });
    expect(res.statusCode).toBe(401);
  });
});
