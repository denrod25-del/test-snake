#!/usr/bin/env node
/* ============================================================
   FLORIDA PLUMBING DIRECTORY — DATA INGESTION
   ------------------------------------------------------------
   Calls the Google Places API (New) once per FL city to
   discover plumbing businesses, dedupes by place_id, then
   fetches full details + reviews for each unique business.

   Output: ../data/companies.json — consumed by
           ../plumbing-reviews.html on page load.

   Usage:
     GOOGLE_API_KEY=xxx node ingest.mjs
     node ingest.mjs --dry-run     # cost estimate only
     node ingest.mjs --resume      # continue from last run
     node ingest.mjs --limit 5     # only process first 5 cities

   Requires: Node 20+ (uses built-in fetch, no npm deps).
   ============================================================ */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const ARGS = process.argv.slice(2);
const FLAG = (name) => ARGS.includes(`--${name}`);
const VAL  = (name) => { const i = ARGS.indexOf(`--${name}`); return i >= 0 ? ARGS[i+1] : null; };

const DRY_RUN = FLAG('dry-run');
const RESUME  = FLAG('resume');
const LIMIT   = parseInt(VAL('limit') || '0', 10) || null;

const KEY = process.env.GOOGLE_API_KEY;
if (!KEY && !DRY_RUN) {
  console.error('\n[ERROR] GOOGLE_API_KEY env var not set.');
  console.error('        Copy scripts/.env.example to .env and add your key,');
  console.error('        or run with --dry-run to see a cost estimate without calling the API.\n');
  process.exit(1);
}

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACE_DETAILS_URL = (id) => `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`;

const TEXT_SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.types',
  'nextPageToken'
].join(',');

const DETAILS_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'addressComponents', 'location',
  'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteUri',
  'rating', 'userRatingCount', 'reviews', 'businessStatus',
  'regularOpeningHours', 'types', 'priceLevel'
].join(',');

const SEARCH_COST_PER_1K  = 32;
const DETAILS_COST_PER_1K = 25;
const RATE_DELAY_MS       = 120;

const CACHE_FILE    = path.join(DATA_DIR, '.ingest-cache.json');
const PROGRESS_FILE = path.join(DATA_DIR, '.ingest-progress.json');
const OUTPUT_FILE   = path.join(DATA_DIR, 'companies.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function readJSON(p, fallback = null) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return fallback; }
}
async function writeJSON(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2));
}

/* ---------- API CALLS ---------- */

