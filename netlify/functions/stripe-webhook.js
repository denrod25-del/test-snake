// netlify/functions/stripe-webhook.js
// ----------------------------------------------------------------------------
// Receives Stripe webhook events and syncs subscription state into Supabase.
//
// Listen for these events in the Stripe Dashboard webhook config:
//   checkout.session.completed
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
//   invoice.payment_failed
//
// Required env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET    whsec_...  (from the Stripe webhook config)
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
//
// IMPORTANT: This function relies on the raw request body for signature
// verification. Netlify passes event.body as a string for non-base64 payloads,
// which is what Stripe needs. Do NOT JSON.parse before verification.
// ----------------------------------------------------------------------------

const Stripe = require('stripe');
const { createSupabaseAdminClient } = require('./_lib/config');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabase = createSupabaseAdminClient();

  // Monthly grants for Pro subscribers — kept here so the migration and the
  // webhook can't drift. Bump these together if you change the bundle.
  const PRO_SKIP_TRACE_GRANT = Number(process.env.PRO_SKIP_TRACE_GRANT || 50);
  const PRO_AVM_GRANT        = Number(process.env.PRO_AVM_GRANT        || 200);

  async function resolveUserId(subscription) {
    const userId = subscription.metadata?.supabase_user_id;
    if (userId) return userId;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single();
    return profile?.id || null;
  }

  async function syncSubscription(subscription) {
    const userId = await resolveUserId(subscription);
    if (!userId) {
      console.warn('No profile found for customer', subscription.customer);
      return null;
    }

    const isActive = ['active', 'trialing'].includes(subscription.status);
    const update = {
      stripe_subscription_id: subscription.id,
      subscription_status:    subscription.status,
      subscription_plan:      isActive ? 'pro' : 'free',
      current_period_end:     new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at:             new Date().toISOString()
    };

    await supabase.from('profiles').update(update).eq('id', userId);

    // First-time Pro upgrade → create the credit buckets so we have
    // somewhere to refill into. Idempotent (ON CONFLICT in the RPC).
    if (isActive) {
      await supabase.rpc('ensure_credit_buckets', {
        p_user_id:     userId,
        p_skip_grant:  PRO_SKIP_TRACE_GRANT,
        p_avm_grant:   PRO_AVM_GRANT,
      });
    }

    return userId;
  }

  async function refillCreditsFor(userId) {
    if (!userId) return;
    // RPC is idempotent within ~25 days, so it's safe to call on every paid
    // invoice (initial signup, renewal, retried-after-failure, etc.).
    const { error } = await supabase.rpc('refill_monthly_credits', { p_user_id: userId });
    if (error) console.error('refill_monthly_credits failed', error);
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
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
