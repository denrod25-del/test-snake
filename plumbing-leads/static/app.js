// =============================================================
// PalmLeads frontend — trades-pro UI
// =============================================================

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const state = {
  leads: [],
  selectedId: null,
  selectedLead: null,
  selectedTemplates: null,
  mapFilter: 'all',
  map: null,
  markers: null,
  filters: { search: '', status: '', sort: 'score_desc', noSite: false },
};

// ---------------- helpers ----------------
function escHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function starsHTML(rating) {
  if (!rating) return '<span style="color:var(--faint)">—</span>';
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return `<span class="stars">${'★'.repeat(full)}${half ? '½' : ''}</span>` +
         `<span style="font-weight:700;color:var(--ink);margin-left:4px">${rating.toFixed(1)}</span>`;
}

function setStatus(msg, state = 'idle') {
  $('#statusText').textContent = msg;
  $('#statusDot').className = 'dot ' + state;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const j = await r.json(); msg = j.detail || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

// ---------------- lead score ----------------
// Broker-oriented scoring 0-100. Higher = better lead to PITCH.
//   - reachable (phone): +25
//   - marketing gap (no website): +30 (else +10 still useful)
//   - credibility (rating): up to +30
//   - volume (reviews): up to +15
function scoreLead(L) {
  let score = 0;

  if (L.phone) score += 25;

  score += L.no_website ? 30 : 10;

  const rating = L.rating || 0;
  if (rating >= 4.5) score += 30;
  else if (rating >= 4.0) score += 25;
  else if (rating >= 3.5) score += 18;
  else if (rating >= 3.0) score += 12;
  else if (rating > 0)    score += 5;

  const reviews = L.reviews || 0;
  if (reviews >= 100) score += 15;
  else if (reviews >= 50) score += 12;
  else if (reviews >= 20) score += 9;
  else if (reviews >= 5)  score += 5;
  else if (reviews > 0)   score += 2;

  return Math.min(100, score);
}

function scoreClass(s) {
  if (s >= 75) return 'hot';
  if (s >= 55) return 'warm';
  if (s >= 30) return 'cold';
  return 'dead';
}

function scoreBadge(s) {
  return `<span class="score ${scoreClass(s)}">${s}</span>`;
}

// ---------------- theme ----------------
const THEME_KEY = 'palmleads.theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('#themeIcon').textContent = theme === 'dark' ? '☀️' : '🌙';
  if (state.map) state.map.invalidateSize();
}

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
})();

$('#themeToggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ---------------- tabs ----------------
$$('.tab').forEach(t => {
  t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.view').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('#view-' + t.dataset.view).classList.add('active');

    if (t.dataset.view === 'pipeline') loadPipeline();
    if (t.dataset.view === 'map') {
      loadPipeline().then(() => {
        ensureMap();
        renderMap();
      });
    }
  });
});

// ---------------- bootstrap ----------------
async function bootstrap() {
  try {
    const cfg = await api('/api/config');
    if (!cfg.has_api_key) $('#apiNotice').style.display = 'flex';
    $('#brokerLabel').textContent = `${cfg.broker.company} · ${cfg.broker.name}`;
  } catch {
    $('#apiNotice').style.display = 'flex';
  }
  loadPipeline();
}

// =============================================================
// SEARCH VIEW
// =============================================================
$('#searchBtn').addEventListener('click', runSearch);

