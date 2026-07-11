#!/usr/bin/env node
/* ============================================================
   Enrich recent reviews + complaint themes via Firecrawl
   ------------------------------------------------------------
   For companies that have a Google Maps URL (_googleUrl) or a
   searchable name, scrapes review snippets and extracts:
     - recent reviews (author, rating, text, date)
     - praise themes
     - complaint themes
     - rough low-star % / response rate when available

   Usage:
     $env:FIRECRAWL_API_KEY="fc-..."
     node scripts/enrich-reviews.mjs
     node scripts/enrich-reviews.mjs --limit 5
     node scripts/enrich-reviews.mjs --min-reviews 50
     node scripts/enrich-reviews.mjs --dry-run
     node scripts/enrich-reviews.mjs --resume
   ============================================================ */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  firecrawlScrape, firecrawlSearch, sleep, parseArgs, requireKey
} from './lib/firecrawl.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, '..', 'data');
const COMPANIES = path.join(DATA, 'companies.json');
const CACHE = path.join(DATA, '.enrich-reviews-cache.json');

const args = parseArgs();
const LIMIT = args.limit ? parseInt(args.limit, 10) : null;
const MIN_REVIEWS = parseInt(args['min-reviews'] || '20', 10);
const DRY = Boolean(args['dry-run']);
const RESUME = Boolean(args.resume);
const DELAY_MS = parseInt(args.delay || '2000', 10);

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    averageRating: { type: 'number' },
    reviewCount: { type: 'number' },
    lowStarPercent: {
      type: 'number',
      description: 'Estimated share of 1-2 star reviews as a 0-1 fraction'
    },
    ownerResponseRate: {
      type: 'number',
      description: 'Estimated share of reviews with owner replies as 0-1 fraction'
    },
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          author: { type: 'string' },
          rating: { type: 'number' },
          date: { type: 'string' },
          text: { type: 'string' },
          ownerReply: { type: 'string' }
        }
      },
      description: 'Up to 5 recent or notable reviews'
    },
    praiseThemes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          theme: { type: 'string' },
          strength: { type: 'number', description: '1-100 relative frequency' }
        }
      }
    },
    complaintThemes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          theme: { type: 'string' },
          strength: { type: 'number', description: '1-100 relative frequency' }
        }
      }
    }
  }
};

async function readJSON(p, fallback = null) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return fallback; }
}

function buildSearchQuery(co) {
  const city = co.city && co.city !== 'Unknown' ? co.city : 'Florida';
  return `${co.name} plumber ${city} Google reviews`;
}

async function resolveReviewUrl(co) {
  if (co._googleUrl) return co._googleUrl;
  // Fall back to search → first maps/google result
  try {
    const results = await firecrawlSearch(buildSearchQuery(co), { limit: 5 });
    const web = results.web || results || [];
    const hit = web.find(r =>
      /google\.(com|com\/maps)|maps\.app\.goo\.gl|yelp\.com/i.test(r.url || '')
    );
    return hit?.url || null;
  } catch {
    return null;
  }
}

async function main() {
  const data = await readJSON(COMPANIES);
  if (!data?.companies) {
    console.error('No data/companies.json');
    process.exit(1);
  }

  const cache = (RESUME && await readJSON(CACHE)) || { results: {} };

  let targets = data.companies.filter(c =>
    (c.platforms?.google?.reviews || 0) >= MIN_REVIEWS
  );
  // Prefer ones that don't already have review text
  targets = targets.filter(c => !c.reviews?.length || c._needsReviewEnrich);
  targets.sort((a, b) =>
    (b.platforms?.google?.reviews || 0) - (a.platforms?.google?.reviews || 0)
  );
  if (LIMIT) targets = targets.slice(0, LIMIT);

  console.log(`\nReview enrichment targets: ${targets.length}`);
  console.log(`  (min reviews: ${MIN_REVIEWS}${DRY ? ', dry-run' : ''})\n`);

  if (DRY) {
    targets.slice(0, 15).forEach((c, i) =>
      console.log(`  ${i + 1}. ${c.name} (${c.platforms.google.reviews} reviews)`)
    );
    return;
  }

  requireKey();

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < targets.length; i++) {
    const co = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] ${co.name.slice(0, 40).padEnd(40)} `);

    if (RESUME && cache.results[co.id]?.reviews?.length) {
      applyResult(co, cache.results[co.id]);
      console.log(`(cached: ${cache.results[co.id].reviews.length} reviews)`);
      skipped++;
      continue;
    }

    try {
      const url = await resolveReviewUrl(co);
      if (!url) {
        console.log('→ no review URL');
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const scraped = await firecrawlScrape(url, {
        formats: [{
          type: 'json',
          schema: REVIEW_SCHEMA,
          prompt: 'Extract recent customer reviews, praise themes, and complaint themes for this plumbing business. Prefer specific themes like pricing, punctuality, quality, communication.'
        }],
        onlyMainContent: false,
        timeout: 60000,
        // Cloud: helps with Google Maps anti-bot; ignored / may fail on self-host
        ...(process.env.FIRECRAWL_API_URL ? {} : { proxy: 'enhanced' })
      });

      const payload = scraped.json || scraped.data?.json || {};
      const result = {
        reviews: (payload.reviews || []).slice(0, 5).map(r => ({
          platform: 'google',
          rating: Number(r.rating) || 0,
          author: r.author || 'Anonymous',
          date: (r.date || '').slice(0, 10),
          text: (r.text || '').slice(0, 800),
          response: r.ownerReply || null
        })),
        praise: (payload.praiseThemes || []).slice(0, 6).map(t => [t.theme, Number(t.strength) || 50]),
        complaints: (payload.complaintThemes || []).slice(0, 6).map(t => [t.theme, Number(t.strength) || 50]),
        lowStarPct: typeof payload.lowStarPercent === 'number' ? payload.lowStarPercent : null,
        responseRate: typeof payload.ownerResponseRate === 'number' ? payload.ownerResponseRate : null,
        sourceUrl: url,
        scrapedAt: new Date().toISOString()
      };

      cache.results[co.id] = result;
      await fs.writeFile(CACHE, JSON.stringify(cache, null, 2));

      if (result.reviews.length || result.praise.length || result.complaints.length) {
        applyResult(co, result);
        console.log(`→ ${result.reviews.length} reviews, ${result.complaints.length} complaint themes`);
        updated++;
      } else {
        console.log('→ empty extract');
        failed++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message.slice(0, 90)}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  data.generated = new Date().toISOString();
  data.enrichment = {
    ...(data.enrichment || {}),
    reviews: {
      at: new Date().toISOString(),
      updated,
      failed,
      skipped,
      with_review_text: data.companies.filter(c => c.reviews?.length).length
    }
  };

  await fs.writeFile(COMPANIES, JSON.stringify(data, null, 2));
  console.log(`\nDone. Updated ${updated}, failed ${failed}, skipped ${skipped}.`);
  console.log(`Companies with review text: ${data.enrichment.reviews.with_review_text}`);
  console.log(`Wrote data/companies.json\n`);
}

function applyResult(co, result) {
  if (result.reviews?.length) co.reviews = result.reviews;
  if (result.praise?.length) co.praise = result.praise;
  if (result.complaints?.length) co.complaints = result.complaints;
  if (typeof result.lowStarPct === 'number') co.lowStarPct = result.lowStarPct;
  if (typeof result.responseRate === 'number') co.responseRate = result.responseRate;
  co._needsReviewEnrich = false;
  co._reviewSource = 'firecrawl';
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
