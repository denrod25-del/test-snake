#!/usr/bin/env node
/**
 * Issue a shop API key for Service Property Intelligence.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/issue-shop-api-key.mjs "Acme Plumbing"
 *
 * Prints the plaintext key ONCE to stdout. Store it in your CRM vault.
 * Never commit plaintext keys. Never log keys in Netlify function logs.
 */
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const shopName = process.argv[2] || 'Unnamed shop';
const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const pepper = process.env.SHOP_API_KEY_PEPPER || '';

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (service role).');
  process.exit(1);
}

function randomKey() {
  const body = crypto.randomBytes(24).toString('base64url');
  return `ds_shop_${body}`;
}

const plaintext = randomKey();
const key_hash = crypto.createHash('sha256').update(pepper + plaintext, 'utf8').digest('hex');
const key_prefix = plaintext.slice(0, 12);

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await sb
  .from('shop_api_keys')
  .insert({
    shop_name: shopName,
    key_prefix,
    key_hash,
    active: true,
  })
  .select('id, shop_name, key_prefix, created_at')
  .single();

if (error) {
  console.error('Insert failed:', error.message || error);
  if (/relation|does not exist/i.test(error.message || '')) {
    console.error('Apply supabase/migrations/20260815_shop_api_keys.sql in the SQL Editor first.');
  }
  process.exit(1);
}

console.log('Shop API key issued (copy now — will not be shown again):');
console.log(plaintext);
console.log('');
console.log(JSON.stringify({ shop: data }, null, 2));
