const { json, requireUser, requireShopMember, parseBody } = require('./_lib/config');
const { encryptSpiKey } = require('./_lib/spi-crypto');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const body = parseBody(event);
    const { shopId, spiKey } = body;
    if (!shopId || !spiKey) return json(400, { error: 'missing_fields' });

    const { user, admin } = await requireUser(event);
    const member = await requireShopMember(admin, user.id, shopId);
    if (!member.is_owner) return json(403, { error: 'owner_only' });

    const ciphertext = encryptSpiKey(spiKey);
    const { error } = await admin.from('shop_spi_secrets').upsert({
      shop_id: shopId,
      ciphertext,
      updated_at: new Date().toISOString(),
    });
    if (error) return json(500, { error: error.message });

    return json(200, { ok: true });
  } catch (e) {
    return json(e.statusCode || 500, { error: e.message || 'server_error' });
  }
};
