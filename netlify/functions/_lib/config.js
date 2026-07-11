// Shared Netlify env parsing for Supabase + Stripe server functions.
const { createClient } = require('@supabase/supabase-js');

function cleanEnv(name) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

const DEEDSCOUT_PROJECT_URL = 'https://wmkbksqztpofxoqbyrdd.supabase.co';
const DEEDSCOUT_PUBLISHABLE_KEY = 'sb_publishable_t2758aerT0VWEM5JxUJuLw_y5WScDjj';

function getSupabaseUrlCandidates() {
  const urls = [];
  // Prefer the known DeedScout project — Netlify SUPABASE_URL is often stale after restores.
  urls.push(DEEDSCOUT_PROJECT_URL);
  const raw = cleanEnv('SUPABASE_URL');
  if (raw) {
    let url = raw;
    if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/+/, '')}`;
    try {
      new URL(url);
      urls.push(url.replace(/\/+$/, ''));
    } catch { /* ignore bad env */ }
  }
  return [...new Set(urls)];
}

function getSupabaseUrl() {
  const urls = getSupabaseUrlCandidates();
  if (!urls.length) {
    throw new Error(
      'Server misconfigured: SUPABASE_URL is missing in Netlify env vars. Set it to https://YOUR-PROJECT.supabase.co (include https://), then redeploy.'
    );
  }
  return urls[0];
}

function getPublishableKeyCandidates() {
  const envKeys = [cleanEnv('SUPABASE_ANON_KEY'), cleanEnv('SUPABASE_PUBLISHABLE_KEY')].filter(Boolean);
  const safeEnvKeys = envKeys.filter((k) => !k.startsWith('sb_secret_'));
  return [...new Set([
    DEEDSCOUT_PUBLISHABLE_KEY,
    ...safeEnvKeys,
  ])];
}

function getSupabasePublishableKey() {
  return getPublishableKeyCandidates()[0];
}

function getSupabaseServiceKey() {
  const key = cleanEnv('SUPABASE_SERVICE_KEY') || cleanEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) {
    throw new Error(
      'Server misconfigured: SUPABASE_SERVICE_KEY is missing in Netlify env vars. Use the sb_secret_... or service_role key — not the publishable key.'
    );
  }
  if (key.startsWith('sb_publishable_')) {
    throw new Error(
      'Server misconfigured: SUPABASE_SERVICE_KEY must be the secret/service_role key, not the publishable key.'
    );
  }
  return key;
}

function createSupabasePublishableClient() {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function createSupabaseAdminClient(preferredUrl) {
  const urls = preferredUrl
    ? [preferredUrl, ...getSupabaseUrlCandidates()]
    : getSupabaseUrlCandidates();
  const key = getSupabaseServiceKey();
  const url = [...new Set(urls)][0];
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Try each project URL until profiles/auth responds (handles stale Netlify SUPABASE_URL). */
async function createWorkingSupabaseAdminClient() {
  const key = getSupabaseServiceKey();
  const errors = [];
  for (const url of getSupabaseUrlCandidates()) {
    try {
      const client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      // Lightweight REST probe — empty filter still hits PostgREST
      const { error } = await client.from('profiles').select('id').limit(1);
      if (!error || error.code === 'PGRST116' || /permission|jwt|row.level/i.test(error.message || '')) {
        // reachable (even if RLS/empty); use this URL
        return { client, url, probeError: error || null };
      }
      // "fetch failed" / ENOTFOUND → try next URL
      if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message || '')) {
        errors.push(`${url}: ${error.message}`);
        continue;
      }
      return { client, url, probeError: error };
    } catch (err) {
      errors.push(`${url}: ${err.message || err}`);
    }
  }
  throw new Error(
    'Could not reach Supabase from Netlify. Check SUPABASE_URL + SUPABASE_SERVICE_KEY. Tried: '
    + (errors.join(' | ') || 'no candidates')
  );
}

/** Verify a browser access token. Tries all known publishable keys + project URLs. */
async function verifyAccessToken(accessToken) {
  let lastError = null;
  for (const url of getSupabaseUrlCandidates()) {
    for (const key of getPublishableKeyCandidates()) {
      const client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await client.auth.getUser(accessToken);
      if (!error && data?.user) return { user: data.user, error: null };
      lastError = error;
    }
  }

  try {
    const admin = createSupabaseAdminClient();
    const adminResult = await admin.auth.getUser(accessToken);
    if (!adminResult.error && adminResult.data?.user) {
      return { user: adminResult.data.user, error: null };
    }
    return { user: null, error: adminResult.error || lastError };
  } catch (err) {
    return { user: null, error: lastError || err };
  }
}

function getSiteUrl(event) {
  const fromEnv = cleanEnv('PUBLIC_SITE_URL');
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = event?.headers?.host || event?.headers?.Host;
  return host ? `https://${host}` : 'https://deedscout.netlify.app';
}

/** Stripe success/cancel URLs must always hit production — not deploy previews. */
function getCanonicalSiteUrl() {
  return (cleanEnv('PUBLIC_SITE_URL') || 'https://deedscout.netlify.app').replace(/\/+$/, '');
}

module.exports = {
  cleanEnv,
  getSupabaseUrl,
  getSupabaseUrlCandidates,
  getSupabaseServiceKey,
  getSupabasePublishableKey,
  createSupabaseAdminClient,
  createWorkingSupabaseAdminClient,
  createSupabasePublishableClient,
  verifyAccessToken,
  getSiteUrl,
  getCanonicalSiteUrl,
};
