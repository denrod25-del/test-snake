// netlify/functions/send-alert-digest.js
// ---------------------------------------------------------------------------
// Scheduled Netlify Function — daily signal-alert email digest for subscribers
// who saved watch prefs on Property Intelligence (Supabase alert_subscriptions).
//
// Triggers:
//   1. Netlify scheduled cron (daily 12:00 UTC — netlify.toml)
//   2. POST with Authorization: Bearer <ALERT_DIGEST_SECRET>
//
// Required Netlify env vars:
//   RESEND_API_KEY        — Resend API key (free tier: 100/day, 3,000/mo)
//   RESEND_FROM           — verified sender (optional; defaults to onboarding@resend.dev)
//   SUPABASE_URL / SUPABASE_SERVICE_KEY — already configured
//   ALERT_DIGEST_SECRET   — optional bearer token for manual trigger
//
// NOTE: Do NOT add npm deps to netlify/functions/package.json. Netlify then
// installs only that lockfile and stops resolving @supabase/supabase-js from
// the repo root — which breaks every function build (production stuck).
// Call Resend via HTTPS instead of the resend SDK.
// ---------------------------------------------------------------------------

const https = require('https');
const {
  createWorkingSupabaseAdminClient,
  cleanEnv,
  getCanonicalSiteUrl,
} = require('./_lib/config');

