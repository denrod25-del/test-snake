// netlify/functions/create-portal-session.js
// ----------------------------------------------------------------------------
// Returns a Stripe Customer Portal URL where the user can manage their
// subscription (update card, cancel, view invoices, etc.).
//
// Required env vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY,
//                    PUBLIC_SITE_URL
//
// Body: { accessToken }   Response: { url }
// ----------------------------------------------------------------------------

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { accessToken } = JSON.parse(event.body || '{}');
    if (!accessToken) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessToken' }) };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userData.user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No Stripe customer for this user' }) };
    }

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const siteUrl = process.env.PUBLIC_SITE_URL || `https://${event.headers.host}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer:    profile.stripe_customer_id,
      return_url:  `${siteUrl}/tax-deeds.html#/account`
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: portalSession.url })
    };
  } catch (err) {
    console.error('portal error', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
