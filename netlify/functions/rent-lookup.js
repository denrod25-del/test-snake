// netlify/functions/rent-lookup.js
// ----------------------------------------------------------------------------
// Long-term rent estimate + rental comps (RentCast /v1/avm/rent/long-term).
// Shares Pro AVM credit bucket with sale AVM lookups.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_KEY, RENTCAST_API_KEY
// ----------------------------------------------------------------------------

const { client, json, corsPreflight, requirePro, spendCredit, refundCredit, getBalance, ensureProCredits }
  = require('./_lib/auth');

const VENDOR = 'rentcast-rent';
const VENDOR_BASE = process.env.RENTCAST_BASE_URL || 'https://api.rentcast.io';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  const auth = await requirePro(event);
  if (auth.error) return auth.error;
  const { user, body } = auth;
  await ensureProCredits(user.id);
  const preBal = await getBalance(user.id, 'avm');
  if (!preBal || ((Number(preBal.balance) || 0) === 0 && (Number(preBal.monthly_grant) || 0) === 0)) {
    return json(503, {
      error: 'credits_not_provisioned',
      message:
        'AVM/rent credit buckets are missing. Run the Pro credit migrations in Supabase, then retry.',
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

  // Fail fast before spending a credit when the vendor key is missing.
  if (!process.env.RENTCAST_API_KEY) {
    return json(503, {
      error: 'vendor_not_configured',
      message:
        'Rent lookup is not configured on this server yet (RENTCAST_API_KEY missing). Add the RentCast key in Netlify → Environment variables, then redeploy. No credit was spent.',
      vendors: { skip_trace: !!process.env.BATCHDATA_API_TOKEN, avm: false },
    });
  }

  const spent = await spendCredit(user.id, 'avm', {
    parcel_id: normalizedPcn,
    county_slug: slug,
    kind: 'rent',
  });
  if (!spent) {
    const balanceRow = await getBalance(user.id, 'avm');
    const grant = balanceRow?.monthly_grant ?? 0;
    return json(402, {
      error: 'out_of_credits',
      message: grant > 0
        ? 'You have used all your monthly AVM/rent credits. They refill on your next billing cycle.'
        : 'AVM/rent credits are not set up on this Pro account yet.',
      creditsRemaining: balanceRow?.balance ?? 0,
      monthly_grant: grant,
    });
  }

  let normalized;
  let raw;
  try {
    raw = await callRentCastRent({ address, propertyType, bedrooms, bathrooms, livingSqft });
    normalized = normalizeRentResult(raw);
  } catch (err) {
    console.error('RentCast rent failed', err);
    await refundCredit(user.id, 'avm', 'vendor_error');
    const missing = /RENTCAST_API_KEY not set/i.test(String(err?.message || ''));
    return json(missing ? 503 : 502, {
      error: missing ? 'vendor_not_configured' : 'vendor_error',
      message: missing
        ? 'Rent lookup is not configured on this server yet (RENTCAST_API_KEY missing). Your credit was not kept.'
        : 'The rent vendor returned an error. Your credit has been refunded.',
      detail: String(err?.message || err),
    });
  }

  // Best-effort audit row in avm_cache with rent fields mapped into value columns.
  try {
    const sb = client();
    await sb.from('avm_cache').upsert({
      county_slug: slug,
      parcel_id: `RENT:${normalizedPcn}`,
      address,
      estimated_value: normalized.rent,
      value_low: normalized.rentLow,
      value_high: normalized.rentHigh,
      confidence: normalized.confidence,
      comparables: normalized.comparables,
      raw_vendor: raw,
      vendor: VENDOR,
      fetched_at: new Date().toISOString(),
      fetched_by: user.id,
    }, { onConflict: 'county_slug,parcel_id' });
  } catch (cacheErr) {
    console.warn('rent cache upsert skipped', cacheErr?.message || cacheErr);
  }

  const balanceRow = await getBalance(user.id, 'avm');
  return json(200, {
    cached: false,
    fetched_at: new Date().toISOString(),
    rent: normalized,
    creditsRemaining: balanceRow?.balance ?? null,
  });
};

async function callRentCastRent({ address, propertyType, bedrooms, bathrooms, livingSqft }) {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) throw new Error('RENTCAST_API_KEY not set');

  const params = new URLSearchParams({ address });
  if (propertyType) params.set('propertyType', mapPropertyType(propertyType));
  if (bedrooms != null) params.set('bedrooms', String(bedrooms));
  if (bathrooms != null) params.set('bathrooms', String(bathrooms));
  if (livingSqft != null) params.set('squareFootage', String(livingSqft));
  params.set('compCount', '8');

  const url = `${VENDOR_BASE}/v1/avm/rent/long-term?${params.toString()}`;
  const resp = await fetch(url, {
    headers: { 'X-Api-Key': key, Accept: 'application/json' },
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`RentCast rent ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  return resp.json();
}

function mapPropertyType(t) {
  const map = {
    single_family: 'Single Family',
    sfr: 'Single Family',
    condo: 'Condo',
    townhouse: 'Townhouse',
    multi_family: 'Multi-Family',
    multifamily: 'Multi-Family',
    duplex: 'Multi-Family',
    manufactured: 'Manufactured',
    land: 'Land',
  };
  return map[String(t).toLowerCase()] || 'Single Family';
}

function normalizeRentResult(raw) {
  const rent = Number(raw?.rent ?? raw?.price ?? 0) || null;
  const rentLow = Number(raw?.rentRangeLow ?? raw?.priceRangeLow ?? 0) || null;
  const rentHigh = Number(raw?.rentRangeHigh ?? raw?.priceRangeHigh ?? 0) || null;

  let confidence = 'medium';
  if (rent && rentLow && rentHigh) {
    const bandPct = (rentHigh - rentLow) / rent;
    if (bandPct < 0.10) confidence = 'high';
    else if (bandPct > 0.25) confidence = 'low';
  }

  const comps = Array.isArray(raw?.comparables) ? raw.comparables : [];
  const comparables = comps.slice(0, 8).map((c) => ({
    address: c.formattedAddress || [c.addressLine1, c.city, c.state, c.zipCode].filter(Boolean).join(', '),
    distance: c.distance != null ? Number(Number(c.distance).toFixed(2)) : null,
    rent: Number(c.price ?? c.rent ?? 0) || null,
    sqft: Number(c.squareFootage ?? c.livingArea ?? 0) || null,
    bedrooms: Number(c.bedrooms ?? 0) || null,
    bathrooms: Number(c.bathrooms ?? 0) || null,
    daysOnMarket: c.daysOnMarket != null ? Number(c.daysOnMarket) : null,
    listedDate: c.listedDate || c.listed_date || null,
  }));

  return { rent, rentLow, rentHigh, confidence, comparables };
}
