// Shared Stripe → Supabase subscription sync used by webhook + on-demand sync.
const PRO_SKIP_TRACE_GRANT = Number(process.env.PRO_SKIP_TRACE_GRANT || 50);
const PRO_AVM_GRANT = Number(process.env.PRO_AVM_GRANT || 200);

async function applySubscriptionToProfile(supabase, userId, subscription) {
  const isActive = ['active', 'trialing'].includes(subscription.status);
  const update = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_plan: isActive ? 'pro' : 'free',
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
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

async function syncSubscriptionForUser(supabase, stripe, userId, stripeCustomerId) {
  if (!stripeCustomerId) {
    return { synced: false, reason: 'no_stripe_customer' };
  }

  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 10,
  });

  const subscription =
    subs.data.find((s) => ['active', 'trialing'].includes(s.status)) ||
    subs.data[0];

  if (!subscription) {
    return { synced: false, reason: 'no_subscription', plan: 'free', status: 'free' };
  }

  if (!subscription.metadata?.supabase_user_id) {
    try {
      await stripe.subscriptions.update(subscription.id, {
        metadata: { supabase_user_id: userId },
      });
    } catch (err) {
      console.warn('could not stamp subscription metadata', err.message);
    }
  }

  const update = await applySubscriptionToProfile(supabase, userId, subscription);
  return {
    synced: true,
    plan: update.subscription_plan,
    status: update.subscription_status,
  };
}

module.exports = {
  applySubscriptionToProfile,
  resolveUserId,
  syncSubscriptionForUser,
};
