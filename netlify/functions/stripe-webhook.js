// netlify/functions/stripe-webhook.js
// ----------------------------------------------------------------------------
// Receives Stripe webhook events and syncs subscription state into Supabase.
//
// Listen for these events in the Stripe Dashboard webhook config:
//   checkout.session.completed
//   checkout.session.async_payment_succeeded
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.payment_succeeded
//   invoice.payment_failed
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET    whsec_...  (from the Stripe webhook config)
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
//
// Endpoint (production): https://deedscout.app/api/stripe-webhook
// Without STRIPE_WEBHOOK_SECRET, Checkout still works but Pro status only
// updates when the user clicks "Refresh subscription status" (or the
// post-checkout poll in tax-deeds.html).
//
// IMPORTANT: This function relies on the raw request body for signature
// verification. Netlify passes event.body as a string for non-base64 payloads,
// which is what Stripe needs. Do NOT JSON.parse before verification.
// ----------------------------------------------------------------------------

const Stripe = require('stripe');
const { createSupabaseAdminClient, cleanEnv } = require('./_lib/config');
const { applySubscriptionToProfile, resolveUserId } = require('./_lib/stripe-sync');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripeKey = cleanEnv('STRIPE_SECRET_KEY');
  const webhookSecret = cleanEnv('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    console.error('Webhook misconfigured: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing');
    return { statusCode: 500, body: 'Webhook not configured' };
  }

  const stripe = Stripe(stripeKey);
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabase = createSupabaseAdminClient();

  async function syncSubscription(subscription) {
    const userId = await resolveUserId(supabase, subscription);
    if (!userId) {
      console.warn('No profile found for customer', subscription.customer);
      return null;
    }
    await applySubscriptionToProfile(supabase, userId, subscription);
    return userId;
  }

  async function refillCreditsFor(userId) {
    if (!userId) return;
    const { error } = await supabase.rpc('refill_monthly_credits', { p_user_id: userId });
    if (error) console.warn('refill_monthly_credits skipped', error.message);
  }

  async function syncFromCheckoutSession(session) {
    if (session.mode === 'subscription' && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      // Stamp the metadata on the subscription itself for future events
      if (!subscription.metadata?.supabase_user_id && session.metadata?.supabase_user_id) {
        await stripe.subscriptions.update(subscription.id, {
          metadata: { supabase_user_id: session.metadata.supabase_user_id }
        });
        subscription.metadata = subscription.metadata || {};
        subscription.metadata.supabase_user_id = session.metadata.supabase_user_id;
      }
      await syncSubscription(subscription);
    }
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        await syncFromCheckoutSession(stripeEvent.data.object);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(stripeEvent.data.object);
        break;

      case 'invoice.payment_succeeded': {
        const invoice = stripeEvent.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const userId = await syncSubscription(subscription);
          // Refill happens AFTER syncSubscription so the buckets exist on
          // first invoice (subscription.created may arrive after this event).
          await refillCreditsFor(userId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          await syncSubscription(subscription);
        }
        break;
      }

      default:
        // ignore other events
        break;
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: `Handler error: ${err.message}` };
  }
};
