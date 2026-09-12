const { json, requireUser, requireShopMember, parseBody, cleanEnv } = require('./_lib/config');
const { getStripe } = require('./_lib/stripe');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const body = parseBody(event);
    const shopId = body.shopId;
    if (!shopId) return json(400, { error: 'missing_shop_id' });

    const stripe = getStripe();
    if (!stripe) {
      return json(200, {
        demo: true,
        url: null,
        message: 'STRIPE_SECRET_KEY not set — use demo Enable Connect in the SPA',
      });
    }

    const { user, admin } = await requireUser(event);
    const member = await requireShopMember(admin, user.id, shopId);
    if (!member.is_owner) return json(403, { error: 'owner_only' });

    const { data: shop, error } = await admin
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .maybeSingle();
    if (error || !shop) return json(404, { error: 'shop_not_found' });

    let accountId = shop.stripe_connect_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { shop_id: shopId },
      });
      accountId = account.id;
      await admin.from('shops').update({ stripe_connect_account_id: accountId }).eq('id', shopId);
    }

    const site = cleanEnv('PUBLIC_SITE_URL') || 'http://localhost:5173';
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${site}/app?connect=refresh`,
      return_url: `${site}/app?connect=return`,
      type: 'account_onboarding',
    });

    return json(200, { url: link.url, accountId });
  } catch (e) {
    return json(e.statusCode || 500, { error: e.message || 'server_error' });
  }
};
