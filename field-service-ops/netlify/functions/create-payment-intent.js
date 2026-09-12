const { json, getBearer } = require('./_lib/config');
const { buildPaymentIntentParams } = require('./_lib/payments');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  const token = getBearer(event);
  if (!token) return json(401, { error: 'unauthorized' });

  // Demo/local: without Stripe keys, return a deterministic client secret shape for UI wiring.
  if (!process.env.STRIPE_SECRET_KEY) {
    try {
      const body = JSON.parse(event.body || '{}');
      buildPaymentIntentParams({
        amountCents: body.amountCents || 1000,
        shopId: body.shopId || 'shop',
        invoiceId: body.invoiceId || 'inv',
        jobId: body.jobId || 'job',
        connectAccountId: body.connectAccountId || null,
      });
      return json(200, { clientSecret: 'pi_demo_secret', demo: true });
    } catch (e) {
      return json(400, { error: e.code || 'bad_request', message: e.message });
    }
  }

  return json(501, {
    error: 'not_wired',
    message: 'Wire Supabase JWT verify + Stripe SDK using _lib/payments.buildPaymentIntentParams',
  });
};
