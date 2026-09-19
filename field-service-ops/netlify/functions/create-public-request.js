const { json, createAdminClient, parseBody } = require('./_lib/config');

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

  const body = parseBody(event);
  const slug = String(body.slug || '').trim();
  const ip = (event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'local')
    .split(',')[0]
    .trim();

  if (!slug) return json(400, { error: 'missing_slug' });
  if (body.shop_id || body.shopId) {
    return json(400, { error: 'forged_shop_id', message: 'Do not send shop_id; slug resolves server-side' });
  }
  if (!rateLimit(`${slug}:${ip}`)) return json(429, { error: 'rate_limited' });

  const trade = String(body.trade || '').trim();
  const description = String(body.description || '').trim();
  const contactName = String(body.contactName || body.contact_name || '').trim();
  const contactPhone = String(body.contactPhone || body.contact_phone || '').trim();
  const address = String(body.address || '').trim();
  const preferredWindow = String(body.preferredWindow || body.preferred_window || '').trim();

  if (!['plumbing', 'hvac', 'electrical'].includes(trade)) {
    return json(400, { error: 'invalid_trade' });
  }
  if (!description || !contactName || !contactPhone || !address) {
    return json(400, { error: 'missing_fields' });
  }
  if (description.length > 2000 || contactName.length > 200 || address.length > 400) {
    return json(400, { error: 'field_too_long' });
  }

  if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, {
      error: 'supabase_unconfigured',
      message: 'Demo SPA handles public requests locally; configure service role for this endpoint',
    });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('submit_public_request', {
      p_slug: slug,
      p_trade: trade,
      p_description: description,
      p_contact_name: contactName,
      p_contact_phone: contactPhone,
      p_address: address,
      p_preferred_window: preferredWindow,
    });
    if (error) return json(400, { error: error.message || 'rpc_failed' });
    return json(200, { id: data, status: 'pending' });
  } catch (e) {
    return json(500, { error: e.message || 'server_error' });
  }
};
