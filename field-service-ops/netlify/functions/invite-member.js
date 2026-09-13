const { json, requireUser, requireShopMember, parseBody } = require('./_lib/config');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const body = parseBody(event);
    const { shopId, email, roles } = body;
    if (!shopId || !email) return json(400, { error: 'missing_fields' });

    const { user, admin } = await requireUser(event);
    const member = await requireShopMember(admin, user.id, shopId);
    if (!member.is_owner) return json(403, { error: 'owner_only' });
    if (roles?.isOwner || roles?.is_owner) {
      return json(400, { error: 'cannot_invite_owner' });
    }

    const tempPassword = `Tmp-${Math.random().toString(36).slice(2, 10)}!aA1`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: String(email).trim(),
      password: tempPassword,
      email_confirm: true,
    });
    if (createErr) return json(400, { error: createErr.message });

    const { error: memErr } = await admin.from('shop_members').insert({
      shop_id: shopId,
      user_id: created.user.id,
      email: String(email).trim(),
      is_owner: false,
      is_csr: !!roles?.isCsr || !!roles?.is_csr,
      is_dispatcher: !!roles?.isDispatcher || !!roles?.is_dispatcher,
      is_tech: roles?.isTech !== false && roles?.is_tech !== false,
    });
    if (memErr) return json(500, { error: memErr.message });

    return json(200, {
      ok: true,
      userId: created.user.id,
      temporaryPassword: tempPassword,
      message: 'Share the temporary password out-of-band; user should change it after first login',
    });
  } catch (e) {
    return json(e.statusCode || 500, { error: e.message || 'server_error' });
  }
};
