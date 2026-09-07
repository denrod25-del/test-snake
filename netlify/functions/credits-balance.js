// netlify/functions/credits-balance.js
// ----------------------------------------------------------------------------
// Returns the caller's current credit balances. Used by both the static HTML
// pages and the React app to show the "X skip-traces / Y AVM lookups left
// this month" badge.
//
// Request body:  { accessToken: "<supabase-jwt>" }
// Response (200):
//   {
//     skip_trace: { balance: 47, monthly_grant: 50, last_refilled: "2026-04-01..." } | null,
//     avm:        { balance: 198, monthly_grant: 200, last_refilled: "2026-04-01..." } | null,
//     isPro:      true
//   }
// ----------------------------------------------------------------------------

const { client, json, corsPreflight, authenticate, ensureProCredits } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreflight();
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return json(405, { error: 'method_not_allowed' });
  }

  const auth = await authenticate(event);
  if (auth.error) return auth.error;
  const { user } = auth;
  const sb = client();

  const { data: profile } = await sb
    .from('profiles')
    .select('subscription_plan, subscription_status')
    .eq('id', user.id)
    .single();
  const isPro = profile?.subscription_plan === 'pro'
    && ['active', 'trialing'].includes(profile?.subscription_status);

  if (isPro) await ensureProCredits(user.id);

  const { data: rows } = await sb
    .from('data_credits')
    .select('credit_type, balance, monthly_grant, last_refilled')
    .eq('user_id', user.id);

  const out = {
    isPro,
    skip_trace: null,
    avm: null,
    vendors: {
      skip_trace: Boolean(process.env.BATCHDATA_API_TOKEN),
      avm: Boolean(process.env.RENTCAST_API_KEY),
    },
  };
  for (const r of rows || []) {
    out[r.credit_type] = {
      balance:       r.balance,
      monthly_grant: r.monthly_grant,
      last_refilled: r.last_refilled,
    };
  }
  return json(200, out);
};