async function runSearch() {
  const body = {
    location:    $('#location').value.trim() || 'West Palm Beach, FL',
    radius_miles: parseFloat($('#radius').value) || 15,
    keyword:     $('#keyword').value.trim() || 'plumber',
    min_rating:  parseFloat($('#minRating').value) || 0,
    max_results: parseInt($('#maxResults').value) || 60,
    save:        true,
  };

  const btn = $('#searchBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Searching…';
  setStatus(`Searching "${body.keyword}" near ${body.location}…`, 'active');

  $('#searchResultsBody').innerHTML =
    `<tr><td colspan="6"><div class="empty"><span class="spinner"></span><p style="margin-top:10px">Querying Google Places API…</p></div></td></tr>`;

  try {
    const data = await api('/api/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    renderSearchResults(data.results);
    $('#resultsHeadCount').textContent = `${data.count} businesses found`;
    setStatus(
      `✓ ${data.count} found · ${data.db.inserted} new · ${data.db.skipped_duplicates} duplicates skipped`,
      'idle'
    );
    loadPipeline();
  } catch (e) {
    setStatus('✗ ' + e.message, 'error');
    $('#searchResultsBody').innerHTML =
      `<tr><td colspan="6"><div class="empty"><div class="empty-icon">⚠️</div><p><strong>Error:</strong> ${escHTML(e.message)}</p></div></td></tr>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Run search →';
  }
}

function renderSearchResults(results) {
  const body = $('#searchResultsBody');
  if (!results.length) {
    body.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-icon">🤷</div><p>No results. Try a different keyword or wider radius.</p></div></td></tr>`;
    return;
  }

  body.innerHTML = results.map(r => {
    const score = scoreLead({ ...r, no_website: !r.website });
    const phone = r.phone
      ? `<a href="tel:${escHTML(r.phone)}" style="color:var(--orange);font-weight:600;text-decoration:none" onclick="event.stopPropagation()">${escHTML(r.phone)}</a>`
      : '<span style="color:var(--faint)">—</span>';
    const site = r.website
      ? `<a href="${escHTML(r.website)}" target="_blank" style="color:var(--orange);font-weight:600;text-decoration:none" onclick="event.stopPropagation()">site ↗</a>`
      : '<span class="pill pill-no-site">NO SITE</span>';

    return `<tr onclick="selectAndJump('${escHTML(r.place_id)}')">
      <td class="name-cell">${escHTML(r.name)}</td>
      <td>${scoreBadge(score)}</td>
      <td>${starsHTML(r.rating)} <span style="color:var(--muted);font-size:12px">(${(r.reviews||0).toLocaleString()})</span></td>
      <td>${phone}</td>
      <td>${site}</td>
      <td style="font-size:12px;color:var(--muted);max-width:240px">${escHTML(r.address)}</td>
    </tr>`;
  }).join('');
}

window.selectAndJump = (placeId) => {
  $('.tab[data-view="pipeline"]').click();
  setTimeout(() => selectLead(placeId), 100);
};

// =============================================================
// PIPELINE VIEW
// =============================================================
let pipelineDebounce = null;

['pipeSearch', 'pipeStatus', 'pipeSort', 'pipeNoSite'].forEach(id => {
  $('#' + id).addEventListener('input', () => {
    clearTimeout(pipelineDebounce);
    pipelineDebounce = setTimeout(loadPipeline, 200);
  });
});

$('#exportBtn').addEventListener('click', () => {
  const params = new URLSearchParams();
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.noSite) params.set('no_website_only', 'true');
  window.location.href = '/api/export.csv?' + params.toString();
});

async function loadPipeline() {
  state.filters = {
    search: $('#pipeSearch').value.trim(),
    status: $('#pipeStatus').value,
    sort:   $('#pipeSort').value,
    noSite: $('#pipeNoSite').checked,
  };

  // backend doesn't know about score_desc — sort client-side after fetch
  const backendSort = state.filters.sort === 'score_desc'
    ? 'created_desc' : state.filters.sort;

  const params = new URLSearchParams({ sort: backendSort });
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.noSite) params.set('no_website_only', 'true');

  try {
    const data = await api('/api/leads?' + params.toString());
    state.leads = data.leads.map(L => ({ ...L, _score: scoreLead(L) }));
    if (state.filters.sort === 'score_desc') {
      state.leads.sort((a, b) => b._score - a._score);
    }
    renderStats(data.stats);
    renderLeadList();
    $('#tabCount').textContent = data.stats.total;

    if ($('#view-map').classList.contains('active')) renderMap();
  } catch (e) {
    console.error(e);
  }
}

function renderStats(s) {
  $('#statTotal').textContent = s.total;
  $('#statNew').textContent = s.by_status.new || 0;
  $('#statContacted').textContent = s.by_status.contacted || 0;
  $('#statQualified').textContent = s.by_status.qualified || 0;
  $('#statClosed').textContent = s.by_status.closed || 0;
  $('#statNoSite').textContent = s.no_website;
}

