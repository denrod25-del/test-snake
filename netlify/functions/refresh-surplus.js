// netlify/functions/refresh-surplus.js
// ----------------------------------------------------------------------------
// Scrapes verified Clerk surplus HTML (tables/cards) and upserts into
// surplus_history. PDF counties are scraped by Python (scrape_surplus.py) and
// can be ingested via POST { rows: [...] } (Pro / SURPLUS_REFRESH_SECRET).
//
// Triggers:
//   1. Netlify scheduled cron — header x-netlify-event: schedule
//   2. POST { accessToken } from an active Pro user
//   3. Authorization: Bearer <SURPLUS_REFRESH_SECRET> or ?key= / body.key
//   4. Temporary bootstrap key for seeding — remove after confirm
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

/** HTML sources only — PDF parsing runs in Python (PyMuPDF), not Netlify. */
const SOURCES = [
  {
    county: 'Manatee',
    kind: 'html_table',
    url: 'https://www.manateeclerk.com/departments/tax-deeds/list-of-unclaimed-funds/',
  },
  {
    county: 'Gulf',
    kind: 'gulf_cards',
    url: 'https://www.gulfclerk.com/courts/tax-deeds/',
  },
  {
    county: 'Calhoun',
    kind: 'calhoun_overbids',
    url: 'https://calhounclerk.com/county-recorder/tax-deed-surplus/',
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
    req.on('timeout', () => req.destroy(new Error(`timeout fetching ${urlString}`)));
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
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoney(text) {
  const s = String(text || '');
  let m = s.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!m) m = s.match(/(?<![/\d])([\d,]+\.\d{2})(?!\d)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(text) {
  const m = String(text || '').match(
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2},?\s+\d{4})\b/
  );
  if (!m) return null;
  const d = new Date(m[1]);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function claimDeadlineFromSale(saleDate) {
  const sale = new Date(saleDate + 'T12:00:00Z');
  sale.setUTCDate(sale.getUTCDate() + 120);
  return sale.toISOString().slice(0, 10);
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
      while ((cm = cellRe.exec(rm[1]))) cells.push(stripTags(cm[2]));
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
      if (!claimDeadline) claimDeadline = claimDeadlineFromSale(saleDate);
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
        status: /claim filed|pending/i.test(rowText) ? 'claim_filed' : 'unclaimed',
        claim_deadline: claimDeadline,
        source_url: sourceUrl,
      });
    }
  }
  return out;
}

function fieldAfter(block, label) {
  const m = block.match(new RegExp(label + '\\s*\\n+(.+)', 'i'));
  return m ? m[1].trim() : null;
}

function parseGulfCards(html, county, sourceUrl) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{2,}/g, '\n');
  const parts = text.split(/(?=Sale Date\b)/);
  const out = [];
  for (const part of parts) {
    if (!/Parcel ID/i.test(part) || !/\$/.test(part) || !/\bsurplus\b/i.test(part)) continue;
    const saleDate = parseDate(fieldAfter(part, 'Sale Date') || part);
    const parcel = fieldAfter(part, 'Parcel ID');
    const caseNo = fieldAfter(part, 'Case No\\.?');
    const owner = fieldAfter(part, 'Owner');
    const location = fieldAfter(part, 'Location');
    const amount = parseMoney(part);
    if (!saleDate || amount == null || amount < MIN_AMOUNT) continue;
    out.push({
      county,
      sale_date: saleDate,
      parcel_id: (parcel || caseNo || '').trim(),
      property_addr: location && !/Applicant/i.test(location) ? location.trim() : null,
      prior_owner: owner ? owner.trim() : null,
      surplus_amount: amount,
      status: 'unclaimed',
      claim_deadline: claimDeadlineFromSale(saleDate),
      source_url: sourceUrl,
    });
  }
  return out;
}

function parseCalhounOverbids(html, county, sourceUrl) {
  const m = html.match(/:taxdeeds="(\[[\s\S]*?\])"/);
  if (!m) return [];
  let raw = m[1]
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'");
  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    return [];
  }
  const out = [];
  for (const item of items || []) {
    const amount = parseMoney(String(item.balance || ''));
    const saleDate = parseDate(String(item.sale_date || ''));
    if (!saleDate || amount == null || amount < MIN_AMOUNT) continue;
    const deadline = parseDate(String(item.unclaimed_date || '')) || claimDeadlineFromSale(saleDate);
    out.push({
      county,
      sale_date: saleDate,
      parcel_id: String(item.parcel || item.file || '').trim(),
      property_addr: null,
      prior_owner: String(item.owner || '').trim() || null,
      surplus_amount: amount,
      status: 'unclaimed',
      claim_deadline: deadline,
      source_url: sourceUrl,
    });
  }
  return out;
}

async function scrapeSource(src) {
  const html = await fetchText(src.url);
  if (src.kind === 'html_table') return parseSurplusTables(html, src.county, src.url);
  if (src.kind === 'gulf_cards') return parseGulfCards(html, src.county, src.url);
  if (src.kind === 'calhoun_overbids') return parseCalhounOverbids(html, src.county, src.url);
  throw new Error(`unknown kind ${src.kind}`);
}

async function scrapeAll() {
  const all = [];
  const errors = [];
  for (const src of SOURCES) {
    try {
      const rows = await scrapeSource(src);
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

function parseBody(event) {
  if (event.httpMethod !== 'POST') return {};
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

async function authorized(event, body) {
  if (header(event, 'x-netlify-event') === 'schedule') {
    return { ok: true, via: 'schedule' };
  }

  const qs = event.queryStringParameters || {};
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
    for (let i = 0; i < countyRows.length; i += 100) {
      const chunk = countyRows.slice(i, i + 100);
      const { error: insErr } = await client.from('surplus_history').insert(chunk);
      if (insErr) throw new Error(`insert ${county}: ${insErr.message}`);
      written += chunk.length;
    }
  }
  return written;
}

exports.handler = async (event) => {
  try {
    const body = parseBody(event);
    const auth = await authorized(event, body);
    if (!auth.ok) return json(auth.status || 401, { error: auth.error });

    let rows = [];
    let errors = [];
    if (Array.isArray(body.rows) && body.rows.length) {
      rows = body.rows;
    } else {
      const scraped = await scrapeAll();
      rows = scraped.rows;
      errors = scraped.errors;
    }

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
