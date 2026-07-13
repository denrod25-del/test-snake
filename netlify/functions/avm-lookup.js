// netlify/functions/avm-lookup.js
// ----------------------------------------------------------------------------
// Automated Valuation Model lookup for the bid calculator. Returns an
// estimated market value + value range + comparable sales so users don't have
// to guess the ARV when sizing a max-bid.
//
// Vendor: RentCast (https://app.rentcast.io/app/api). Has a free tier
// (50 calls/mo) and a $74/mo Standard tier (1,000 calls/mo) which is what
// we sell against.
//
// Required env vars on Netlify:
//   SUPABASE_URL                   https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY           service-role key
//   RENTCAST_API_KEY               from app.rentcast.io
//   RENTCAST_BASE_URL  (optional)  defaults to https://api.rentcast.io
//
// Request body:
//   {
//     accessToken: "<supabase-jwt>",
//     parcelId:    "00424323070000050",
//     countySlug:  "palm-beach",
//     address:     "98 SEAGRAPE LN, JUPITER FL 33458",  // required for RentCast
//     propertyType:"single_family" | "condo" | "multi_family" | null,
//     bedrooms:    3,                                    // optional
//     bathrooms:   2,                                    // optional
//     livingSqft:  1850                                  // optional
//   }
//
// Response (200):
//   {
//     cached:          true | false,
//     fetched_at:      "2026-04-19T...",
//     avm: {
//       value:         412000,
//       valueLow:      385000,
//       valueHigh:     438000,
//       confidence:    "high" | "medium" | "low",
//       comparables:   [{ address, distance, soldPrice, soldDate, sqft, ppsf }, ...]
//     },
//     creditsRemaining: 199
//   }
// ----------------------------------------------------------------------------

const { client, json, corsPreflight, requirePro, spendCredit, refundCredit, getBalance, ensureProCredits }
  = require('./_lib/auth');

const VENDOR = 'rentcast';
const VENDOR_BASE = process.env.RENTCAST_BASE_URL || 'https://api.rentcast.io';