function renderLeadList() {
  const list = $('#leadList');
  if (!state.leads.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>No leads match your filters.</p></div>`;
    return;
  }

  list.innerHTML = state.leads.map(L => {
    const sel = L.place_id === state.selectedId ? 'selected' : '';
    const phoneIcon = L.phone
      ? `<button class="lead-action" title="Call ${escHTML(L.phone)}" onclick="callLead(event,'${escHTML(L.phone)}')">📞</button>`
      : '';
    const emailIcon = (L.emails && L.emails.length)
      ? `<button class="lead-action" title="Email ${escHTML(L.emails[0])}" onclick="emailLead(event,'${escHTML(L.emails[0])}')">✉</button>`
      : '';
    const contactedIcon = L.status === 'new'
      ? `<button class="lead-action success" title="Mark contacted" onclick="markContacted(event,'${escHTML(L.place_id)}')">✓</button>`
      : '';

    const noSiteTag = L.no_website ? '<span class="pill pill-no-site">NO SITE</span>' : '';
    const enrichTag = L.last_enriched_at ? '' : '';

    return `
      <div class="lead-row ${sel}" onclick="selectLead('${escHTML(L.place_id)}')">
        <div class="lead-row-main">
          <div class="lead-row-name">${escHTML(L.name)}</div>
          <div class="lead-row-meta">
            <span>${starsHTML(L.rating)}</span>
            <span style="color:var(--faint)">·</span>
            <span>${(L.reviews || 0).toLocaleString()} reviews</span>
            ${L.phone ? `<span style="color:var(--faint)">·</span><span>${escHTML(L.phone)}</span>` : ''}
          </div>
          <div class="lead-row-tags">
            <span class="pill pill-${L.status}">${L.status}</span>
            ${noSiteTag}
          </div>
        </div>
        <div class="lead-row-side">
          ${scoreBadge(L._score)}
          <div class="lead-actions">
            ${phoneIcon}${emailIcon}${contactedIcon}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.callLead = (e, phone) => {
  e.stopPropagation();
  window.location.href = `tel:${phone}`;
};

window.emailLead = (e, email) => {
  e.stopPropagation();
  window.location.href = `mailto:${email}`;
};

window.markContacted = async (e, placeId) => {
  e.stopPropagation();
  try {
    await api(`/api/leads/${encodeURIComponent(placeId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'contacted' }),
    });
    loadPipeline();
    if (state.selectedId === placeId) selectLead(placeId);
  } catch (err) {
    alert('Update failed: ' + err.message);
  }
};

// =============================================================
// LEAD DETAIL (right pane)
// =============================================================
async function selectLead(placeId) {
  state.selectedId = placeId;
  // re-render list to show selection highlight
  renderLeadList();
  const pane = $('#detailPane');
  pane.innerHTML = `<div class="detail-empty"><span class="spinner"></span><p style="margin-top:10px">Loading…</p></div>`;
  try {
    const data = await api(`/api/leads/${encodeURIComponent(placeId)}`);
    state.selectedLead = data.lead;
    state.selectedTemplates = data.templates;
    renderDetail(data.lead, data.templates);
  } catch (e) {
    pane.innerHTML = `<div class="detail-empty"><div class="detail-empty-icon">⚠️</div><p>${escHTML(e.message)}</p></div>`;
  }
}
window.selectLead = selectLead;

function renderDetail(L, T) {
  const score = scoreLead(L);

  const emailsHTML = (L.emails && L.emails.length)
    ? L.emails.map(e => `<a href="mailto:${escHTML(e)}">${escHTML(e)}</a>`).join('<br>')
    : '<span style="color:var(--faint)">— click <em>Enrich</em> below to scrape</span>';

  const socialsHTML = (L.socials && Object.keys(L.socials).length)
    ? Object.entries(L.socials).map(([k, v]) =>
        `<a href="${escHTML(v)}" target="_blank" class="pill pill-service" style="background:var(--indigo-soft);color:var(--indigo);text-decoration:none">${escHTML(k)} ↗</a>`).join(' ')
    : '<span style="color:var(--faint)">—</span>';

  const servicesHTML = (L.services && L.services.length)
    ? L.services.map(s => `<span class="pill pill-service">${escHTML(s)}</span>`).join(' ')
    : '<span style="color:var(--faint)">—</span>';

  $('#detailPane').innerHTML = `
    <div class="detail-header">
      <div class="detail-title">
        <div class="detail-name">${escHTML(L.name)}</div>
        <div class="detail-sub">
          ${scoreBadge(score)}
          <span class="pill pill-${L.status}">${L.status}</span>
          ${L.no_website ? '<span class="pill pill-no-site">NO SITE</span>' : ''}
          <span style="color:var(--muted)">${starsHTML(L.rating)} · ${(L.reviews||0).toLocaleString()} reviews</span>
        </div>
      </div>
      <div class="detail-actions">
        <a class="btn btn-secondary btn-sm" href="${escHTML(L.google_url)}" target="_blank" style="text-decoration:none">📍 Maps</a>
        <button class="btn btn-danger btn-sm" id="deleteLeadBtn">Delete</button>
      </div>
    </div>

    <div class="detail-body">

      <div class="kv-grid">
        <div class="kv accent">
          <div class="kv-key">Phone</div>
          <div class="kv-val">${L.phone ? `<a href="tel:${escHTML(L.phone)}">${escHTML(L.phone)}</a>` : '<span style="color:var(--faint)">—</span>'}</div>
        </div>
        <div class="kv">
          <div class="kv-key">Website</div>
          <div class="kv-val">${L.website
            ? `<a href="${escHTML(L.website)}" target="_blank">${escHTML(L.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))} ↗</a>`
            : '<span class="pill pill-no-site">NO WEBSITE</span>'}</div>
        </div>
        <div class="kv" style="grid-column:1/-1">
          <div class="kv-key">Address</div>
          <div class="kv-val">${escHTML(L.address)}</div>
        </div>
        <div class="kv">
          <div class="kv-key">Emails</div>
          <div class="kv-val">${emailsHTML}</div>
        </div>
        <div class="kv">
          <div class="kv-key">Social</div>
          <div class="kv-val">${socialsHTML}</div>
        </div>
        <div class="kv" style="grid-column:1/-1">
          <div class="kv-key">Detected services</div>
          <div class="kv-val">${servicesHTML}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📞 Status & notes</div>
        <div class="status-row">
          <div class="field">
            <label class="field-label">Status</label>
            <select id="leadStatus">
              ${['new','contacted','qualified','closed','dead'].map(s =>
                `<option value="${s}" ${L.status===s?'selected':''}>${s.toUpperCase()}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label">Notes</label>
            <textarea id="leadNotes" placeholder="Call notes, follow-up dates, decision maker name…">${escHTML(L.notes || '')}</textarea>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-primary btn-sm" id="saveLeadBtn">Save changes</button>
          <button class="btn btn-secondary btn-sm" id="enrichBtn">
            ${L.last_enriched_at ? '🔄 Re-enrich website' : '🔎 Enrich website'}
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">✉️ Outreach templates <span style="color:var(--faint);font-weight:500;text-transform:none;letter-spacing:0">(broker pitch)</span></div>

        ${tplCard('SMS · Cold text', 'sms', T.sms)}
        ${tplCard('Email subject', 'email_subject', T.email_subject)}
        ${tplCard('Email body', 'email', T.email)}
        ${tplCard('Voicemail script', 'voicemail', T.voicemail)}
        ${tplCard('LinkedIn / social DM', 'linkedin_dm', T.linkedin_dm)}
      </div>

    </div>
  `;

  $('#saveLeadBtn').addEventListener('click', saveLead);
  $('#enrichBtn').addEventListener('click', enrichLead);
  $('#deleteLeadBtn').addEventListener('click', deleteLead);
  $$('.copy-btn').forEach(b => b.addEventListener('click', copyTpl));
}

function tplCard(label, key, body) {
  return `
    <div class="tpl">
      <div class="tpl-head">
        <span class="tpl-label">${label}</span>
        <button class="copy-btn" data-copy="${key}">COPY</button>
      </div>
      <div class="tpl-body" id="tpl-${key}">${escHTML(body)}</div>
    </div>
  `;
}

async function saveLead() {
  if (!state.selectedLead) return;
  const btn = $('#saveLeadBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await api(`/api/leads/${encodeURIComponent(state.selectedLead.place_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: $('#leadStatus').value,
        notes: $('#leadNotes').value,
      }),
    });
    btn.textContent = '✓ Saved';
    setTimeout(() => { btn.textContent = 'Save changes'; btn.disabled = false; }, 1200);
    loadPipeline();
  } catch (e) {
    alert('Save failed: ' + e.message);
    btn.disabled = false; btn.textContent = 'Save changes';
  }
}

async function enrichLead() {
  if (!state.selectedLead) return;
  const btn = $('#enrichBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Scraping…';
  try {
    await api(`/api/leads/${encodeURIComponent(state.selectedLead.place_id)}/enrich`, { method: 'POST' });
    selectLead(state.selectedLead.place_id);
    loadPipeline();
  } catch (e) {
    alert('Enrich failed: ' + e.message);
    btn.disabled = false;
    btn.textContent = '🔎 Enrich website';
  }
}

async function deleteLead() {
  if (!state.selectedLead) return;
  if (!confirm(`Delete "${state.selectedLead.name}" from your pipeline?`)) return;
  try {
    await api(`/api/leads/${encodeURIComponent(state.selectedLead.place_id)}`, { method: 'DELETE' });
    state.selectedId = null;
    state.selectedLead = null;
    $('#detailPane').innerHTML = `<div class="detail-empty"><div class="detail-empty-icon">👈</div><p>Select a lead to see details, notes, and outreach templates.</p></div>`;
    loadPipeline();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
}

function copyTpl(e) {
  const key = e.target.dataset.copy;
  const text = $(`#tpl-${key}`).textContent;
  navigator.clipboard.writeText(text).then(() => {
    e.target.classList.add('copied');
    e.target.textContent = '✓ COPIED';
    setTimeout(() => {
      e.target.classList.remove('copied');
      e.target.textContent = 'COPY';
    }, 1400);
  });
}

// =============================================================
// MAP VIEW (Leaflet + OpenStreetMap, no extra API key)
// =============================================================
function ensureMap() {
  if (state.map) return;

  // Palm Beach County rough center
  state.map = L.map('map', { zoomControl: true })
    .setView([26.7056, -80.0364], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  }).addTo(state.map);

  state.markers = L.layerGroup().addTo(state.map);
}

function markerColorForLead(L) {
  if (L.no_website) return '#ff6a1f';
  switch (L.status) {
    case 'new':       return '#2563eb';
    case 'contacted': return '#d97706';
    case 'qualified': return '#16a34a';
    case 'closed':    return '#6366f1';
    case 'dead':      return '#dc2626';
    default:          return '#6c7a8a';
  }
}

function makeIcon(color) {
  return L.divIcon({
    className: 'pl-marker',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function renderMap() {
  if (!state.map) return;
  state.markers.clearLayers();

  const filter = state.mapFilter;
  const filtered = state.leads.filter(L => {
    if (!L.lat || !L.lng) return false;
    if (filter === 'all') return true;
    if (filter === 'no_site') return L.no_website;
    return L.status === filter;
  });

  $('#mapCount').textContent = `${filtered.length} lead${filtered.length === 1 ? '' : 's'}`;

  filtered.forEach(L => {
    const marker = L_marker_for(L);
    marker.addTo(state.markers);
  });

  if (filtered.length) {
    const bounds = L.latLngBounds(filtered.map(l => [l.lat, l.lng]));
    state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }
}

// underscore-named to avoid shadowing leaflet's L global inside closures
function L_marker_for(lead) {
  const icon = makeIcon(markerColorForLead(lead));
  const m = L.marker([lead.lat, lead.lng], { icon });
  const score = scoreLead(lead);
  const popup = `
    <div class="popup-name">${escHTML(lead.name)}</div>
    <div class="popup-meta">
      ${lead.rating ? `${lead.rating.toFixed(1)}★ · ${(lead.reviews||0).toLocaleString()} reviews<br>` : ''}
      ${lead.phone ? escHTML(lead.phone) + '<br>' : ''}
      <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:10px;background:#${score >= 75 ? 'dcfce7;color:#16a34a' : score >= 55 ? 'fef3c7;color:#d97706' : 'eef2f7;color:#6c7a8a'};font-weight:700">SCORE ${score}</span>
      <button onclick="window.openLeadFromMap('${escHTML(lead.place_id)}')"
        style="margin-top:8px;display:block;width:100%;padding:6px;background:#ff6a1f;color:white;border:none;border-radius:5px;font-weight:700;cursor:pointer">
        Open lead
      </button>
    </div>
  `;
  m.bindPopup(popup);
  return m;
}

window.openLeadFromMap = (placeId) => {
  $('.tab[data-view="pipeline"]').click();
  setTimeout(() => selectLead(placeId), 100);
};

$$('.chip[data-mapfilter]').forEach(c => {
  c.addEventListener('click', () => {
    $$('.chip[data-mapfilter]').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.mapFilter = c.dataset.mapfilter;
    renderMap();
  });
});

bootstrap();
