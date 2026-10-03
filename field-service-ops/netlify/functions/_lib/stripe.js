const Stripe = require('stripe');
const { cleanEnv } = require('./config');

function getStripe() {
  const key = cleanEnv('STRIPE_SECRET_KEY');
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

module.exports = { getStripe };
