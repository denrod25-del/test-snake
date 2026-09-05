// netlify/functions/skip-trace.js
// ----------------------------------------------------------------------------
// Skip-trace lookup for a parcel's recorded owner. Backed by BatchData (a.k.a.
// BatchSkipTracing). Returns phones, emails, alternate addresses, and known
// relatives — the data tax-deed investors use for direct-mail and cold-call
// campaigns on flagged parcels (ESTATE OF, C/O, out-of-state owners, etc.).
//
// Required env vars on Netlify:
//   SUPABASE_URL                     https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY             (service-role key, NOT anon)
//   BATCHDATA_API_TOKEN              Bearer token from app.batchdata.com
//   BATCHDATA_BASE_URL  (optional)   Defaults to https://api.batchdata.com
//
// Request body:
//   {
//     accessToken: "<supabase-jwt>",
//     parcelId:    "00424323070000050",
//     countySlug:  "palm-beach",
//     ownerName:   "ESTATE OF JANE SMITH",   // optional but recommended
//     address:     "98 SEAGRAPE LN, JUPITER FL"
//   }
//
// Response (200):
//   {
//     cached:       true | false,                   // whether a credit was spent
//     fetched_at:   "2026-04-19T..."
//     skip:         {
//       phones:       [{ number, type, score }],
//       emails:       [string],
//       altAddresses: [string],
//       relatives:    [string],
//       deceased:     boolean | null,
//       confidence:   "high" | "medium" | "low"
//     },
//     creditsRemaining: 49
//   }
//
// Errors:
//   401 unauthorized       — missing / invalid JWT
//   402 pro_required       — caller is not on the Pro plan
//   402 out_of_credits     — Pro user has used their monthly skip-trace credits
//   400 missing_fields     — required body fields not present
//   502 vendor_error       — BatchData call failed (credit was refunded)
// ----------------------------------------------------------------------------

const { client, json, corsPreflight, requirePro, spendCredit, refundCredit, getBalance, ensureProCredits }
  = require('./_lib/auth');

const VENDOR = 'batchdata';
const VENDOR_BASE = process.env.BATCHDATA_BASE_URL || 'https://api.batchdata.com';

