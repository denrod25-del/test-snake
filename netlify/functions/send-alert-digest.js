// netlify/functions/send-alert-digest.js
// ---------------------------------------------------------------------------
// Scheduled Netlify Function — sends a daily signal-alert email digest to
// subscribers who registered via the Property Intelligence watch form.
//
// Reads subscriber prefs from Supabase alert_subscriptions, assembles a
// per-county digest from static feed JSON files, and sends via Resend.
//
// Triggers:
//   1. Netlify scheduled cron (daily 12:00 UTC, configured in netlify.toml)
//   2. POST with Authorization: Bearer <ALERT_DIGEST_SECRET>
//
// Required Netlify env vars:
//   RESEND_API_KEY        — Resend API key (free tier: 100/day, 3,000/mo)
//   RESEND_FROM           — verified sender, e.g. "DeedScout <alerts@deedscout.app>"
//                           (falls back to "DeedScout <onboarding@resend.dev>" for testing)
//   SUPABASE_URL          — (already configured)
//   SUPABASE_SERVICE_KEY  — (already configured)
//   ALERT_DIGEST_SECRET   — optional bearer token for manual trigger
// ---------------------------------------------------------------------------

const { Resend } = require('resend');
const https = require('https');
const {
  createWorkingSupabaseAdminClient,
  cleanEnv,
  getCanonicalSiteUrl,
} = require('./_lib/config');

const SITE = 'https://deedscout.netlify.app';
const MAX_EMAILS_PER_RUN = 80; // stay within free-tier daily cap with margin

function fetchJson(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`${url} → ${res.statusCode}`));
      }
      let buf = '';
      res.on('data', (d) => (buf += d));
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function loadFeeds() {
  const base = SITE;
  const [sales, permits, certs] = await Promise.all([
    fetchJson(`${base}/sales.json`).catch(() => ({ sales: {} })),
    fetchJson(`${base}/data/signals/recent-permits.json`).catch(() => ({ permits: [] })),
    fetchJson(`${base}/data/signals/pbc-county-held-certs.json`).catch(() => ({ certificates: [], count: 0 })),
  ]);
  return { sales, permits, certs };
}

function upcomingSales(salesDoc, countyFilter) {
  const byCounty = salesDoc.sales || {};
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];
  const keys = countyFilter === 'statewide'
    ? Object.keys(byCounty)
    : [countyFilter].filter((k) => byCounty[k]);
  for (const county of keys) {
    for (const s of byCounty[county] || []) {
      if (s.date && s.date >= today) {
        entries.push({ county, date: s.date, count: s.count || null });
      }
    }
  }
  entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return entries.slice(0, 10);
}

function matchPermits(permits, countySlug) {
  if (!permits || !permits.length) return [];
  if (countySlug === 'statewide') return permits.slice(0, 8);
  const slug = countySlug.toLowerCase();
  return permits
    .filter((p) => {
      const src = (p.source || '').toLowerCase();
      const addr = (p.address || '').toLowerCase();
      if (slug === 'palm-beach') return /west-palm|wpb|boca|jupiter|palm.?beach/.test(src + ' ' + addr);
      if (slug === 'martin' || slug === 'st-lucie') return /st.?lucie|stuart/.test(src + ' ' + addr);
      return false;
    })
    .slice(0, 8);
}

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return s;
}

