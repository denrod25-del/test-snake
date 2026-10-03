const { createClient } = require('@supabase/supabase-js');

function cleanEnv(name) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

function json(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Api-Key',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      ...extra,
    },
    body: statusCode === 204 ? '' : JSON.stringify(body),
  };
}

function getBearer(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : '';
}

function getSupabaseUrl() {
  const raw = cleanEnv('SUPABASE_URL') || cleanEnv('FSO_SUPABASE_URL');
  if (!raw) {
    throw new Error('SUPABASE_URL missing');
  }
  let url = raw;
  if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/+/, '')}`;
  return url.replace(/\/+$/, '');
}

function getServiceKey() {
  const key = cleanEnv('SUPABASE_SERVICE_KEY') || cleanEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('SUPABASE_SERVICE_KEY missing');
  if (key.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SERVICE_KEY must be the service_role/secret key');
  }
  return key;
}

function getAnonKey() {
  return cleanEnv('SUPABASE_ANON_KEY') || cleanEnv('SUPABASE_PUBLISHABLE_KEY');
}

function createAdminClient() {
  return createClient(getSupabaseUrl(), getServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function createUserClient(accessToken) {
  const anon = getAnonKey();
  if (!anon) throw new Error('SUPABASE_ANON_KEY missing');
  return createClient(getSupabaseUrl(), anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireUser(event) {
  const token = getBearer(event);
  if (!token) {
    const err = new Error('unauthorized');
    err.statusCode = 401;
    throw err;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('unauthorized');
    err.statusCode = 401;
    throw err;
  }
  return { user: data.user, token, admin };
}

async function requireShopMember(admin, userId, shopId) {
  const { data, error } = await admin
    .from('shop_members')
    .select('*')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    const err = new Error('forbidden');
    err.statusCode = 403;
    throw err;
  }
  return data;
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

module.exports = {
  cleanEnv,
  json,
  getBearer,
  getSupabaseUrl,
  getServiceKey,
  createAdminClient,
  createUserClient,
  requireUser,
  requireShopMember,
  parseBody,
};
