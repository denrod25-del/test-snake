// netlify/functions/_lib/auth.js
// ----------------------------------------------------------------------------
// Shared helpers for any Netlify function that needs to:
//   - verify the caller's Supabase JWT
//   - confirm they're an active Pro subscriber
//   - atomically deduct a credit before calling a paid third-party API
//
// All functions that touch a paid vendor (BatchData, RentCast, etc.) MUST
// route their auth + spend through this module. Never trust client-side
// "isPro" hints for spending decisions.
// ----------------------------------------------------------------------------

const { createClient } = require('@supabase/supabase-js');

let _client = null;
function client() {
  if (_client) return _client;
  _client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return _client;
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const corsPreflight = () => ({
  statusCode: 204,
  headers: {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  },
  body: '',
});

/**
 * Pull the access token from the request body (preferred) or Authorization
 * header. Returns { token, body } or { error: 401-shaped object }.
 */
function extractAccessToken(event) {
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch { /* swallow */ }
  let token = body.accessToken;
  if (!token) {
    const auth = event.headers?.authorization || event.headers?.Authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (m) token = m[1];
  }
  return { token, body };
}

/**
 * Verify the JWT and return the user record. Returns { user } on success,
 * or { error: <Netlify response> } on failure.
 */
async function authenticate(event) {
  const { token, body } = extractAccessToken(event);
  if (!token) return { error: json(401, { error: 'Missing access token' }) };
  const sb = client();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return { error: json(401, { error: 'Invalid session' }) };
  return { user: data.user, body };
}

/**
 * Same as authenticate, but additionally requires an active Pro subscription.
 */
async function requirePro(event) {
  const { user, body, error } = await authenticate(event);
  if (error) return { error };
  const sb = client();
  const { data: profile } = await sb
    .from('profiles')
    .select('subscription_plan, subscription_status')
    .eq('id', user.id)
    .single();
  const isPro = profile?.subscription_plan === 'pro'
    && ['active', 'trialing'].includes(profile?.subscription_status);
  if (!isPro) return { error: json(402, {
    error: 'pro_required',
    message: 'This feature requires an active Pro subscription.',
  }) };
  return { user, body };
}

/**
 * Atomically deduct one credit of `creditType` for `userId`. Returns true if
 * spent, false if the user is out of credits. The associated ledger row
 * carries the optional `context` payload for audit/debug.
 */
async function spendCredit(userId, creditType, context = {}) {
  const sb = client();
  const { data, error } = await sb.rpc('spend_credit', {
    p_user_id:     userId,
    p_credit_type: creditType,
    p_context:     context,
  });
  if (error) {
    console.error('spend_credit RPC failed', error);
    return false;
  }
  return data === true;
}

/**
 * Look up the user's current balance for a credit type. Returns null if
 * they have no bucket (i.e. not a Pro subscriber yet).
 */
async function getBalance(userId, creditType) {
  const sb = client();
  const { data } = await sb
    .from('data_credits')
    .select('balance, monthly_grant, last_refilled')
    .eq('user_id', userId)
    .eq('credit_type', creditType)
    .single();
  return data || null;
}

/**
 * Refund a credit (insert a +1 row, increment balance). Used when the
 * vendor API call fails AFTER we deducted — so the user isn't penalized
 * for our infrastructure errors.
 */
async function refundCredit(userId, creditType, reason = 'vendor_error') {
  const sb = client();
  // Re-fetch balance for the ledger entry; not perfectly atomic but close
  // enough for a rare error path.
  const { data: bucket } = await sb
    .from('data_credits')
    .select('balance')
    .eq('user_id', userId)
    .eq('credit_type', creditType)
    .single();
  if (!bucket) return false;
  const newBalance = (bucket.balance || 0) + 1;
  await sb
    .from('data_credits')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('credit_type', creditType);
  await sb.from('credit_ledger').insert({
    user_id: userId,
    credit_type: creditType,
    delta: 1,
    reason,
    balance_after: newBalance,
  });
  return true;
}

module.exports = {
  client,
  json,
  corsPreflight,
  authenticate,
  requirePro,
  spendCredit,
  refundCredit,
  getBalance,
};
