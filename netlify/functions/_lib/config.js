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
  const raw = cleanEnv('SUPABASE_URL');
  if (raw) {
    let url = raw;
    if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/+/, '')}`;
    try {
      new URL(url);
      urls.push(url.replace(/\/+$/, ''));
    } catch { /* ignore bad env */ }
  }
  urls.push(DEEDSCOUT_PROJECT_URL);
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

function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

module.exports = {
  cleanEnv,
  getSupabaseUrl,
  getSupabaseServiceKey,
  getSupabasePublishableKey,
  createSupabaseAdminClient,
  createSupabasePublishableClient,
  verifyAccessToken,
  getSiteUrl,
};
