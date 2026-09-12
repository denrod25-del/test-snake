const { json } = require('./_lib/config');
const { assertWebhookBinding, mapPaymentStatus } = require('./_lib/payments');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  // Signature verification required when STRIPE_WEBHOOK_SECRET is set.
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return json(200, { received: true, demo: true });
  }
  return json(501, {
    error: 'not_wired',
    message: 'Verify signature, then assertWebhookBinding + mapPaymentStatus before updating rows',
    helpers: { assertWebhookBinding: typeof assertWebhookBinding, mapPaymentStatus: typeof mapPaymentStatus },
  });
};
