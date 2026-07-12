// netlify/functions/refresh-surplus.js
// ----------------------------------------------------------------------------
// Scrapes verified Clerk surplus HTML tables and upserts into surplus_history.
// Uses Netlify SUPABASE_URL + SUPABASE_SERVICE_KEY (already configured for Stripe).
//
// Triggers:
//   1. Netlify scheduled cron (weekly) — header x-netlify-event: schedule
//   2. POST with { accessToken } from an active Pro user (manual refresh)
//   3. POST/GET with Authorization: Bearer <SURPLUS_REFRESH_SECRET> if that env is set
//
// Expand SOURCES as more counties publish scrapeable HTML surplus lists.
// ----------------------------------------------------------------------------

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
const SAMPLE_PARCEL_IDS = new Set([
  '23-22-30-1234-00-010',
  '01-3128-009-0540',
  'A-12-29-19-5RE-000007',
  '4942-21-14-3140',
  '00-43-44-26-01-018-0090',
  '07-44-24-P3-00128.0010',
  '142608-0040',
  '08-30-15-12834-001-0010',
]);

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
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
      const res = await fetch(src.url, { headers: BROWSER_HEADERS, redirect: 'follow' });
      if (!res.ok) {
        errors.push(`${src.county}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
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

async function authorized(event) {
  if (event.headers['x-netlify-event'] === 'schedule') {
    return { ok: true, via: 'schedule' };
  }

  const secret = cleanEnv('SURPLUS_REFRESH_SECRET');
  const auth = event.headers.authorization || event.headers.Authorization || '';
  if (secret && auth === `Bearer ${secret}`) {
    return { ok: true, via: 'secret' };
  }
  const qs = event.queryStringParameters || {};
  if (secret && qs.key === secret) {
    return { ok: true, via: 'query' };
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      body = {};
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

  // Drop schema.sql sample seed rows so Pro UI shows real clerk data only.
  for (const parcelId of SAMPLE_PARCEL_IDS) {
    await client.from('surplus_history').delete().eq('parcel_id', parcelId);
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
    return json(500, { error: err.message || String(err) });
  }
};
