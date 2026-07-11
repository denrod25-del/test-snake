// Shared Stripe → Supabase subscription sync used by webhook + on-demand sync.
const PRO_SKIP_TRACE_GRANT = Number(process.env.PRO_SKIP_TRACE_GRANT || 50);
const PRO_AVM_GRANT = Number(process.env.PRO_AVM_GRANT || 200);

async function resolveStripeCustomerId(supabase, stripe, userId, email) {
  // 1) Prefer customer stamped with this Supabase user id
  try {
    const search = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${userId}'`,
      limit: 1,
    });
    if (search.data[0]?.id) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: search.data[0].id, updated_at: new Date().toISOString() })
        .eq('id', userId);
      return search.data[0].id;
    }
  } catch (err) {
    console.warn('customer search by metadata failed', err.message);
  }

  // 2) Fall back to email match (prefer metadata match among email hits)
  if (email) {
    try {
      const byEmail = await stripe.customers.list({ email, limit: 10 });
      const customer =
        byEmail.data.find((c) => c.metadata?.supabase_user_id === userId) ||
        byEmail.data[0];

      if (customer?.id) {
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
          .eq('id', userId);
        return customer.id;
      }
    } catch (err) {
      console.warn('customer list by email failed', err.message);
    }
  }

  // 3) Last resort: recent checkout sessions tagged with this user
  try {
    const sessions = await stripe.checkout.sessions.list({ limit: 25 });
    const hit = sessions.data.find(
      (s) =>
        s.metadata?.supabase_user_id === userId &&
        s.customer &&
        (s.mode === 'subscription' || s.subscription)
    );
    if (hit?.customer) {
      const customerId = typeof hit.customer === 'string' ? hit.customer : hit.customer.id;
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', userId);
      return customerId;
    }
  } catch (err) {
    console.warn('checkout session fallback failed', err.message);
  }

  return null;
}

function subscriptionPeriodEnd(subscription) {
  const end = subscription.current_period_end
    || subscription.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

async function applySubscriptionToProfile(supabase, userId, subscription) {
  const isActive = ['active', 'trialing'].includes(subscription.status);
  const update = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_plan: isActive ? 'pro' : 'free',
    current_period_end: subscriptionPeriodEnd(subscription),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) throw error;

  if (isActive) {
    const { error: rpcErr } = await supabase.rpc('ensure_credit_buckets', {
      p_user_id: userId,
      p_skip_grant: PRO_SKIP_TRACE_GRANT,
      p_avm_grant: PRO_AVM_GRANT,
    });
    if (rpcErr) console.warn('ensure_credit_buckets skipped', rpcErr.message);
  }

  return update;
}

async function resolveUserId(supabase, subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (userId) return userId;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single();
  return profile?.id || null;
}

async function syncSubscriptionForUser(supabase, stripe, userId, email, stripeCustomerId) {
  let customerId = stripeCustomerId;
  if (!customerId) {
    customerId = await resolveStripeCustomerId(supabase, stripe, userId, email);
  }
  if (!customerId) {
    return {
      synced: false,
      reason: 'no_stripe_customer',
      message:
        'No Stripe customer linked to this account yet. Sign out, sign in, then subscribe again from the live site — or confirm the payment email matches your DeedScout login email.',
    };
  }

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });

  const subscription =
    subs.data.find((s) => ['active', 'trialing'].includes(s.status)) ||
    subs.data[0];

  if (!subscription) {
    return {
      synced: false,
      reason: 'no_subscription',
      plan: 'free',
      status: 'free',
      message:
        'Stripe customer found but no subscription. In Stripe Dashboard → Customers, confirm a paid Pro subscription exists for this email (test vs live mode must match Netlify STRIPE_SECRET_KEY).',
    };
  }

  if (!subscription.metadata?.supabase_user_id) {
    try {
      await stripe.subscriptions.update(subscription.id, {
        metadata: { supabase_user_id: userId },
      });
      subscription.metadata = subscription.metadata || {};
      subscription.metadata.supabase_user_id = userId;
    } catch (err) {
      console.warn('could not stamp subscription metadata', err.message);
    }
  }

  const update = await applySubscriptionToProfile(supabase, userId, subscription);
  const isActive = update.subscription_plan === 'pro';
  return {
    synced: isActive,
    plan: update.subscription_plan,
    status: update.subscription_status,
    reason: isActive ? 'ok' : 'subscription_not_active',
    message: isActive
      ? 'Subscription synced from Stripe — you are Pro.'
      : `Stripe subscription status is "${update.subscription_status}" (need active or trialing). Open Stripe → Subscriptions to confirm payment completed.`,
  };
}

module.exports = {
  applySubscriptionToProfile,
  resolveUserId,
  resolveStripeCustomerId,
  syncSubscriptionForUser,
};
