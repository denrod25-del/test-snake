#!/usr/bin/env node
/* Convert Apify Google Maps scrape → data/companies.json
   Usage: node scripts/apify-to-companies.mjs [path-to-raw.json]
*/
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, '..', 'data');
const INPUT = process.argv[2] || path.join(DATA, 'apify-raw.json');
const OUTPUT = path.join(DATA, 'companies.json');

const regionMap = JSON.parse(await fs.readFile(path.join(DATA, 'county-regions.json'), 'utf8'));
const cityToCounty = regionMap.cityToCounty || {};
const regions = regionMap.regions || {};

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function regionForCounty(county) {
  if (!county) return 'Unknown';
  for (const [region, counties] of Object.entries(regions)) {
    if (counties.includes(county)) return region;
  }
  return 'Unknown';
}

function resolveCounty(item) {
  const city = (item.city || '').trim();
  if (city && cityToCounty[city]) return cityToCounty[city];
  // Try parsing "City, FL ZIP" from address
  const addr = item.address || '';
  const m = addr.match(/,\s*([A-Za-z .'-]+),\s*FL\b/i);
  if (m) {
    const c = m[1].trim();
    if (cityToCounty[c]) return cityToCounty[c];
  }
  return null;
}

function cleanWebsite(url) {
  if (!url) return '';
  return String(url).replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function estimateLowStarPct(rating, count) {
  // Rough estimate: lower ratings imply higher low-star share
  if (!count || count < 5) return 0.08;
  if (rating >= 4.8) return 0.03;
  if (rating >= 4.5) return 0.06;
  if (rating >= 4.0) return 0.12;
  if (rating >= 3.5) return 0.22;
  if (rating >= 3.0) return 0.35;
  return 0.5;
}

function transform(item) {
  const name = (item.title || '').trim();
  if (!name) return null;
  if (item.permanentlyClosed) return null;

  const state = (item.state || '').trim();
  if (state && !/^florida$|^fl$/i.test(state)) return null;

  let city = (item.city || '').trim();
  if (!city && item.address) {
    const m = String(item.address).match(/,\s*([A-Za-z .'-]+),\s*FL\b/i);
    if (m) city = m[1].trim();
  }
  const hasLocation = Boolean(city || item.address);
  if (!city) city = 'Unknown';

  const rating = Number(item.totalScore) || 0;
  const reviews = Number(item.reviewsCount) || 0;
  const website = cleanWebsite(item.website);

  // No-city listings: keep if name + website + reviews (city linked later)
  // Located listings: keep as long as they have a name
  if (!hasLocation) {
    if (!website || reviews < 1) return null;
  }

  const county = city === 'Unknown' ? null : resolveCounty({ ...item, city });
  const region = regionForCounty(county);
  const placeId = item.placeId || item.cid || slugify(name + city + (website || ''));

  const services = Array.isArray(item.categories)
    ? item.categories.filter(Boolean).slice(0, 8)
    : [item.categoryName || 'Plumber'];

  return {
    id: slugify(`${name}-${String(placeId).slice(-8)}`),
    name,
    city,
    county,
    region,
    address: item.address || [item.street, city !== 'Unknown' ? city : null, 'FL', item.postalCode].filter(Boolean).join(', '),
    phone: item.phone || '',
    website,
    founded: null,
    services,
    platforms: {
      google: { rating, reviews }
    },
    lowStarPct: estimateLowStarPct(rating, reviews),
    responseRate: 0,
    praise: [],
    complaints: [],
    reviews: [],
    _googlePlaceId: item.placeId || null,
    _googleUrl: item.url || null,
    _businessStatus: item.temporarilyClosed ? 'CLOSED_TEMPORARILY' : 'OPERATIONAL',
    _hasWebsite: Boolean(website),
    _needsCityLink: city === 'Unknown',
    _imageUrl: item.imageUrl || null
  };
}

const raw = JSON.parse(await fs.readFile(INPUT, 'utf8'));
const seen = new Set();
const companies = [];
let skipped = { closed: 0, nonFl: 0, dup: 0, empty: 0 };

for (const item of raw) {
  if (item.permanentlyClosed) { skipped.closed++; continue; }
  const state = (item.state || '').trim();
  if (state && !/^florida$|^fl$/i.test(state)) { skipped.nonFl++; continue; }

  const key = item.placeId || `${item.title}|${item.address}`;
  if (seen.has(key)) { skipped.dup++; continue; }

  const co = transform(item);
  if (!co) { skipped.empty++; continue; }
  seen.add(key);
  companies.push(co);
}

companies.sort((a, b) => (b.platforms.google.reviews || 0) - (a.platforms.google.reviews || 0));

const withWeb = companies.filter(c => c._hasWebsite).length;
const needsCity = companies.filter(c => c._needsCityLink).length;
const output = {
  generated: new Date().toISOString(),
  source: 'Apify Google Maps scrape (dataset TMYOdtkwwFpfz6Kx6)',
  count: companies.length,
  with_website: withWeb,
  needs_city_link: needsCity,
  skipped,
  companies
};

await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2));
console.log(`Wrote ${companies.length} companies → data/companies.json`);
console.log(`  with website: ${withWeb}`);
console.log(`  needs city link: ${needsCity}`);
console.log(`  skipped:`, skipped);
console.log(`  regions:`, Object.fromEntries(
  Object.keys(regions).map(r => [r, companies.filter(c => c.region === r).length])
    .concat([['Unknown', companies.filter(c => c.region === 'Unknown').length]])
));
