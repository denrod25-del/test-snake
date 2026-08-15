// netlify/functions/_lib/shop-auth.js
// Shop API key auth for Service Property Intelligence (not Pro JWT).
const crypto = require('crypto');
const { createSupabaseAdminClient, cleanEnv } = require('./config');

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function extractShopApiKey(event) {
  const headers = event.headers || {};
  const xKey = headers['x-api-key'] || headers['X-Api-Key'];
  if (xKey && String(xKey).trim()) return String(xKey).trim();
  const auth = headers.authorization || headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m) return m[1].trim();
  return null;
}

function pepper() {
  return cleanEnv('SHOP_API_KEY_PEPPER') || '';
}

function hashShopApiKey(plaintext) {
  const raw = pepper() + String(plaintext || '');
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

function keyPrefix(plaintext) {
  const s = String(plaintext || '');
  return s.slice(0, Math.min(12, s.length));
}

/**
 * @returns {{ shop: object } | { error: object }}
 */
async function requireShopApiKey(event, opts = {}) {
  const plaintext = extractShopApiKey(event);
  if (!plaintext) {
    return {
      error: json(401, {
        error: 'missing_api_key',
        message: 'Provide X-Api-Key or Authorization: Bearer <shop-api-key>.',
      }, opts.corsHeaders),
    };
  }

  let sb;
  try {
    sb = opts.supabase || createSupabaseAdminClient();
  } catch (err) {
    console.error('shop-auth misconfigured', err?.message || err);
    return {
      error: json(503, {
        error: 'auth_misconfigured',
        message: 'Shop API auth is not configured on this server yet.',
      }, opts.corsHeaders),
    };
  }

  const digest = hashShopApiKey(plaintext);
  const { data, error } = await sb
    .from('shop_api_keys')
    .select('id, shop_name, key_prefix, active')
    .eq('key_hash', digest)
    .maybeSingle();

  if (error) {
    const missing = /relation|does not exist|42P01/i.test(error.message || '');
    console.error('shop_api_keys lookup failed', error.code || '', error.message || error);
    return {
      error: json(missing ? 503 : 500, {
        error: missing ? 'keys_table_missing' : 'auth_lookup_failed',
        message: missing
          ? 'shop_api_keys table is missing. Apply supabase/migrations/20260815_shop_api_keys.sql before issuing keys.'
          : 'Could not verify shop API key.',
      }, opts.corsHeaders),
    };
  }

  if (!data || !data.active) {
    return {
      error: json(401, {
        error: 'invalid_api_key',
        message: 'Invalid or inactive shop API key.',
      }, opts.corsHeaders),
    };
  }

  // Best-effort last_used — never log plaintext key
  try {
    await sb
      .from('shop_api_keys')
      .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', data.id);
  } catch (e) {
    /* ignore */
  }

  return {
    shop: {
      id: data.id,
      name: data.shop_name,
      keyPrefix: data.key_prefix,
    },
  };
}

module.exports = {
  json,
  extractShopApiKey,
  hashShopApiKey,
  keyPrefix,
  requireShopApiKey,
  pepper,
};
