/**
 * Best-effort per-instance rate limiting for Netlify Functions (serverless).
 * For production scale, replace with Upstash Redis or similar shared store.
 */
const buckets = new Map();

function clientKey(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * @param {object} event Netlify event
 * @param {{ windowMs?: number, max?: number, name?: string }} opts
 * @returns {{ allowed: true } | { allowed: false, retryAfterSec: number }}
 */
function checkRateLimit(event, opts = {}) {
  const windowMs = opts.windowMs || 60_000;
  const max = opts.max || 30;
  const name = opts.name || 'default';
  const key = `${name}:${clientKey(event)}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    const retryAfterSec = Math.ceil((windowMs - (now - bucket.start)) / 1000);
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

function rateLimitResponse(retryAfterSec) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
    },
    body: JSON.stringify({ error: 'rate_limited', message: 'Too many requests. Try again shortly.' }),
  };
}

module.exports = { checkRateLimit, rateLimitResponse, clientKey };
