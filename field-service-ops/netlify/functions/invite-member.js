const { json, getBearer } = require('./_lib/config');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!getBearer(event)) return json(401, { error: 'unauthorized' });
  return json(501, { error: 'not_wired', message: 'Owner-only invite via Supabase Admin API' });
};
