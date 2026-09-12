const { json, getBearer } = require('./_lib/config');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  const token = getBearer(event);
  if (!token) return json(401, { error: 'unauthorized' });
  const body = JSON.parse(event.body || '{}');
  if (!body.jobId || !body.shopId) return json(400, { error: 'missing_fields' });
  // Production: verify JWT membership for shopId, load SPI ciphertext via service role,
  // GET https://deedscout.app/api/property?address=… with X-Api-Key — never return the key.
  if (!process.env.SPI_KEY_ENCRYPTION_SECRET) {
    return json(200, {
      demo: true,
      groups: {
        parcel: { status: 'unavailable', message: 'Configure SPI proxy env for live briefings' },
        permits: { status: 'unavailable' },
        waterSewer: { status: 'coming_soon' },
      },
    });
  }
  return json(501, { error: 'not_wired' });
};