async function googleFetch(url, body, fieldMask, attempt = 1) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': fieldMask
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 429) {
    if (attempt > 5) throw new Error('Rate limited too many times');
    const wait = Math.min(60000, 1000 * 2 ** attempt);
    console.warn(`   ! Rate limited, waiting ${wait}ms`);
    await sleep(wait);
    return googleFetch(url, body, fieldMask, attempt + 1);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function searchPlumbersInCity(city) {
  const results = [];
  let pageToken = null;
  let pages = 0;

  do {
    const body = {
      textQuery: `plumber in ${city}, Florida`,
      pageSize: 20,
      regionCode: 'US',
      includedType: 'plumber',
      ...(pageToken && { pageToken })
    };
    const data = await googleFetch(TEXT_SEARCH_URL, body, TEXT_SEARCH_FIELDS);
    const places = data.places || [];
    results.push(...places);
    pageToken = data.nextPageToken;
    pages++;
    if (pageToken) await sleep(2200);
  } while (pageToken && pages < 3);

  return { results, calls: pages };
}

async function fetchPlaceDetails(placeId) {
  return googleFetch(PLACE_DETAILS_URL(placeId), null, DETAILS_FIELDS);
}

/* ---------- TRANSFORM ---------- */

function extractCounty(addressComponents = []) {
  const ac = addressComponents.find(c => (c.types || []).includes('administrative_area_level_2'));
  if (!ac) return null;
  return (ac.longText || ac.shortText || '').replace(/ County$/i, '').trim();
}

function extractCity(addressComponents = []) {
  const c = addressComponents.find(x => (x.types || []).includes('locality'));
  return c ? (c.longText || c.shortText) : null;
}

function regionForCounty(county, regionMap) {
  if (!county) return 'Unknown';
  for (const [region, counties] of Object.entries(regionMap.regions)) {
    if (counties.includes(county)) return region;
  }
  return 'Unknown';
}

function deriveServicesFromTypes(types = []) {
  const map = {
    'plumber': 'Plumbing Service',
    'general_contractor': 'General Contracting',
    'electrician': 'Electrical (combined)',
    'roofing_contractor': 'Roofing (combined)',
    'home_goods_store': 'Showroom'
  };
  const out = types.map(t => map[t]).filter(Boolean);
  return out.length ? out : ['Plumbing Service'];
}

function computeLowStarPct(reviews = []) {
  if (!reviews.length) return 0.05;
  const low = reviews.filter(r => (r.rating || 0) <= 2).length;
  return low / reviews.length;
}

function computeResponseRate(reviews = []) {
  if (!reviews.length) return 0;
  const responded = reviews.filter(r => r.authorAttribution && r.text && r.replies && r.replies.length).length;
  return responded / reviews.length;
}

function transformReviews(reviews = []) {
  return reviews.slice(0, 5).map(r => ({
    platform: 'google',
    rating: r.rating || 0,
    author: r.authorAttribution?.displayName || 'Anonymous',
    date: r.publishTime ? r.publishTime.slice(0, 10) : '',
    text: (r.text?.text || r.originalText?.text || '').slice(0, 800),
    response: null
  }));
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function transformPlace(place, regionMap) {
  const name = place.displayName?.text || 'Unknown';
  const county = extractCounty(place.addressComponents);
  const city = extractCity(place.addressComponents) || '';
  const region = regionForCounty(county, regionMap);
  const reviews = place.reviews || [];

  return {
    id: slugify(`${name}-${place.id.slice(-6)}`),
    name,
    city,
    county,
    region,
    address: place.formattedAddress || '',
    phone: place.nationalPhoneNumber || '',
    website: (place.websiteUri || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    founded: null,
    services: deriveServicesFromTypes(place.types),
    platforms: {
      google: {
        rating: place.rating || 0,
        reviews: place.userRatingCount || 0
      }
    },
    lowStarPct: computeLowStarPct(reviews),
    responseRate: computeResponseRate(reviews),
    praise: [],
    complaints: [],
    reviews: transformReviews(reviews),
    _googlePlaceId: place.id,
    _businessStatus: place.businessStatus || 'OPERATIONAL'
  };
}

/* ---------- MAIN ---------- */

async function main() {
  const cities = await readJSON(path.join(DATA_DIR, 'fl-cities.json'));
  const regionMap = await readJSON(path.join(DATA_DIR, 'county-regions.json'));
  if (!cities || !regionMap) {
    console.error('[ERROR] Missing data files. Expected:');
    console.error('        data/fl-cities.json');
    console.error('        data/county-regions.json');
    process.exit(1);
  }

  const cityList = LIMIT ? cities.slice(0, LIMIT) : cities;

  console.log('\n┌─ FLORIDA PLUMBING DIRECTORY · INGESTION ─────────────────┐');
  console.log(`│ Cities to query:        ${String(cityList.length).padEnd(34)}│`);
  console.log(`│ Estimated unique places: ~${String(cityList.length * 25).padEnd(31)}│`);
  console.log(`│ Mode:                   ${(DRY_RUN ? 'DRY RUN' : 'LIVE').padEnd(34)}│`);
  console.log('└──────────────────────────────────────────────────────────┘\n');

  if (DRY_RUN) {
    const searchCalls = cityList.length * 3;
    const detailsCalls = cityList.length * 25;
    const cost = (searchCalls * SEARCH_COST_PER_1K + detailsCalls * DETAILS_COST_PER_1K) / 1000;
    console.log('COST ESTIMATE');
    console.log(`  Text Search calls:   ~${searchCalls.toLocaleString()}  ($${(searchCalls * SEARCH_COST_PER_1K / 1000).toFixed(2)})`);
    console.log(`  Place Details calls: ~${detailsCalls.toLocaleString()}  ($${(detailsCalls * DETAILS_COST_PER_1K / 1000).toFixed(2)})`);
    console.log(`  TOTAL ESTIMATE:      $${cost.toFixed(2)}`);
    console.log(`  (Google offers $200/month free credit on Maps Platform — first run may be free.)\n`);
    return;
  }

  const cache = (RESUME && await readJSON(CACHE_FILE)) || { places: {}, completedCities: [] };
  const completed = new Set(cache.completedCities);

  let totalSearchCalls = 0;
  let cityIdx = 0;

  for (const city of cityList) {
    cityIdx++;
    if (completed.has(city)) {
      console.log(`[${cityIdx}/${cityList.length}] ${city.padEnd(28)} (cached, skip)`);
      continue;
    }

    process.stdout.write(`[${cityIdx}/${cityList.length}] ${city.padEnd(28)} ... `);
    try {
      const { results, calls } = await searchPlumbersInCity(city);
      totalSearchCalls += calls;
      let added = 0;
      for (const p of results) {
        if (!cache.places[p.id]) {
          cache.places[p.id] = p;
          added++;
        }
      }
      console.log(`found ${results.length}, +${added} new (${Object.keys(cache.places).length} total)`);
      completed.add(city);
      cache.completedCities = [...completed];
      await writeJSON(CACHE_FILE, cache);
      await sleep(RATE_DELAY_MS);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      console.log('       (saved progress; rerun with --resume to continue)');
      cache.completedCities = [...completed];
      await writeJSON(CACHE_FILE, cache);
      process.exit(1);
    }
  }

  const placeIds = Object.keys(cache.places);
  console.log(`\n→ Search phase complete: ${placeIds.length} unique businesses, ${totalSearchCalls} API calls\n`);
  console.log('→ Fetching full details (rating, reviews, contact) for each...\n');

  const detailed = cache.detailed || {};
  let detailIdx = 0;
  let totalDetailCalls = 0;

  for (const id of placeIds) {
    detailIdx++;
    if (detailed[id]) continue;
    try {
      const d = await fetchPlaceDetails(id);
      detailed[id] = d;
      totalDetailCalls++;
      if (detailIdx % 25 === 0) {
        cache.detailed = detailed;
        await writeJSON(CACHE_FILE, cache);
        console.log(`   [${detailIdx}/${placeIds.length}] cached partial results...`);
      }
      await sleep(RATE_DELAY_MS);
    } catch (err) {
      console.warn(`   ! Failed details for ${id}: ${err.message}`);
    }
  }
  cache.detailed = detailed;
  await writeJSON(CACHE_FILE, cache);

  console.log(`\n→ Details phase complete: ${Object.keys(detailed).length} fetched, ${totalDetailCalls} new API calls\n`);
  console.log('→ Transforming to companies.json schema...\n');

  const companies = Object.values(detailed)
    .filter(p => p && (p.businessStatus !== 'CLOSED_PERMANENTLY'))
    .map(p => transformPlace(p, regionMap))
    .filter(c => c.name && c.city)
    .sort((a, b) => (b.platforms.google.reviews || 0) - (a.platforms.google.reviews || 0));

  const output = {
    generated: new Date().toISOString(),
    source: 'Google Places API (New)',
    count: companies.length,
    cities_queried: cityList.length,
    api_calls: { searches: totalSearchCalls, details: totalDetailCalls },
    companies
  };

  await writeJSON(OUTPUT_FILE, output);

  const totalCost = (totalSearchCalls * SEARCH_COST_PER_1K + totalDetailCalls * DETAILS_COST_PER_1K) / 1000;
  console.log('┌─ DONE ──────────────────────────────────────────────────┐');
  console.log(`│ Companies written:      ${String(companies.length).padEnd(34)}│`);
  console.log(`│ Output:                 data/companies.json              │`);
  console.log(`│ Approx. API spend:      $${totalCost.toFixed(2).padEnd(34)}│`);
  console.log('└─────────────────────────────────────────────────────────┘\n');
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
