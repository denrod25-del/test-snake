// netlify/functions/sync-subscription.js
// Pull the user's Stripe subscription and update Supabase (fallback when webhook
// is not configured or missed an event).

const Stripe = require('stripe');
const {
  createWorkingSupabaseAdminClient,
  cleanEnv,
  verifyAccessToken,
} = require('./_lib/config');
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

    let supabase;
    let supabaseUrl;
    try {
      const working = await createWorkingSupabaseAdminClient();
      supabase = working.client;
      supabaseUrl = working.url;
    } catch (err) {
      console.error('supabase admin connect failed', err);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Could not reach Supabase',
          detail: err.message,
          hint: 'In Netlify → Environment variables, set SUPABASE_URL to https://wmkbksqztpofxoqbyrdd.supabase.co and SUPABASE_SERVICE_KEY to the service_role/secret key, then redeploy.',
        }),
      };
    }

    let { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .maybeSingle();

    // Auto-create profile if trigger missed it (common after project restore)
    if (!profile && (!profileErr || profileErr.code === 'PGRST116')) {
      const { data: created, error: upsertErr } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email || null,
          full_name: user.user_metadata?.full_name || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
        .select('stripe_customer_id, email')
        .maybeSingle();
      if (upsertErr) {
        console.error('profile upsert failed', upsertErr);
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: 'Could not create profile',
            detail: upsertErr.message,
            supabaseUrl,
          }),
        };
      }
      profile = created || { stripe_customer_id: null, email: user.email || null };
      profileErr = null;
    }

    if (profileErr) {
      console.error('profile lookup failed', profileErr);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Could not load profile',
          detail: profileErr.message,
          supabaseUrl,
        }),
      };
    }

    const stripe = Stripe(stripeKey);
    const result = await syncSubscriptionForUser(
      supabase,
      stripe,
      user.id,
      user.email || profile?.email,
      profile?.stripe_customer_id
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...result, supabaseUrl }),
    };
  } catch (err) {
    console.error('sync-subscription error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
