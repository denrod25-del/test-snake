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

function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  createSupabaseAdminClient,
  getSiteUrl,
};
