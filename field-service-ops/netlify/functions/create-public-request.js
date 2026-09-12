const { json } = require('./_lib/config');

const hits = new Map();

function rateLimit(key, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const row = hits.get(key) || { count: 0, reset: now + windowMs };
  if (now > row.reset) {
    row.count = 0;
    row.reset = now + windowMs;
  }
  row.count += 1;
  hits.set(key, row);
  return row.count <= limit;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  const body = JSON.parse(event.body || '{}');
  const slug = String(body.slug || '').trim();
  const ip = (event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'local').split(',')[0].trim();
  if (!slug) return json(400, { error: 'missing_slug' });
  if (!rateLimit(`${slug}:${ip}`)) return json(429, { error: 'rate_limited' });
  if (body.shop_id || body.shopId) {
    return json(400, { error: 'forged_shop_id', message: 'Do not send shop_id; slug resolves server-side' });
  }
  // Production: call submit_public_request RPC with service role.
  return json(501, {
    error: 'not_wired',
    message: 'Call submit_public_request(slug, …) with service role; never trust client shop_id',
  });
};