function fmtMoney(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function countyLabel(slug) {
  if (!slug || slug === 'statewide') return 'Statewide';
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildDigestHtml(prefs, feeds) {
  const county = prefs.county || 'statewide';
  const label = countyLabel(county);
  const sections = [];

  sections.push(`
    <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 8px;">
      Your DeedScout Signal Digest
    </h2>
    <p style="color:#666;font-size:13px;margin:0 0 20px;">
      ${label} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    </p>
  `);

  if (prefs.watch_tax) {
    const salesKey = county === 'miami-dade' ? 'Miami-Dade'
      : county === 'palm-beach' ? 'Palm Beach'
      : label;
    const upcoming = upcomingSales(feeds.sales, salesKey);
    const rows = upcoming.length
      ? upcoming.map((s) =>
          `<tr><td style="padding:4px 12px 4px 0">${esc(s.county)}</td><td style="padding:4px 12px 4px 0">${fmtDate(s.date)}</td><td style="padding:4px 0">${s.count != null ? s.count + ' parcels' : '—'}</td></tr>`
        ).join('')
      : '<tr><td colspan="3" style="color:#999">No upcoming dates in current feed</td></tr>';
    sections.push(`
      <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
        <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">
          📅 Tax Deed Calendar
        </h3>
        <table style="font-size:14px;border-collapse:collapse">${rows}</table>
        <p style="font-size:12px;color:#999;margin:8px 0 0">
          <a href="${SITE}/tax-deeds.html" style="color:#8b6914">Open Tax Deeds →</a>
        </p>
      </div>
    `);
  }

  if (prefs.watch_permits) {
    const matched = matchPermits(feeds.permits.permits || [], county);
    if (matched.length) {
      const rows = matched.map((p) =>
        `<li style="margin-bottom:6px"><strong>${esc(p.type || 'Permit')}</strong> · ${esc(p.source)}<br/><span style="color:#999;font-size:12px">${fmtDate(p.date)} · ${esc(p.address || p.parcelId || '')}</span></li>`
      ).join('');
      sections.push(`
        <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
          <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">
            🏗️ New Permits
          </h3>
          <ul style="padding-left:18px;margin:0">${rows}</ul>
          <p style="font-size:12px;color:#999;margin:8px 0 0">
            <a href="${SITE}/permit-search.html" style="color:#8b6914">Full Permit Search →</a>
          </p>
        </div>
      `);
    } else {
      sections.push(`
        <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
          <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">
            🏗️ New Permits
          </h3>
          <p style="color:#999;font-size:13px;margin:0">No cached permit matches for ${esc(label)} today. <a href="${SITE}/permit-search.html" style="color:#8b6914">Browse all →</a></p>
        </div>
      `);
    }
  }

  if (prefs.watch_certs && (county === 'palm-beach' || county === 'statewide')) {
    const certs = (feeds.certs.certificates || []).slice(0, 5);
    if (certs.length) {
      const rows = certs.map((c) =>
        `<li style="margin-bottom:4px">#${esc(c.certificateNumber)} · ${fmtMoney(c.faceAmount)} · PIN ${esc(c.pin)}</li>`
      ).join('');
      sections.push(`
        <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
          <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">
            📜 PBC County-Held Certificates
          </h3>
          <ul style="padding-left:18px;margin:0">${rows}</ul>
          <p style="font-size:12px;color:#999;margin:8px 0 0">${feeds.certs.count || 0} total · <a href="https://www.pbctax.gov/taxes/property-tax/tax-certificates-and-deeds/" style="color:#8b6914" target="_blank">Tax Collector source →</a></p>
        </div>
      `);
    }
  }

  if (prefs.watch_zoning) {
    sections.push(`
      <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
        <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">
          🗺️ Zoning
        </h3>
        <p style="font-size:13px;margin:0">Zoning GIS stamps are available for 10+ counties — <a href="${SITE}/property-intelligence.html?county=${encodeURIComponent(county)}&mode=pcn" style="color:#8b6914">look up a parcel</a> to see the live stamp.</p>
      </div>
    `);
  }

  if (prefs.watch_flood) {
    sections.push(`
      <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
        <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">
          🌊 Flood / FIRM
        </h3>
        <p style="font-size:13px;margin:0">FEMA NFHL flood stamps + county GIS available for 23 counties. <a href="${SITE}/property-intelligence.html?county=${encodeURIComponent(county)}&mode=pcn" style="color:#8b6914">Open parcel search →</a> · <a href="https://msc.fema.gov/portal/home" style="color:#8b6914" target="_blank">FEMA MSC →</a></p>
      </div>
    `);
  }

  sections.push(`
    <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:24px;color:#999;font-size:11px;">
      <p>DeedScout · Independent research tool · Not legal, tax, title, or investment advice.</p>
      <p>You received this because you signed up for signal alerts on <a href="${SITE}/property-intelligence.html#signal-alerts" style="color:#8b6914">Property Intelligence</a>. To stop, clear your watch prefs on that page or reply "unsubscribe".</p>
    </div>
  `);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a2233;background:#faf8f4;">
${sections.join('')}
</body></html>`;
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

exports.handler = async (event) => {
  // Auth: scheduled cron or bearer token
  const isSchedule = (event.headers || {})['x-netlify-event'] === 'schedule';
  const secret = cleanEnv('ALERT_DIGEST_SECRET');
  const auth = (event.headers || {}).authorization || '';
  const isManual = secret && auth === `Bearer ${secret}`;

  if (!isSchedule && !isManual) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const apiKey = cleanEnv('RESEND_API_KEY');
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'RESEND_API_KEY not configured. Set it in Netlify → Site → Environment variables.' }),
    };
  }

  const from = cleanEnv('RESEND_FROM') || 'DeedScout <onboarding@resend.dev>';
  const resend = new Resend(apiKey);

  let supabase;
  try {
    const result = await createWorkingSupabaseAdminClient();
    supabase = result.client;
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase: ' + err.message }) };
  }

  // Load subscribers from alert_subscriptions
  const { data: subs, error: subErr } = await supabase
    .from('alert_subscriptions')
    .select('id, user_id, county, surplus, watch_zoning, watch_permits, watch_tax, watch_certs, watch_flood, notes, created_at');

  if (subErr) {
    return { statusCode: 500, body: JSON.stringify({ error: 'alert_subscriptions: ' + subErr.message }) };
  }

  if (!subs || !subs.length) {
    // Also check Netlify Forms submissions for Beta intake emails
    // For now, log and return — no subscribers in DB yet.
    console.log('No alert_subscriptions rows found. Beta intake lives in Netlify Forms only.');
    return {
      statusCode: 200,
      body: JSON.stringify({ sent: 0, note: 'No subscribers in alert_subscriptions yet. Beta intake is Netlify Forms only.' }),
    };
  }

  // Resolve emails from auth.users
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const emailMap = {};
  for (const uid of userIds) {
    try {
      const { data } = await supabase.auth.admin.getUserById(uid);
      if (data?.user?.email) emailMap[uid] = data.user.email;
    } catch { /* skip */ }
  }

  // Load feed data
  let feeds;
  try {
    feeds = await loadFeeds();
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Feed load: ' + err.message }) };
  }

  // Send digests
  let sent = 0;
  const errors = [];
  for (const sub of subs.slice(0, MAX_EMAILS_PER_RUN)) {
    const email = emailMap[sub.user_id];
    if (!email) continue;

    const prefs = {
      county: sub.county || 'statewide',
      watch_tax: sub.watch_tax !== false,
      watch_permits: sub.watch_permits !== false,
      watch_zoning: sub.watch_zoning !== false,
      watch_certs: sub.watch_certs || sub.surplus || false,
      watch_flood: sub.watch_flood || false,
      notes: sub.notes || '',
    };

    const html = buildDigestHtml(prefs, feeds);
    const subject = `DeedScout Signal Digest · ${countyLabel(prefs.county)} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    try {
      const { error } = await resend.emails.send({
        from,
        to: [email],
        subject,
        html,
      });
      if (error) {
        errors.push(`${email}: ${error.message}`);
      } else {
        sent++;
      }
    } catch (err) {
      errors.push(`${email}: ${err.message}`);
    }
  }

  console.log(`Alert digest: sent=${sent}, errors=${errors.length}`, errors.slice(0, 5));
  return {
    statusCode: 200,
    body: JSON.stringify({ sent, errors: errors.length, errorSamples: errors.slice(0, 3) }),
  };
};
