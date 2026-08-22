// netlify/functions/property-briefing.js
// Service Property Intelligence — GET /api/property?address=...
const { corsPreflight, json, corsHeaders } = require('./_lib/spi-cors');
const shopAuth = require('./_lib/shop-auth');
const { checkRateLimit, rateLimitResponse } = require('./_lib/rate-limit');
const parcelLib = require('./_lib/spi-parcel');
const floodLib = require('./_lib/spi-flood');
const permitsLib = require('./_lib/spi-permits');
const { assembleOpportunities } = require('./_lib/spi-opportunities');
const { getCanonicalSiteUrl } = require('./_lib/config');

async function handlePropertyBriefing(event, deps = {}) {
  const requireShopApiKey = deps.requireShopApiKey || shopAuth.requireShopApiKey;
  const assembleParcel = deps.assembleParcel || parcelLib.assembleParcel;
  const assembleBuilding = deps.assembleBuilding || parcelLib.assembleBuilding;
  const assembleFlood = deps.assembleFlood || floodLib.assembleFlood;
  const assemblePermits = deps.assemblePermits || permitsLib.assemblePermits;
  const enrichEquipmentWithYearBuilt =
    deps.enrichEquipmentWithYearBuilt || permitsLib.enrichEquipmentWithYearBuilt;

  if (event.httpMethod === 'OPTIONS') return corsPreflight();
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'method_not_allowed', message: 'Use GET /api/property?address=...' });
  }

  const ipLimit = checkRateLimit(event, { name: 'spi-ip', max: 30, windowMs: 60_000 });
  if (!ipLimit.allowed) return withCors(rateLimitResponse(ipLimit.retryAfterSec));

  const auth = await requireShopApiKey(event, { corsHeaders: corsHeaders() });
  if (auth.error) return auth.error;

  const shopLimit = checkRateLimit(event, {
    name: 'spi-shop',
    max: 60,
    windowMs: 60_000,
    bucketKey: auth.shop.id,
  });
  if (!shopLimit.allowed) return withCors(rateLimitResponse(shopLimit.retryAfterSec));

  const params = event.queryStringParameters || {};
  const address = (params.address || params.q || '').trim();
  const county = (params.county || 'palm-beach').trim().toLowerCase() || 'palm-beach';
  if (!address) {
    return json(400, {
      error: 'missing_address',
      message: 'Query parameter address is required.',
    });
  }

  const parcel = await assembleParcel({ address, countySlug: county });
  const building = assembleBuilding(parcel);

  // Flat parcel object when single hit or auto-picked; { parcels } when unresolved multi-match.
  const primary =
    (parcelLib.resolvedPrimary && parcelLib.resolvedPrimary(parcel)) ||
    (parcel.data && !Array.isArray(parcel.data.parcels) ? parcel.data : null);

  let flood = {
    status: 'unavailable',
    source: 'flood',
    data: null,
    message: 'Need a single parcel centroid for flood lookup.',
  };
  if (primary && primary.centroid) {
    flood = await assembleFlood({
      lon: primary.centroid.lon,
      lat: primary.centroid.lat,
      countySlug: county,
    });
  }

  // Always match Cached permits by address (and PCN when known) — even on multi-match.
  const addrForPermits = (primary && primary.address) || address;
  const assembled = await assemblePermits({
    pcn: primary && primary.pcn,
    address: addrForPermits,
  });
  const permits = assembled.permits;
  const equipmentAge = enrichEquipmentWithYearBuilt(
    assembled.equipmentAge,
    primary && primary.yearBuilt
  );

  const waterSewer = {
    status: 'coming-soon',
    source: 'data/signals/catalog.json',
    data: null,
    message: 'Water/sewer utility is not a sourced Live signal in DeedScout yet.',
  };

  const opportunities = assembleOpportunities({
    parcel,
    building,
    permits,
    equipmentAge,
    flood,
  });

  const site = getCanonicalSiteUrl();
  const links = {
    propertyIntelligence: primary
      ? `${site}/property-intelligence.html?county=${encodeURIComponent(county)}&mode=pcn&q=${encodeURIComponent(primary.pcn || '')}`
      : `${site}/property-intelligence.html?county=${encodeURIComponent(county)}`,
    permitSearch: `${site}/permit-search.html`,
    paUrl: (primary && primary.paUrl) || null,
  };

  return json(200, {
    ok: true,
    shop: { id: auth.shop.id, name: auth.shop.name },
    query: { address, county },
    groups: {
      parcel,
      building,
      permits,
      equipmentAge,
      flood,
      waterSewer,
      opportunities,
    },
    links,
    generatedAt: new Date().toISOString(),
  });
}

function withCors(resp) {
  return {
    ...resp,
    headers: {
      ...(resp.headers || {}),
      ...corsHeaders(),
    },
  };
}

exports.handler = async (event) => handlePropertyBriefing(event);
exports.handlePropertyBriefing = handlePropertyBriefing;
