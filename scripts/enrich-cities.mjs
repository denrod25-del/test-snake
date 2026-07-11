#!/usr/bin/env node
/* ============================================================
   Enrich City TBD listings via Firecrawl
   ------------------------------------------------------------
   For each company with _needsCityLink (or city === "Unknown"),
   scrapes the company website and extracts city / address / phone
   using Firecrawl JSON mode, then writes back to companies.json.

   Usage:
     $env:FIRECRAWL_API_KEY="fc-..."
     node scripts/enrich-cities.mjs
     node scripts/enrich-cities.mjs --limit 5          # test first
     node scripts/enrich-cities.mjs --dry-run          # list targets only
     node scripts/enrich-cities.mjs --resume           # skip already enriched
   ============================================================ */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  firecrawlScrape, sleep, parseArgs, ensureHttps
} from './lib/firecrawl.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, '..', 'data');
const COMPANIES = path.join(DATA, 'companies.json');
const REGION_MAP = path.join(DATA, 'county-regions.json');
const CACHE = path.join(DATA, '.enrich-cities-cache.json');

const args = parseArgs();
const LIMIT = args.limit ? parseInt(args.limit, 10) : null;
const DRY = Boolean(args['dry-run']);
const RESUME = Boolean(args.resume);
const DELAY_MS = parseInt(args.delay || '1500', 10);

const LOCATION_SCHEMA = {
  type: 'object',
  properties: {
    city: { type: 'string', description: 'City name in Florida if mentioned' },
    state: { type: 'string', description: 'State abbreviation or full name' },
    address: { type: 'string', description: 'Full street address if present' },
    zip: { type: 'string', description: 'ZIP / postal code' },
    phone: { type: 'string', description: 'Primary phone number' },
    serviceAreas: {
      type: 'array',
      items: { type: 'string' },
      description: 'Cities or counties they serve'
    },
    isFlorida: { type: 'boolean', description: 'Whether the business appears to operate in Florida' }
  },
  required: ['city', 'isFlorida']
};

async function readJSON(p, fallback = null) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return fallback; }
}

function regionForCounty(county, regions) {
  if (!county) return 'Unknown';
  for (const [region, counties] of Object.entries(regions)) {
    if (counties.includes(county)) return region;
  }
  return 'Unknown';
}

function normalizeCity(city) {
  if (!city) return null;
  let c = String(city).trim();
  // Strip ", FL" / "Florida"
  c = c.replace(/,?\s*(FL|Florida)\s*$/i, '').trim();
  if (!c || /unknown|n\/?a|not (found|available)/i.test(c)) return null;
  return c;
}

async function main() {
  const data = await readJSON(COMPANIES);
  const regionMap = await readJSON(REGION_MAP);
  if (!data?.companies) {
    console.error('No data/companies.json — run apify-to-companies.mjs first');
    process.exit(1);
  }

  const cache = (RESUME && await readJSON(CACHE)) || { results: {} };
  let targets = data.companies.filter(c =>
    c._needsCityLink || c.city === 'Unknown' || !c.city
  );
  targets = targets.filter(c => c.website);

  if (LIMIT) targets = targets.slice(0, LIMIT);

  console.log(`\nCity enrichment targets: ${targets.length}${DRY ? ' (dry-run)' : ''}\n`);

  if (DRY) {
    targets.slice(0, 20).forEach((c, i) =>
      console.log(`  ${i + 1}. ${c.name}  →  ${c.website}`)
    );
    if (targets.length > 20) console.log(`  …and ${targets.length - 20} more`);
    return;
  }

  // Touch Firecrawl config early so missing key fails fast
  const { requireKey } = await import('./lib/firecrawl.mjs');
  requireKey();

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  let creditExhausted = false;

  for (let i = 0; i < targets.length; i++) {
    const co = targets[i];
    const url = ensureHttps(co.website);
    process.stdout.write(`[${i + 1}/${targets.length}] ${co.name.slice(0, 40).padEnd(40)} `);

    if (RESUME && cache.results[co.id]?.city) {
      console.log(`(cached: ${cache.results[co.id].city})`);
      skipped++;
      applyResult(co, cache.results[co.id], regionMap);
      continue;
    }

    if (creditExhausted) {
      console.log('(skipped — out of credits)');
      failed++;
      continue;
    }

    try {
      const scraped = await firecrawlScrape(url, {
        formats: [{
          type: 'json',
          schema: LOCATION_SCHEMA,
          prompt: 'Extract the physical business location in Florida (city, address, phone). Prefer a service-area HQ or contact-page address over a PO box.'
        }],
        onlyMainContent: true,
        timeout: 45000
      });

      const loc = scraped.json || scraped.data?.json || {};
      const city = normalizeCity(loc.city);

      // If primary city blank, try first FL service area
      let resolved = city;
      if (!resolved && Array.isArray(loc.serviceAreas)) {
        for (const area of loc.serviceAreas) {
          const n = normalizeCity(area);
          if (n && regionMap.cityToCounty[n]) { resolved = n; break; }
        }
      }

      const result = {
        city: resolved,
        address: loc.address || null,
        phone: loc.phone || null,
        zip: loc.zip || null,
        isFlorida: loc.isFlorida !== false,
        scrapedAt: new Date().toISOString(),
        sourceUrl: url
      };

      cache.results[co.id] = result;
      await fs.writeFile(CACHE, JSON.stringify(cache, null, 2));

      if (resolved) {
        applyResult(co, result, regionMap);
        console.log(`→ ${resolved}`);
        updated++;
      } else {
        console.log('→ no city found');
        failed++;
      }
    } catch (err) {
      const msg = err.message || '';
      console.log(`ERROR: ${msg.slice(0, 80)}`);
      failed++;
      if (/402|Insufficient credits/i.test(msg)) {
        creditExhausted = true;
        console.log('\n!! Firecrawl credits exhausted — stopping further scrapes.');
        console.log('   Re-run with --resume after topping up credits.\n');
      }
    }

    await sleep(DELAY_MS);
  }

  data.generated = new Date().toISOString();
  data.enrichment = {
    ...(data.enrichment || {}),
    cities: {
      at: new Date().toISOString(),
      updated,
      failed,
      skipped,
      needs_city_link: data.companies.filter(c => c._needsCityLink).length
    }
  };
  data.needs_city_link = data.companies.filter(c => c._needsCityLink).length;
  data.count = data.companies.length;

  await fs.writeFile(COMPANIES, JSON.stringify(data, null, 2));
  console.log(`\nDone. Updated ${updated}, failed ${failed}, skipped ${skipped}.`);
  console.log(`Still needs city link: ${data.needs_city_link}`);
  console.log(`Wrote data/companies.json\n`);
}

function applyResult(co, result, regionMap) {
  if (!result?.city) return;
  co.city = result.city;
  if (result.address) co.address = result.address;
  if (result.phone && !co.phone) co.phone = result.phone;
  const county = regionMap.cityToCounty[result.city] || null;
  co.county = county;
  co.region = regionForCounty(county, regionMap.regions);
  co._needsCityLink = false;
  co._citySource = 'firecrawl-website';
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
