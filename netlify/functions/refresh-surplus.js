// netlify/functions/refresh-surplus.js
// ----------------------------------------------------------------------------
// Scrapes verified Clerk surplus HTML tables and upserts into surplus_history.
// Uses Netlify SUPABASE_URL + SUPABASE_SERVICE_KEY (already configured for Stripe).
//
// Triggers:
//   1. Netlify scheduled cron (weekly) — header x-netlify-event: schedule
//   2. POST with { accessToken } from an active Pro user (manual refresh)
//   3. Authorization: Bearer <SURPLUS_REFRESH_SECRET> or ?key= when env is set
//
// Expand SOURCES as more counties publish scrapeable HTML surplus lists.
// ----------------------------------------------------------------------------

const https = require('https');
const http = require('http');
const { URL } = require('url');

const {
  createWorkingSupabaseAdminClient,
  cleanEnv,
  verifyAccessToken,
} = require('./_lib/config');

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Counties with verified public HTML surplus tables (expand carefully). */
const SOURCES = [
  {
    county: 'Manatee',
    url: 'https://www.manateeclerk.com/departments/tax-deeds/list-of-unclaimed-funds/',
  },
];

const MIN_AMOUNT = 25;
const SAMPLE_PARCEL_IDS = [
  '23-22-30-1234-00-010',
  '01-3128-009-0540',
  'A-12-29-19-5RE-000007',
  '4942-21-14-3140',
  '00-43-44-26-01-018-0090',
  '07-44-24-P3-00128.0010',
  '142608-0040',
  '08-30-15-12834-001-0010',
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function fetchText(urlString, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch (err) {
      reject(err);
      return;
    }
    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: BROWSER_HEADERS,
        timeout: 25000,
      },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectsLeft > 0) {
          const next = new URL(res.headers.location, urlString).toString();
          res.resume();
          fetchText(next, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (status >= 400) {
            reject(new Error(`HTTP ${status} for ${urlString}`));
            return;
          }
          resolve(body);
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`timeout fetching ${urlString}`));
    });
    req.on('error', reject);
    req.end();
  });
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoney(text) {
  const m = String(text || '').match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(text) {
  const m = String(text || '').match(
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b/
  );
  if (!m) return null;
  const d = new Date(m[1]);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function extractTables(html) {
  const tables = [];
  const re = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let match;
  while ((match = re.exec(html))) {
    const rows = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rm;
    while ((rm = rowRe.exec(match[1]))) {
      const cells = [];
      const cellRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cm;
      while ((cm = cellRe.exec(rm[1]))) {
        cells.push(stripTags(cm[2]));
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function headerLooksLikeSurplus(headers) {
  const joined = headers.map((h) => h.toLowerCase()).join(' ');
  return /surplus|unclaimed|excess|overbid|proceeds/.test(joined);
}

function findCol(headers, needles) {
  const norm = headers.map((h) => h.toLowerCase().replace(/\s+/g, ' ').trim());
  for (const needle of needles) {
    const idx = norm.findIndex((h) => h.includes(needle));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseSurplusTables(html, county, sourceUrl) {
  const tables = extractTables(html);
  const out = [];
  for (const rows of tables) {
    if (rows.length < 2) continue;
    const headers = rows[0];
    if (!headerLooksLikeSurplus(headers)) continue;

    const col = {
      sale: findCol(headers, ['sale date', 'sale', 'date']),
      parcel: findCol(headers, ['parcel', 'folio', 'tax id', 'case', 'file']),
      addr: findCol(headers, ['property', 'address', 'situs', 'location']),
      owner: findCol(headers, ['owner', 'name', 'prior', 'defendant']),
      amount: findCol(headers, ['surplus', 'amount', 'balance', 'funds', 'excess']),
      deadline: findCol(headers, ['deadline', '1 year', 'expire', 'claim by']),
    };

    for (const cells of rows.slice(1)) {
      const compact = cells.filter(Boolean);
      if (compact.length < 2) continue;
      const rowText = compact.join(' ');
      const saleDate = parseDate(col.sale >= 0 ? cells[col.sale] : rowText);
      const amount = parseMoney(col.amount >= 0 ? cells[col.amount] : rowText);
      if (!saleDate || amount == null || amount < MIN_AMOUNT) continue;

      let claimDeadline = col.deadline >= 0 ? parseDate(cells[col.deadline]) : null;
      if (!claimDeadline) {
        const sale = new Date(saleDate + 'T12:00:00Z');
        sale.setUTCDate(sale.getUTCDate() + 120);
        claimDeadline = sale.toISOString().slice(0, 10);
      }

      const parcelId = (col.parcel >= 0 ? cells[col.parcel] : '') || '';
      let owner = col.owner >= 0 ? cells[col.owner] || null : null;
      let addr = col.addr >= 0 ? cells[col.addr] || null : null;
      if (addr && owner && addr === owner) addr = null;

      out.push({
        county,
        sale_date: saleDate,
        parcel_id: parcelId,
        property_addr: addr,
        prior_owner: owner,
        surplus_amount: amount,
        status: /claim filed|pending/i.test(rowText)
          ? 'claim_filed'
          : /paid|disbursed|released/i.test(rowText)
            ? 'paid'
            : 'unclaimed',
        claim_deadline: claimDeadline,
        source_url: sourceUrl,
      });
    }
  }
  return out;
}

async function scrapeAll() {
  const all = [];
  const errors = [];
  for (const src of SOURCES) {
    try {
      const html = await fetchText(src.url);
      const rows = parseSurplusTables(html, src.county, src.url);
      if (!rows.length) {
        errors.push(`${src.county}: no surplus rows parsed`);
        continue;
      }
      all.push(...rows);
    } catch (err) {
      errors.push(`${src.county}: ${err.message || err}`);
    }
  }
  return { rows: all, errors };
}

function header(event, name) {
  const headers = event.headers || {};
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === want) return v;
  }
  return '';
}

async function authorized(event) {
  // Netlify's scheduler sets this. Do not forge it from outside — the platform
  // may short-circuit spoofed schedule invocations with an empty 500.
  if (header(event, 'x-netlify-event') === 'schedule') {
    return { ok: true, via: 'schedule' };
  }

  const qs = event.queryStringParameters || {};
  let body = {};
  if (event.httpMethod === 'POST') {
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      body = {};
    }
  }

  const secret = cleanEnv('SURPLUS_REFRESH_SECRET');
  const auth = header(event, 'authorization');
  const provided = auth.replace(/^Bearer\s+/i, '') || qs.key || body.key || '';
  if (secret && provided && provided === secret) {
    return { ok: true, via: 'secret' };
  }

  if (body.accessToken) {
    const { user, error } = await verifyAccessToken(body.accessToken);
    if (error || !user) return { ok: false, status: 401, error: 'Invalid session' };

    const { client } = await createWorkingSupabaseAdminClient();
    const { data: profile } = await client
      .from('profiles')
      .select('subscription_plan, subscription_status')
      .eq('id', user.id)
      .maybeSingle();
    const isPro =
      profile &&
      profile.subscription_plan === 'pro' &&
      ['active', 'trialing'].includes(profile.subscription_status);
    if (!isPro) return { ok: false, status: 403, error: 'Pro subscription required' };
    return { ok: true, via: 'pro-user', userId: user.id };
  }

  return {
    ok: false,
    status: 401,
    error:
      'Unauthorized. Use Netlify schedule, SURPLUS_REFRESH_SECRET, or POST { accessToken } as a Pro user.',
  };
}

async function replaceCountyRows(client, rows) {
  const byCounty = {};
  for (const row of rows) {
    (byCounty[row.county] ||= []).push(row);
  }

  for (const parcelId of SAMPLE_PARCEL_IDS) {
    const { error } = await client.from('surplus_history').delete().eq('parcel_id', parcelId);
    if (error) console.warn('sample delete', parcelId, error.message);
  }

  let written = 0;
  for (const [county, countyRows] of Object.entries(byCounty)) {
    const { error: delErr } = await client.from('surplus_history').delete().eq('county', county);
    if (delErr) throw new Error(`delete ${county}: ${delErr.message}`);
    const { error: insErr } = await client.from('surplus_history').insert(countyRows);
    if (insErr) throw new Error(`insert ${county}: ${insErr.message}`);
    written += countyRows.length;
  }
  return written;
}

exports.handler = async (event) => {
  try {
    const auth = await authorized(event);
    if (!auth.ok) return json(auth.status || 401, { error: auth.error });

    const { rows, errors } = await scrapeAll();
    if (!rows.length) {
      return json(502, {
        error: 'No surplus rows scraped',
        errors,
        sources: SOURCES.map((s) => s.county),
      });
    }

    const { client, url } = await createWorkingSupabaseAdminClient();
    const written = await replaceCountyRows(client, rows);

    return json(200, {
      ok: true,
      via: auth.via,
      supabase: url,
      written,
      counties: [...new Set(rows.map((r) => r.county))],
      errors,
    });
  } catch (err) {
    console.error('refresh-surplus failed', err);
    return json(500, { error: err.message || String(err), stack: String(err.stack || '').slice(0, 500) });
  }
};