// Cache TTL — after this, the cached row is considered stale and a fresh
// vendor call is made (which DOES cost a credit). 90 days strikes a balance
// between freshness (skip-trace data drifts as people move/die) and cost.
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreflight();
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  // ── Auth + Pro check ────────────────────────────────────────────────────
  const auth = await requirePro(event);
  if (auth.error) return auth.error;
  const { user, body } = auth;
  const sb = client();
  const ensure = await ensureProCredits(user.id);
  const preBal = await getBalance(user.id, 'skip_trace');
  if (!preBal || ((Number(preBal.balance) || 0) === 0 && (Number(preBal.monthly_grant) || 0) === 0)) {
    return json(503, {
      error: 'credits_not_provisioned',
      message:
        'Skip-trace credit buckets are missing in the database. In Supabase → SQL, run the data_credits migrations.',
      details: ensure.errors || [],
      creditsRemaining: preBal?.balance ?? 0,
      monthly_grant: preBal?.monthly_grant ?? 0,
    });
  }

  // ── Validate input ──────────────────────────────────────────────────────
  const { parcelId, countySlug, ownerName, address } = body;
  if (!parcelId || !countySlug || !address) {
    return json(400, {
      error: 'missing_fields',
      message: 'parcelId, countySlug, and address are required.',
    });
  }
  const normalizedPcn = String(parcelId).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  const slug = String(countySlug).toLowerCase();

  // Fail fast before spending a credit when the vendor key is missing.
  if (!process.env.BATCHDATA_API_TOKEN) {
    return json(503, {
      error: 'vendor_not_configured',
      message:
        'Skip-trace is not configured on this server yet (BATCHDATA_API_TOKEN missing). Add the BatchData token in Netlify → Environment variables, then redeploy. No credit was spent.',
      vendors: { skip_trace: false, avm: !!process.env.RENTCAST_API_KEY },
    });
  }

  // ── Cache hit? ──────────────────────────────────────────────────────────
  const { data: cached } = await sb
    .from('skip_trace_cache')
    .select('result, fetched_at')
    .eq('county_slug', slug)
    .eq('parcel_id', normalizedPcn)
    .single();
  if (cached && cached.fetched_at && (Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS)) {
    const balanceRow = await getBalance(user.id, 'skip_trace');
    return json(200, {
      cached: true,
      fetched_at: cached.fetched_at,
      skip: cached.result,
      creditsRemaining: balanceRow?.balance ?? null,
    });
  }

  // ── Spend a credit BEFORE the vendor call (atomic; refunded on failure) ─
  const spent = await spendCredit(user.id, 'skip_trace', {
    parcel_id: normalizedPcn,
    county_slug: slug,
  });
  if (!spent) {
    const balanceRow = await getBalance(user.id, 'skip_trace');
    const grant = balanceRow?.monthly_grant ?? 0;
    return json(402, {
      error: 'out_of_credits',
      message: grant > 0
        ? 'You have used all your monthly skip-trace credits. They refill on your next billing cycle.'
        : 'Skip-trace credits are not set up on this Pro account yet. Open Account → refresh subscription, then try again.',
      creditsRemaining: balanceRow?.balance ?? 0,
      monthly_grant:    grant,
    });
  }

  // ── Vendor call ─────────────────────────────────────────────────────────
  let normalized;
  let raw;
  try {
    raw = await callBatchData({ ownerName, address });
    normalized = normalizeBatchDataResult(raw);
  } catch (err) {
    console.error('BatchData skip-trace failed', err);
    await refundCredit(user.id, 'skip_trace', 'vendor_error');
    const missing = /BATCHDATA_API_TOKEN not set/i.test(String(err?.message || ''));
    return json(missing ? 503 : 502, {
      error: missing ? 'vendor_not_configured' : 'vendor_error',
      message: missing
        ? 'Skip-trace is not configured on this server yet (BATCHDATA_API_TOKEN missing). Your credit was not kept.'
        : 'The skip-tracing vendor returned an error. Your credit has been refunded.',
      detail: String(err?.message || err),
    });
  }

  // ── Cache the result so other Pro users don't re-burn credits ──────────
  await sb.from('skip_trace_cache').upsert({
    county_slug:  slug,
    parcel_id:    normalizedPcn,
    owner_name:   ownerName || null,
    address,
    result:       normalized,
    raw_vendor:   raw,
    vendor:       VENDOR,
    fetched_at:   new Date().toISOString(),
    fetched_by:   user.id,
  }, { onConflict: 'county_slug,parcel_id' });

  const balanceRow = await getBalance(user.id, 'skip_trace');
  return json(200, {
    cached: false,
    fetched_at: new Date().toISOString(),
    skip: normalized,
    creditsRemaining: balanceRow?.balance ?? null,
  });
};

// ────────────────────────────────────────────────────────────────────────────
// BatchData vendor adapter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Call BatchData's property/skip-trace endpoint.
 * Docs: https://docs.batchdata.com/reference/skip-trace
 *
 * BatchData accepts a batch but we always send 1 record at a time so we can
 * cache per-parcel and refund cleanly on individual failures.
 */
async function callBatchData({ ownerName, address }) {
  const token = process.env.BATCHDATA_API_TOKEN;
  if (!token) throw new Error('BATCHDATA_API_TOKEN not set');

  const url = `${VENDOR_BASE}/api/v1/property/skip-trace`;
  const { firstName, lastName } = splitOwnerName(ownerName);
  const { street, city, state, zip } = parseAddress(address);

  const payload = {
    requests: [{
      propertyAddress: {
        street: street || null,
        city:   city   || null,
        state:  state  || 'FL',
        zip:    zip    || null,
      },
      // Name fields are optional — BatchData will skip-trace by address alone
      // if both are blank, but match accuracy improves materially with a name.
      name: (firstName || lastName) ? {
        first: firstName || null,
        last:  lastName  || null,
      } : undefined,
    }],
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`BatchData ${resp.status}: ${errBody.slice(0, 300)}`);
  }
  return await resp.json();
}

