// Shared Netlify env parsing for Supabase + Stripe server functions.
const { createClient } = require('@supabase/supabase-js');

function cleanEnv(name) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

function getSupabaseUrl() {
  const raw = cleanEnv('SUPABASE_URL');
  if (!raw) {
    throw new Error(
      'Server misconfigured: SUPABASE_URL is missing in Netlify env vars. Set it to https://YOUR-PROJECT.supabase.co (include https://), then redeploy.'
    );
  }
  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/+/, '')}`;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    throw new Error(
      `Server misconfigured: SUPABASE_URL is not a valid URL (got "${raw}"). Use https://YOUR-PROJECT.supabase.co`
    );
  }
  return url.replace(/\/+$/, '');
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

function getSupabasePublishableKey() {
  // Prefer Netlify env vars; fall back to the public client key from tax-deeds.html.
  return (
    cleanEnv('SUPABASE_ANON_KEY') ||
    cleanEnv('SUPABASE_PUBLISHABLE_KEY') ||
    'sb_publishable_t2758aerT0VWEM5JxUJuLw_y5WScDjj'
  );
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

/** Verify a browser access token. Tries publishable key first (matches client JWTs). */
async function verifyAccessToken(accessToken) {
  const pub = createSupabasePublishableClient();
  const pubResult = await pub.auth.getUser(accessToken);
  if (!pubResult.error && pubResult.data?.user) {
    return { user: pubResult.data.user, error: null };
  }

  try {
    const admin = createSupabaseAdminClient();
    const adminResult = await admin.auth.getUser(accessToken);
    if (!adminResult.error && adminResult.data?.user) {
      return { user: adminResult.data.user, error: null };
    }
    return { user: null, error: adminResult.error || pubResult.error };
  } catch (err) {
    return { user: null, error: pubResult.error || err };
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