const MAX_EMAILS_PER_RUN = 80;

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
        try {
          resolve(JSON.parse(buf));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function postJson(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (d) => (buf += d));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = buf ? JSON.parse(buf) : null;
          } catch (_) {
            parsed = { raw: buf };
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendResendEmail({ apiKey, from, to, subject, html }) {
  const result = await postJson(
    'api.resend.com',
    '/emails',
    { Authorization: `Bearer ${apiKey}` },
    { from, to: [to], subject, html }
  );
  if (result.status >= 200 && result.status < 300) {
    return { ok: true, id: result.body && result.body.id };
  }
  const msg =
    (result.body && (result.body.message || result.body.name)) ||
    `Resend HTTP ${result.status}`;
  return { ok: false, error: msg };
}

async function loadFeeds(site) {
  const [sales, permits, certs] = await Promise.all([
    fetchJson(`${site}/sales.json`).catch(() => ({ sales: {} })),
    fetchJson(`${site}/data/signals/recent-permits.json`).catch(() => ({ permits: [] })),
    fetchJson(`${site}/data/signals/pbc-county-held-certs.json`).catch(() => ({
      certificates: [],
      count: 0,
    })),
  ]);
  return { sales, permits, certs };
}

function upcomingSales(salesDoc, countyFilter) {
  const byCounty = salesDoc.sales || {};
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];
  const keys =
    countyFilter === 'statewide'
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
  const slug = String(countySlug || '').toLowerCase();
  return permits
    .filter((p) => {
      const src = `${p.source || ''} ${p.address || ''} ${p.city || ''}`.toLowerCase();
      if (slug === 'palm-beach') {
        return /west.?palm|wpb|boca|jupiter|palm.?beach|boynton|delray/.test(src);
      }
      return src.includes(slug.replace(/-/g, ' ')) || src.includes(slug);
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
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function countyLabel(slug) {
  if (!slug || slug === 'statewide') return 'Statewide';
  return String(slug)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDigestHtml(prefs, feeds, site) {
  const county = prefs.county || 'statewide';
  const label = countyLabel(county);
  const sections = [];

  sections.push(`
    <h2 style="font-family:Georgia,serif;font-size:22px;margin:0 0 8px;">
      Your DeedScout Signal Digest
    </h2>
    <p style="color:#666;font-size:13px;margin:0 0 20px;">
      ${esc(label)} · ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </p>
  `);

  if (prefs.watch_tax) {
    const upcoming = upcomingSales(feeds.sales, county);
    const rows = upcoming.length
      ? upcoming
          .map(
            (s) =>
              `<tr><td style="padding:4px 12px 4px 0">${esc(s.county)}</td><td style="padding:4px 12px 4px 0">${fmtDate(s.date)}</td><td style="padding:4px 0">${s.count != null ? s.count + ' parcels' : '—'}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="3" style="color:#999">No upcoming dates in current feed</td></tr>';
    sections.push(`
      <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
        <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">Tax Deed Calendar</h3>
        <table style="font-size:14px;border-collapse:collapse">${rows}</table>
        <p style="font-size:12px;color:#999;margin:8px 0 0">
          <a href="${site}/tax-deeds.html" style="color:#8b6914">Open Tax Deeds →</a>
        </p>
      </div>
    `);
  }

  if (prefs.watch_permits) {
    const matched = matchPermits(feeds.permits.permits || feeds.permits || [], county);
    if (matched.length) {
      const rows = matched
        .map(
          (p) =>
            `<li style="margin-bottom:6px"><strong>${esc(p.type || 'Permit')}</strong> · ${esc(p.source || '')}<br/><span style="color:#999;font-size:12px">${fmtDate(p.date)} · ${esc(p.address || p.parcelId || '')}</span></li>`
        )
        .join('');
      sections.push(`
        <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
          <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">New Permits</h3>
          <ul style="padding-left:18px;margin:0">${rows}</ul>
          <p style="font-size:12px;color:#999;margin:8px 0 0">
            <a href="${site}/property-intelligence.html#signal-alerts" style="color:#8b6914">Property Intelligence →</a>
          </p>
        </div>
      `);
    } else {
      sections.push(`
        <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
          <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">New Permits</h3>
          <p style="color:#999;font-size:13px;margin:0">No cached permit matches for ${esc(label)} today.</p>
        </div>
      `);
    }
  }

  if (prefs.watch_certs && (county === 'palm-beach' || county === 'statewide')) {
    const certs = (feeds.certs.certificates || []).slice(0, 5);
    if (certs.length) {
      const rows = certs
        .map(
          (c) =>
            `<li style="margin-bottom:4px">#${esc(c.certificateNumber || c.cert_number || '')} · ${fmtMoney(c.faceAmount || c.face_amount)} · PIN ${esc(c.pin || c.pcn || '')}</li>`
        )
        .join('');
      sections.push(`
        <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
          <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">PBC County-Held Certificates</h3>
          <ul style="padding-left:18px;margin:0">${rows}</ul>
          <p style="font-size:12px;color:#999;margin:8px 0 0">${feeds.certs.count || certs.length} in feed</p>
        </div>
      `);
    }
  }

  if (prefs.watch_zoning) {
    sections.push(`
      <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
        <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">Zoning</h3>
        <p style="font-size:13px;margin:0">Zoning GIS stamps are available for 10+ counties —
          <a href="${site}/property-intelligence.html?county=${encodeURIComponent(county === 'statewide' ? 'palm-beach' : county)}&amp;mode=pcn" style="color:#8b6914">look up a parcel</a>.
        </p>
      </div>
    `);
  }

  if (prefs.watch_flood) {
    sections.push(`
      <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
        <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">Flood / FIRM</h3>
        <p style="font-size:13px;margin:0">
          <a href="${site}/property-intelligence.html?county=${encodeURIComponent(county === 'statewide' ? 'palm-beach' : county)}&amp;mode=pcn" style="color:#8b6914">Open parcel search →</a>
          · <a href="https://msc.fema.gov/portal/home" style="color:#8b6914" target="_blank" rel="noopener">FEMA MSC →</a>
        </p>
      </div>
    `);
  }

  if (prefs.notes) {
    sections.push(`
      <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:18px;">
        <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#666;letter-spacing:0.05em;">Your notes</h3>
        <p style="font-size:13px;margin:0;color:#444">${esc(prefs.notes)}</p>
      </div>
    `);
  }

  sections.push(`
    <div style="border-top:1px solid #e5e0d5;padding-top:14px;margin-top:24px;color:#999;font-size:11px;">
      <p>DeedScout · Independent research tool · Not legal, tax, title, or investment advice.</p>
      <p>You received this because you saved signal-alert prefs on
        <a href="${site}/property-intelligence.html#signal-alerts" style="color:#8b6914">Property Intelligence</a>.
      </p>
    </div>
  `);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a2233;background:#faf8f4;">
${sections.join('')}
</body></html>`;
}

exports.handler = async (event) => {
  const headers = event.headers || {};
  const isSchedule =
    headers['x-netlify-event'] === 'schedule' ||
    headers['X-Netlify-Event'] === 'schedule';
  const secret = cleanEnv('ALERT_DIGEST_SECRET');
  const auth = headers.authorization || headers.Authorization || '';
  const isManual = !!(secret && auth === `Bearer ${secret}`);

  if (!isSchedule && !isManual) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const apiKey = cleanEnv('RESEND_API_KEY');
  if (!apiKey) {
    // Do not fail the scheduled run — site stays healthy until env is set.
    return {
      statusCode: 200,
      body: JSON.stringify({
        sent: 0,
        note: 'RESEND_API_KEY not configured. Set it in Netlify → Site → Environment variables.',
      }),
    };
  }

  const site = getCanonicalSiteUrl();
  const from =
    cleanEnv('RESEND_FROM') || 'DeedScout <onboarding@resend.dev>';

  let supabase;
  try {
    const result = await createWorkingSupabaseAdminClient();
    supabase = result.client;
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase: ' + (err.message || err) }),
    };
  }

  const { data: subs, error: subErr } = await supabase
    .from('alert_subscriptions')
    .select(
      'id, user_id, county, surplus, watch_zoning, watch_permits, watch_tax, watch_certs, watch_flood, notes, created_at'
    );

  if (subErr) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'alert_subscriptions: ' + subErr.message }),
    };
  }

  if (!subs || !subs.length) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        sent: 0,
        note: 'No subscribers in alert_subscriptions yet.',
      }),
    };
  }

  const userIds = [...new Set(subs.map((s) => s.user_id).filter(Boolean))];
  const emailMap = {};
  for (const uid of userIds) {
    try {
      const { data } = await supabase.auth.admin.getUserById(uid);
      if (data && data.user && data.user.email) {
        emailMap[uid] = data.user.email;
      }
    } catch (_) {
      /* skip */
    }
  }

  let feeds;
  try {
    feeds = await loadFeeds(site);
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Feed load: ' + (err.message || err) }),
    };
  }

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
      watch_certs: !!(sub.watch_certs || sub.surplus),
      watch_flood: !!sub.watch_flood,
      notes: sub.notes || '',
    };

    const html = buildDigestHtml(prefs, feeds, site);
    const subject = `DeedScout Signal Digest · ${countyLabel(prefs.county)} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    try {
      const result = await sendResendEmail({
        apiKey,
        from,
        to: email,
        subject,
        html,
      });
      if (result.ok) sent += 1;
      else errors.push(`${email}: ${result.error}`);
    } catch (err) {
      errors.push(`${email}: ${err.message || err}`);
    }
  }

  console.log(`Alert digest: sent=${sent}, errors=${errors.length}`, errors.slice(0, 5));
  return {
    statusCode: 200,
    body: JSON.stringify({
      sent,
      errors: errors.length,
      errorSamples: errors.slice(0, 3),
    }),
  };
};
