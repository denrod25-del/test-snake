// netlify/functions/sync-subscription.js
// Pull the user's Stripe subscription and update Supabase (fallback when webhook
// is not configured or missed an event).

const Stripe = require('stripe');
const { createSupabaseAdminClient, cleanEnv, verifyAccessToken } = require('./_lib/config');
const { syncSubscriptionForUser } = require('./_lib/stripe-sync');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { accessToken } = JSON.parse(event.body || '{}');
    if (!accessToken) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessToken' }) };
    }

    const { user, error: authErr } = await verifyAccessToken(accessToken);
    if (authErr || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };
    }

    const stripeKey = cleanEnv('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }) };
    }

    const supabase = createSupabaseAdminClient();
    const stripe = Stripe(stripeKey);

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    const result = await syncSubscriptionForUser(
      supabase,
      stripe,
      user.id,
      profile?.stripe_customer_id
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('sync-subscription error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
