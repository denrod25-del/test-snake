// Manual HTTP trigger for the daily signal-alert digest.
// Netlify blocks public HTTP on scheduled functions, so cron lives in send-alert-digest-cron.js.
//
// Trigger (after ALERT_DIGEST_SECRET is set in Netlify env + redeploy):
//   POST /.netlify/functions/send-alert-digest
//   Authorization: Bearer <ALERT_DIGEST_SECRET>
//   — or — ?key=<ALERT_DIGEST_SECRET>
const { cleanEnv } = require('./_lib/config');
const { runAlertDigest } = require('./_lib/alert-digest');

function header(event, name) {
  const headers = event.headers || {};
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === want) return v;
  }
  return '';
}

function parseBody(event) {
  if (event.httpMethod !== 'POST') return {};
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function authorized(event) {
  const secret = cleanEnv('ALERT_DIGEST_SECRET');
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error:
        'ALERT_DIGEST_SECRET not configured. Add it in Netlify → Environment variables, then redeploy.',
    };
  }
  const qs = event.queryStringParameters || {};
  const body = parseBody(event);
  const auth = header(event, 'authorization');
  const provided =
    String(auth || '')
      .replace(/^Bearer\s+/i, '')
      .trim() ||
    qs.key ||
    body.key ||
    '';
  if (provided && provided === secret) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 401,
    error:
      'Unauthorized. Use Authorization: Bearer <ALERT_DIGEST_SECRET> or POST ?key=<ALERT_DIGEST_SECRET>.',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'POST required' }),
    };
  }

  const auth = authorized(event);
  if (!auth.ok) {
    return {
      statusCode: auth.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: auth.error }),
    };
  }

  try {
    const result = await runAlertDigest();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || String(err) }),
    };
  }
};
