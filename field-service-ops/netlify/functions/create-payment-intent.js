const { json, requireUser, requireShopMember, parseBody, cleanEnv } = require('./_lib/config');
const { buildPaymentIntentParams } = require('./_lib/payments');
const { getStripe } = require('./_lib/stripe');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const body = parseBody(event);
    const { shopId, invoiceId, jobId, amountCents } = body;
    if (!shopId || !invoiceId || !jobId) {
      return json(400, { error: 'missing_fields' });
    }

    // Always require a bearer token (demo path still needs auth header present).
    const token = require('./_lib/config').getBearer(event);
    if (!token) return json(401, { error: 'unauthorized' });

    const stripe = getStripe();
    if (!stripe) {
      try {
        buildPaymentIntentParams({
          amountCents: amountCents || 1000,
          shopId,
          invoiceId,
          jobId,
          connectAccountId: body.connectAccountId || 'acct_demo',
        });
        return json(200, { clientSecret: 'pi_demo_secret', demo: true });
      } catch (e) {
        return json(400, { error: e.code || 'bad_request', message: e.message });
      }
    }

    const { user, admin } = await requireUser(event);
    await requireShopMember(admin, user.id, shopId);

    const { data: shop, error: shopErr } = await admin
      .from('shops')
      .select('id, stripe_connect_account_id')
      .eq('id', shopId)
      .maybeSingle();
    if (shopErr || !shop) return json(404, { error: 'shop_not_found' });

    const { data: invoice, error: invErr } = await admin
      .from('invoices')
      .select('id, shop_id, job_id')
      .eq('id', invoiceId)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (invErr || !invoice || invoice.job_id !== jobId) {
      return json(404, { error: 'invoice_not_found' });
    }

    const params = buildPaymentIntentParams({
      amountCents,
      shopId,
      invoiceId,
      jobId,
      connectAccountId: shop.stripe_connect_account_id,
    });
    const { stripeAccount, ...piParams } = params;
    const pi = await stripe.paymentIntents.create(piParams, { stripeAccount });

    await admin.from('payments').insert({
      shop_id: shopId,
      invoice_id: invoiceId,
      job_id: jobId,
      amount_cents: amountCents,
      status: 'pending',
      stripe_payment_intent_id: pi.id,
    });

    return json(200, {
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      stripeAccount,
      publishableKey: cleanEnv('STRIPE_PUBLISHABLE_KEY') || null,
    });
  } catch (e) {
    const status = e.statusCode || 500;
    return json(status, { error: e.message || 'server_error' });
  }
};