/**
 * Map BatchData's response to the trimmed shape we cache + serve. The full
 * raw payload is also persisted (as raw_vendor) so we can extract more fields
 * later without re-spending credits.
 */
function normalizeBatchDataResult(raw) {
  // BatchData wraps results under results.persons[] (one record per requests[i])
  const person = raw?.results?.persons?.[0] || raw?.persons?.[0] || raw?.results?.[0] || {};
  const phones = (person?.phoneNumbers || person?.phones || [])
    .filter(p => p && (p.number || p.value))
    .map(p => ({
      number: String(p.number || p.value).replace(/[^\d]/g, ''),
      type:   p.type || p.lineType || 'unknown',                   // mobile | landline | voip
      score:  p.score ?? p.confidence ?? null,                     // 0–100 confidence
      doNotCall: !!(p.dnc || p.doNotCall),
    }))
    .filter(p => p.number.length === 10 || p.number.length === 11);

  const emails = (person?.emailAddresses || person?.emails || [])
    .map(e => (e?.email || e?.value || e))
    .filter(s => typeof s === 'string' && s.includes('@'));

  const altAddresses = (person?.previousAddresses || person?.alternateAddresses || [])
    .map(a => formatAddress(a))
    .filter(Boolean);

  const relatives = (person?.relatives || person?.householdMembers || [])
    .map(r => r?.name || `${r?.firstName || ''} ${r?.lastName || ''}`.trim())
    .filter(Boolean)
    .slice(0, 5);

  const deceased = person?.deceased === true || person?.isDeceased === true || null;

  // BatchData doesn't always return a single "confidence" score. Synthesize
  // one from how much data came back.
  const score = (phones.length * 2 + emails.length + altAddresses.length);
  const confidence = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';

  return { phones, emails, altAddresses, relatives, deceased, confidence };
}

// ────────────────────────────────────────────────────────────────────────────
// String helpers
// ────────────────────────────────────────────────────────────────────────────

function splitOwnerName(name) {
  if (!name) return { firstName: '', lastName: '' };
  let s = String(name).toUpperCase();
  // Strip ESTATE OF, C/O, TRUSTEE, JR, SR, LLC, INC, etc.
  s = s.replace(/\b(ESTATE OF|EST OF|C\/O|TRUSTEE|TRUST|JR|SR|II|III|IV|LLC|INC|CORP|LP|LLP)\b/g, '').trim();
  s = s.replace(/\s+/g, ' ');
  const parts = s.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  // Florida property records typically format as "LASTNAME FIRSTNAME" (no comma).
  // If the input contained a comma (e.g. "SMITH, JANE"), the comma split puts
  // last name first; the heuristic below handles both.
  const looksLastFirst = /[A-Z]+\s+[A-Z]+/.test(s) && !s.includes(',');
  if (looksLastFirst) {
    return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function parseAddress(addr) {
  // Best-effort split. Accepts:
  //   "123 MAIN ST, JUPITER, FL 33458"
  //   "123 MAIN ST, JUPITER FL 33458"
  //   "123 MAIN ST  JUPITER  FL  33458"
  if (!addr) return { street: '', city: '', state: 'FL', zip: '' };
  const s = String(addr).replace(/\s+/g, ' ').trim();
  // Try comma split first
  const commaParts = s.split(',').map(x => x.trim()).filter(Boolean);
  let street = '', city = '', state = 'FL', zip = '';
  if (commaParts.length >= 3) {
    street = commaParts[0];
    city   = commaParts[1];
    const m = /([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/.exec(commaParts[2]);
    if (m) { state = m[1]; zip = m[2] || ''; }
  } else if (commaParts.length === 2) {
    street = commaParts[0];
    const m = /^(.*?)\s+([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/.exec(commaParts[1]);
    if (m) { city = m[1].trim(); state = m[2]; zip = m[3] || ''; }
    else city = commaParts[1];
  } else {
    // No commas — try to peel state/zip off the end
    const m = /^(.*?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(s);
    if (m) { street = m[1]; state = m[2]; zip = m[3]; }
    else street = s;
  }
  return { street, city, state: state || 'FL', zip };
}

function formatAddress(a) {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return [a.street, a.city, a.state, a.zip].filter(Boolean).join(', ');
}
