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

const { createSupabaseAdminClient, verifyAccessToken } = require('./config');

let _client = null;
function client() {
  if (_client) return _client;
  _client = createSupabaseAdminClient();
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
  const { user, error } = await verifyAccessToken(token);
  if (error || !user) return { error: json(401, { error: 'Invalid session' }) };
  return { user, body };
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
    .maybeSingle();
  return data || null;
}

/**
 * Ensure Pro users have skip-trace + AVM credit buckets. Heals accounts that
 * were marked Pro without a Stripe webhook (or with monthly_grant=0).
 */
async function ensureProCredits(userId) {
  const skipGrant = Number(process.env.PRO_SKIP_TRACE_GRANT || 50);
  const avmGrant = Number(process.env.PRO_AVM_GRANT || 200);
  const sb = client();

  const { error: rpcErr } = await sb.rpc('ensure_credit_buckets', {
    p_user_id: userId,
    p_skip_grant: skipGrant,
    p_avm_grant: avmGrant,
  });
  if (rpcErr) console.warn('ensure_credit_buckets', rpcErr.message);

  for (const [creditType, grant] of [
    ['skip_trace', skipGrant],
    ['avm', avmGrant],
  ]) {
    const bal = await getBalance(userId, creditType);
    if (!bal) {
      const { error } = await sb.from('data_credits').upsert(
        {
          user_id: userId,
          credit_type: creditType,
          balance: grant,
          monthly_grant: grant,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,credit_type' }
      );
      if (error) console.warn('data_credits upsert', creditType, error.message);
      continue;
    }
    // Heal zeroed grant rows left by incomplete provisioning.
    if ((bal.monthly_grant == null || bal.monthly_grant === 0) && (bal.balance == null || bal.balance === 0)) {
      const { error } = await sb
        .from('data_credits')
        .update({
          balance: grant,
          monthly_grant: grant,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('credit_type', creditType);
      if (error) console.warn('data_credits heal', creditType, error.message);
    } else if (bal.monthly_grant == null || bal.monthly_grant === 0) {
      const { error } = await sb
        .from('data_credits')
        .update({
          monthly_grant: grant,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('credit_type', creditType);
      if (error) console.warn('data_credits grant heal', creditType, error.message);
    }
  }
}

/**
 * Refund a credit (insert a +1 row, increment balance). Used when the
 * vendor API call fails AFTER we deducted — so the user isn't penalized
 * for our infrastructure errors.
 */
async function refundCredit(userId, creditType, reason = 'vendor_error') {
  const sb = client();
  const { data: bucket } = await sb
    .from('data_credits')
    .select('balance')
    .eq('user_id', userId)
    .eq('credit_type', creditType)
    .maybeSingle();
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
  ensureProCredits,
};
