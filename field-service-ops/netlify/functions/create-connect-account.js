const { json, getBearer } = require('./_lib/config');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
  const token = getBearer(event);
  if (!token) return json(401, { error: 'unauthorized' });
  // Owner-only Connect onboarding — implement with Stripe Account Links when keys present.
  return json(501, {
    error: 'not_wired',
    message: 'Require is_owner membership then Stripe Account Links for Express onboarding',
  });
};
