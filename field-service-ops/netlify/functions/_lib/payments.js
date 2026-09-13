/**
 * Pure helpers for Connect payment intents / webhook binding (unit-tested).
 */

function buildPaymentIntentParams({ amountCents, currency, shopId, invoiceId, jobId, connectAccountId }) {
  if (!connectAccountId) {
    const err = new Error('Shop has no Connect account');
    err.code = 'NO_CONNECT';
    throw err;
  }
  if (!amountCents || amountCents < 50) {
    const err = new Error('Amount too small');
    err.code = 'AMOUNT';
    throw err;
  }
  return {
    amount: amountCents,
    currency: currency || 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { shop_id: shopId, invoice_id: invoiceId, job_id: jobId },
    // Direct charge on connected account — pass stripeAccount to stripe.paymentIntents.create
    stripeAccount: connectAccountId,
  };
}

function assertWebhookBinding(event, { shopConnectAccountId, invoiceId, shopId }) {
  const meta = (event.data && event.data.object && event.data.object.metadata) || {};
  const account = event.account || null;
  if (shopConnectAccountId && account && account !== shopConnectAccountId) {
    return { ok: false, reason: 'account_mismatch' };
  }
  if (meta.invoice_id && invoiceId && meta.invoice_id !== invoiceId) {
    return { ok: false, reason: 'invoice_mismatch' };
  }
  if (meta.shop_id && shopId && meta.shop_id !== shopId) {
    return { ok: false, reason: 'shop_mismatch' };
  }
  return { ok: true };
}

function mapPaymentStatus(stripeStatus) {
  if (stripeStatus === 'succeeded') return 'succeeded';
  if (stripeStatus === 'processing') return 'processing';
  if (stripeStatus === 'requires_payment_method' || stripeStatus === 'canceled') return 'failed';
  return 'pending';
}

function jobPaymentStatusFromPayments(totalCents, payments) {
  const list = payments || [];
  const applied = list
    .filter((p) => p.status === 'succeeded' || p.status === 'processing')
    .reduce((sum, p) => sum + (p.amount_cents || p.amountCents || 0), 0);
  if (applied <= 0) return 'unpaid';
  const anyProcessing = list.some((p) => p.status === 'processing');
  if (applied < totalCents) return anyProcessing ? 'processing' : 'partial';
  return anyProcessing ? 'processing' : 'paid';
}

module.exports = {
  buildPaymentIntentParams,
  assertWebhookBinding,
  mapPaymentStatus,
  jobPaymentStatusFromPayments,
};