// AVM data ages slowly (comps update quarterly). 30-day cache balances
// freshness and cost.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  const auth = await requirePro(event);
  if (auth.error) return auth.error;
  const { user, body } = auth;
  const sb = client();
  const ensure = await ensureProCredits(user.id);
  const preBal = await getBalance(user.id, 'avm');
  if (!preBal || ((Number(preBal.balance) || 0) === 0 && (Number(preBal.monthly_grant) || 0) === 0)) {
    return json(503, {
      error: 'credits_not_provisioned',
      message:
        'AVM credit buckets are missing in the database. In Supabase → SQL, run supabase/migrations/20260419_data_credits_and_caches.sql then 20260712_heal_zero_credit_buckets.sql (or the grant-all-pro snippet).',
      details: ensure.errors || [],
      creditsRemaining: preBal?.balance ?? 0,
      monthly_grant: preBal?.monthly_grant ?? 0,
    });
  }

  const { parcelId, countySlug, address, propertyType, bedrooms, bathrooms, livingSqft } = body;
  if (!parcelId || !countySlug || !address) {
    return json(400, {
      error: 'missing_fields',
      message: 'parcelId, countySlug, and address are required.',
    });
  }
  const normalizedPcn = String(parcelId).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  const slug = String(countySlug).toLowerCase();

  // Cache check
  const { data: cached } = await sb
    .from('avm_cache')
    .select('estimated_value, value_low, value_high, confidence, comparables, fetched_at')
    .eq('county_slug', slug)
    .eq('parcel_id', normalizedPcn)
    .single();
  if (cached && cached.fetched_at && (Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS)) {
    const balanceRow = await getBalance(user.id, 'avm');
    return json(200, {
      cached: true,
      fetched_at: cached.fetched_at,
      avm: {
        value:       cached.estimated_value,
        valueLow:    cached.value_low,
        valueHigh:   cached.value_high,
        confidence:  cached.confidence,
        comparables: cached.comparables || [],
      },
      creditsRemaining: balanceRow?.balance ?? null,
    });
  }

  const spent = await spendCredit(user.id, 'avm', {
    parcel_id: normalizedPcn,
    county_slug: slug,
  });
  if (!spent) {
    const balanceRow = await getBalance(user.id, 'avm');
    const grant = balanceRow?.monthly_grant ?? 0;
    return json(402, {
      error: 'out_of_credits',
      message: grant > 0
        ? 'You have used all your monthly AVM credits. They refill on your next billing cycle.'
        : 'AVM credits are not set up on this Pro account yet. Open Account → refresh subscription, then try again.',
      creditsRemaining: balanceRow?.balance ?? 0,
      monthly_grant:    grant,
    });
  }

  let normalized;
  let raw;
  try {
    raw = await callRentCast({ address, propertyType, bedrooms, bathrooms, livingSqft });
    normalized = normalizeRentCastResult(raw);
  } catch (err) {
    console.error('RentCast AVM failed', err);
    await refundCredit(user.id, 'avm', 'vendor_error');
    const missing = /RENTCAST_API_KEY not set/i.test(String(err?.message || ''));
    return json(missing ? 503 : 502, {
      error: missing ? 'vendor_not_configured' : 'vendor_error',
      message: missing
        ? 'AVM lookup is not configured on this server yet (RENTCAST_API_KEY missing). Your credit was not kept.'
        : 'The valuation vendor returned an error. Your credit has been refunded.',
      detail: String(err?.message || err),
    });
  }

  await sb.from('avm_cache').upsert({
    county_slug:     slug,
    parcel_id:       normalizedPcn,
    address,
    estimated_value: normalized.value,
    value_low:       normalized.valueLow,
    value_high:      normalized.valueHigh,
    confidence:      normalized.confidence,
    comparables:     normalized.comparables,
    raw_vendor:      raw,
    vendor:          VENDOR,
    fetched_at:      new Date().toISOString(),
    fetched_by:      user.id,
  }, { onConflict: 'county_slug,parcel_id' });

  const balanceRow = await getBalance(user.id, 'avm');
  return json(200, {
    cached: false,
    fetched_at: new Date().toISOString(),
    avm: normalized,
    creditsRemaining: balanceRow?.balance ?? null,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// RentCast vendor adapter
// ────────────────────────────────────────────────────────────────────────────

async function callRentCast({ address, propertyType, bedrooms, bathrooms, livingSqft }) {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) throw new Error('RENTCAST_API_KEY not set');

  const params = new URLSearchParams({ address });
  if (propertyType) params.set('propertyType', mapPropertyType(propertyType));
  if (bedrooms != null)   params.set('bedrooms',   String(bedrooms));
  if (bathrooms != null)  params.set('bathrooms',  String(bathrooms));
  if (livingSqft != null) params.set('squareFootage', String(livingSqft));
  params.set('compCount', '5');

  const url = `${VENDOR_BASE}/v1/avm/value?${params.toString()}`;
  const resp = await fetch(url, {
    headers: { 'X-Api-Key': key, 'Accept': 'application/json' },
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`RentCast ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  return await resp.json();
}

function mapPropertyType(t) {
  // RentCast's enum: Single Family | Condo | Townhouse | Multi-Family | Manufactured | Land
  const map = {
    single_family: 'Single Family',
    sfr:           'Single Family',
    condo:         'Condo',
    townhouse:     'Townhouse',
    multi_family:  'Multi-Family',
    multifamily:   'Multi-Family',
    duplex:        'Multi-Family',
    triplex:       'Multi-Family',
    fourplex:      'Multi-Family',
    manufactured:  'Manufactured',
    mobile:        'Manufactured',
    land:          'Land',
    vacant:        'Land',
  };
  return map[String(t).toLowerCase()] || 'Single Family';
}

function normalizeRentCastResult(raw) {
  const value     = Number(raw?.price ?? raw?.estimatedValue ?? 0) || null;
  const valueLow  = Number(raw?.priceRangeLow  ?? raw?.lowerBound ?? 0) || null;
  const valueHigh = Number(raw?.priceRangeHigh ?? raw?.upperBound ?? 0) || null;

  // RentCast doesn't return a labeled confidence; synthesize from band width
  // (tighter band = higher confidence).
  let confidence = 'medium';
  if (value && valueLow && valueHigh) {
    const bandPct = (valueHigh - valueLow) / value;
    if (bandPct < 0.10) confidence = 'high';
    else if (bandPct > 0.25) confidence = 'low';
  }

  const comps = Array.isArray(raw?.comparables) ? raw.comparables : [];
  const comparables = comps.slice(0, 5).map(c => ({
    address:    c.formattedAddress || [c.addressLine1, c.city, c.state, c.zipCode].filter(Boolean).join(', '),
    distance:   c.distance != null ? Number(c.distance.toFixed(2)) : null,    // miles
    soldPrice:  Number(c.price ?? c.soldPrice ?? 0) || null,
    soldDate:   c.lastSaleDate || c.soldDate || c.removedDate || null,
    sqft:       Number(c.squareFootage ?? c.livingArea ?? 0) || null,
    bedrooms:   Number(c.bedrooms ?? 0) || null,
    bathrooms:  Number(c.bathrooms ?? 0) || null,
    yearBuilt:  c.yearBuilt || null,
    ppsf:       (c.price && c.squareFootage) ? Math.round(c.price / c.squareFootage) : null,
    correlation: c.correlation != null ? Number(c.correlation.toFixed(2)) : null,
  }));

  return { value, valueLow, valueHigh, confidence, comparables };
}
