const { json, createAdminClient, cleanEnv } = require('./_lib/config');
const { assertWebhookBinding, mapPaymentStatus, jobPaymentStatusFromPayments } = require('./_lib/payments');
const { getStripe } = require('./_lib/stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  const stripe = getStripe();
  const secret = cleanEnv('STRIPE_WEBHOOK_SECRET');
  if (!stripe || !secret) {
    return json(200, { received: true, demo: true });
  }

  let stripeEvent;
  try {
    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, secret);
  } catch (e) {
    return json(400, { error: 'invalid_signature', message: e.message });
  }

  if (!String(stripeEvent.type || '').startsWith('payment_intent.')) {
    return json(200, { received: true, ignored: true });
  }

  const pi = stripeEvent.data.object;
  const meta = pi.metadata || {};
  const shopId = meta.shop_id;
  const invoiceId = meta.invoice_id;
  const jobId = meta.job_id;
  if (!shopId || !invoiceId || !jobId) {
    return json(200, { received: true, skipped: 'missing_metadata' });
  }

  try {
    const admin = createAdminClient();
    const { data: shop } = await admin
      .from('shops')
      .select('stripe_connect_account_id')
      .eq('id', shopId)
      .maybeSingle();

    const bind = assertWebhookBinding(stripeEvent, {
      shopConnectAccountId: shop?.stripe_connect_account_id,
      invoiceId,
      shopId,
    });
    if (!bind.ok) {
      return json(400, { error: 'binding_failed', reason: bind.reason });
    }

    const status = mapPaymentStatus(pi.status);
    const { data: existing } = await admin
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle();

    if (existing) {
      await admin.from('payments').update({ status }).eq('id', existing.id);
    } else {
      await admin.from('payments').insert({
        shop_id: shopId,
        invoice_id: invoiceId,
        job_id: jobId,
        amount_cents: pi.amount_received || pi.amount || 0,
        status,
        stripe_payment_intent_id: pi.id,
      });
    }

    const { data: lines } = await admin.from('invoice_lines').select('quantity, unit_amount_cents').eq('invoice_id', invoiceId);
    const total = (lines || []).reduce(
      (sum, l) => sum + Math.round(Number(l.quantity) * Number(l.unit_amount_cents)),
      0,
    );
    const { data: pays } = await admin.from('payments').select('amount_cents, status').eq('invoice_id', invoiceId);
    const paymentStatus = jobPaymentStatusFromPayments(total, pays || []);
    await admin.from('jobs').update({ payment_status: paymentStatus }).eq('id', jobId).eq('shop_id', shopId);

    return json(200, { received: true, paymentStatus });
  } catch (e) {
    return json(500, { error: e.message || 'server_error' });
  }
};
