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
  const { data, error } = await sb
    .from('data_credits')
    .select('balance, monthly_grant, last_refilled')
    .eq('user_id', userId)
    .eq('credit_type', creditType)
    .maybeSingle();
  if (error) {
    console.error('getBalance', creditType, error.message);
    return null;
  }
  return data || null;
}

/** Positive monthly grant from env, with a safe default (ignores 0 / NaN). */
function creditGrant(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Ensure Pro users have skip-trace + AVM credit buckets. Heals accounts that
 * were marked Pro without a Stripe webhook, or where the old
 * ensure_credit_buckets RPC set monthly_grant but left balance at 0.
 * Returns { ok, errors: string[] }.
 */
async function ensureProCredits(userId) {
  const skipGrant = creditGrant('PRO_SKIP_TRACE_GRANT', 50);
  const avmGrant = creditGrant('PRO_AVM_GRANT', 200);
  const sb = client();
  const now = new Date().toISOString();
  const errors = [];

  // Best-effort RPC (may be outdated / missing in Supabase).
  const { error: rpcErr } = await sb.rpc('ensure_credit_buckets', {
    p_user_id: userId,
    p_skip_grant: skipGrant,
    p_avm_grant: avmGrant,
  });
  if (rpcErr) {
    console.warn('ensure_credit_buckets', rpcErr.message);
    errors.push(`rpc: ${rpcErr.message}`);
  }

  for (const [creditType, grant] of [
    ['skip_trace', skipGrant],
    ['avm', avmGrant],
  ]) {
    const bal = await getBalance(userId, creditType);
    const balance = bal ? Number(bal.balance) || 0 : 0;
    const monthlyGrant = bal ? Number(bal.monthly_grant) || 0 : 0;
    const neverFilled = !bal || (balance === 0 && !bal.last_refilled);
    const zeroedBroken = balance === 0 && monthlyGrant === 0;

    // Skip healthy buckets (including legitimately exhausted: balance 0 + last_refilled set + grant > 0).
    if (bal && !neverFilled && !zeroedBroken && monthlyGrant > 0) continue;

    const nextBalance = neverFilled || zeroedBroken ? grant : balance;
    const row = {
      user_id: userId,
      credit_type: creditType,
      balance: nextBalance,
      monthly_grant: grant,
      last_refilled: neverFilled || zeroedBroken ? now : bal.last_refilled,
      updated_at: now,
    };

    const { error } = await sb.from('data_credits').upsert(row, {
      onConflict: 'user_id,credit_type',
    });
    if (!error) continue;

    console.error('data_credits heal failed', creditType, error.message);
    errors.push(`upsert ${creditType}: ${error.message}`);

    if (!bal) {
      const { error: insErr } = await sb.from('data_credits').insert(row);
      if (insErr) {
        console.error('data_credits insert failed', creditType, insErr.message);
        errors.push(`insert ${creditType}: ${insErr.message}`);
      }
      continue;
    }

    const { error: updErr } = await sb
      .from('data_credits')
      .update({
        balance: nextBalance,
        monthly_grant: grant,
        last_refilled: neverFilled || zeroedBroken ? now : bal.last_refilled,
        updated_at: now,
      })
      .eq('user_id', userId)
      .eq('credit_type', creditType);
    if (updErr) {
      console.error('data_credits update failed', creditType, updErr.message);
      errors.push(`update ${creditType}: ${updErr.message}`);
    }
  }

  return { ok: errors.length === 0, errors };
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
  creditGrant,
};
