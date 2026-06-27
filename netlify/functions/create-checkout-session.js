// netlify/functions/create-checkout-session.js
// ----------------------------------------------------------------------------
// Creates a Stripe Checkout Session for the Pro plan.
//
// Requires env vars on Netlify:
//   STRIPE_SECRET_KEY        sk_live_... or sk_test_...
//   STRIPE_PRICE_ID_PRO      price_... (the recurring monthly Pro price)
//   SUPABASE_URL             https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY     (NOT the anon key — the service_role key)
//   PUBLIC_SITE_URL          https://your-site.netlify.app
//
// Request body: { accessToken: "<supabase JWT>" }
// Response:     { url: "<stripe checkout url>" } | { error: ... }
// ----------------------------------------------------------------------------

const Stripe = require('stripe');
const { createSupabaseAdminClient, getSiteUrl, cleanEnv, verifyAccessToken } = require('./_lib/config');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { accessToken } = JSON.parse(event.body || '{}');
    if (!accessToken) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessToken' }) };
    }

    const { user, error: authErr } = await verifyAccessToken(accessToken);
    if (authErr || !user) {
      const msg = (authErr?.message || '').toLowerCase();
      const hint = msg.includes('expired') || msg.includes('invalid')
        ? 'Session expired or invalid — please sign out and sign in again.'
        : 'Invalid session — please sign in again.';
      console.error('checkout auth failed', authErr?.message || authErr);
      return { statusCode: 401, body: JSON.stringify({ error: hint }) };
    }

    const supabase = createSupabaseAdminClient();

    // Look up or create the profile to find/store the Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    const stripeKey = cleanEnv('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: STRIPE_SECRET_KEY is missing in Netlify env vars.' }) };
    }
    const stripe = Stripe(stripeKey);

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const siteUrl = getSiteUrl(event);

    const priceId = cleanEnv('STRIPE_PRICE_ID_PRO');
    if (!priceId) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: STRIPE_PRICE_ID_PRO is missing in Netlify env vars.' }) };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${siteUrl}/tax-deeds.html#/account?checkout=success`,
      cancel_url:  `${siteUrl}/tax-deeds.html#/pricing?checkout=cancelled`,
      subscription_data: {
        metadata: { supabase_user_id: user.id }
      },
      metadata: { supabase_user_id: user.id }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('checkout error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
