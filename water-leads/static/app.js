/* AquaLeads frontend. Single-page vanilla JS with three tabs:
     1. Water systems   - raw SDWIS rows + flags
     2. Target ZIPs     - ranked homeowner-targeting list
     3. Pipeline        - CRM-style management of those ZIPs
*/
'use strict';

const state = {
  view: 'systems',
  systems: [],
  zips: [],
  pipelineZips: [],
  selectedZip: null,
  config: null,
  map: null,
  mapLayer: null,
  alertTimer: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const fmtNum = (n) => (n || 0).toLocaleString();

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('aqua-theme', theme);
  $('#themeIcon').textContent = theme === 'dark' ? '☀' : '🌙';
}

function setView(view) {
  state.view = view;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'systems') refreshSystems();
  if (view === 'zips') refreshZips();
  if (view === 'map') refreshMap();
  if (view === 'pipeline') refreshPipeline();
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.detail) msg = body.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  const ct = res.headers.get('Content-Type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// ---------------- config + sync ----------------

async function loadConfig() {
  try {
    const cfg = await api('/api/config');
    state.config = cfg;
    const target = cfg.target || {};
    $('#brandSub').textContent = `Water filtration leads \u00b7 ${cap(target.county)} County, ${target.state}`;
    if (cfg.last_sync && cfg.last_sync.finished_at) {
      $('#syncDot').style.color = 'var(--green)';
      $('#syncLabel').textContent = `Synced ${shortDate(cfg.last_sync.finished_at)}`;
    } else {
      $('#syncDot').style.color = 'var(--amber)';
      $('#syncLabel').textContent = 'No sync yet';
    }
    renderStats(cfg.stats);
  } catch (e) {
    console.error(e);
  }
}

function cap(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function shortDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch (_) { return iso; }
}

function renderStats(stats) {
  if (!stats) return;
  $('#statSystems').textContent = fmtNum(stats.water_systems);
  $('#statPop').textContent = fmtNum(stats.total_population);
  $('#statMCL').textContent = fmtNum(stats.open_mcl_violations);
  $('#statLCR').textContent = fmtNum(stats.lcr_exceedances);
  if ($('#statPFAS')) $('#statPFAS').textContent = fmtNum(stats.pfas_zips || 0);
  if ($('#statLeadHigh')) $('#statLeadHigh').textContent = fmtNum(stats.lead_high_zips || 0);
  $('#tabSystems').textContent = fmtNum(stats.water_systems);
  $('#tabZips').textContent = fmtNum(stats.zip_targets);
  $('#tabPipeline').textContent = fmtNum(stats.flagged_zips);

  const badge = $('#alertBadge');
  if (badge) {
    const n = stats.unread_alerts || 0;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.style.display = n > 0 ? 'inline-flex' : 'none';
  }

  const byStatus = stats.by_status || {};
  const pipeStats = $('#pipelineStats');
  pipeStats.innerHTML = [
    ['Total', stats.zip_targets, ''],
    ['Flagged', stats.flagged_zips, 'danger'],
    ['New', byStatus.new || 0, ''],
    ['Researching', byStatus.researching || 0, ''],
    ['Campaign live', byStatus.campaign_live || 0, 'accent'],
    ['Converted', byStatus.converted || 0, 'success'],
  ]
    .map(
      ([label, val, cls]) => `
      <div class="stat ${cls}">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${fmtNum(val)}</div>
      </div>`,
    )
    .join('');
}

async function runSync() {
  const btn = $('#syncBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Syncing from EPA…';
  $('#syncDot').style.color = 'var(--amber)';
  $('#syncLabel').textContent = 'Syncing…';
  const notice = $('#syncNotice');
  notice.style.display = 'flex';
  $('#syncNoticeText').innerHTML =
    '<strong>Pulling EPA SDWIS data…</strong> this usually takes 20–90 seconds ' +
    'for a full county. Water systems, violations, LCR samples, and service ' +
    'areas are being refreshed.';
  try {
    const body = await api('/api/sync', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const r = body.result || {};
    $('#syncNoticeText').innerHTML =
      `<strong>Sync complete.</strong> ${fmtNum(r.water_systems)} systems, ` +
      `${fmtNum(r.violations)} violations, ${fmtNum(r.lcr_results)} LCR samples, ` +
      `${fmtNum(r.zip_targets)} ZIPs ranked.`;
    setTimeout(() => { notice.style.display = 'none'; }, 6000);
    await loadConfig();
    if (state.view === 'systems') refreshSystems();
    if (state.view === 'zips') refreshZips();
    if (state.view === 'pipeline') refreshPipeline();
  } catch (e) {
    notice.className = 'alert';
    $('#syncNoticeText').innerHTML = `<strong>Sync failed:</strong> ${escapeHtml(e.message)}`;
  } finally {
    btn.disabled = false;
    btn.textContent = '↻ Refresh from EPA';
  }
}

// ---------------- systems tab ----------------

async function refreshSystems() {
  const params = new URLSearchParams();
  if ($('#sysFlaggedOnly').checked) params.set('flagged_only', 'true');
  const issue = $('#sysIssueType').value;
  if (issue) params.set('issue_type', issue);
  const minPop = parseInt($('#sysMinPop').value || '0', 10);
  if (minPop > 0) params.set('min_pop', String(minPop));
  const search = $('#sysSearch').value.trim();
  if (search) params.set('search', search);

  try {
    const body = await api(`/api/systems?${params.toString()}`);
    state.systems = body.systems || [];
    renderSystems(state.systems);
  } catch (e) {
    console.error(e);
  }
}

function issueTags(row) {
  const tags = [];
  if (row.open_mcl) tags.push(`<span class="tag red">${row.open_mcl} MCL</span>`);
  if (row.open_tt) tags.push(`<span class="tag amber">${row.open_tt} TT</span>`);
  if (row.lcr_exceedances) tags.push(`<span class="tag red">Lead/Cu</span>`);
  const openOthers = (row.open_violations || 0) - (row.open_mcl || 0) - (row.open_tt || 0);
  if (openOthers > 0) tags.push(`<span class="tag muted">+${openOthers} open</span>`);
  if (!tags.length) tags.push('<span class="tag green">clean</span>');
  return tags.join('');
}

function renderSystems(rows) {
  const tbody = $('#systemsBody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty"><div class="empty-icon">🔎</div>
      <p>No systems match these filters.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r) => `
    <tr data-pwsid="${r.pwsid}">
      <td class="mono">${r.pwsid}</td>
      <td><strong>${escapeHtml(r.name)}</strong>
          <div class="dim" style="font-size:11px">${escapeHtml(r.pws_type || '')}</div></td>
      <td>${escapeHtml(sourceLabel(r.primary_source))}</td>
      <td style="text-align:right">${fmtNum(r.population_served)}</td>
      <td>${issueTags(r)}</td>
      <td>${escapeHtml(r.city || '')}</td>
    </tr>`,
    )
    .join('');
  tbody.querySelectorAll('tr').forEach((tr) => {
    tr.addEventListener('click', () => openSystemDetail(tr.dataset.pwsid));
  });
}

function sourceLabel(code) {
  if (!code) return '';
  const s = code.toUpperCase();
  if (s === 'GW') return 'Ground water';
  if (s === 'SW') return 'Surface water';
  if (s === 'GU') return 'GW under SW influence';
  return code;
}

async function openSystemDetail(pwsid) {
  try {
    const body = await api(`/api/systems/${encodeURIComponent(pwsid)}`);
    const sys = body.system;
    const v = body.violations || [];
    const lcr = body.lcr_results || [];
    const areas = body.service_areas || [];

    const openV = v.filter((x) => ['O','K','U'].includes((x.compliance_status || '').toUpperCase()));
    const html = `
      <div class="detail">
        <div>
          <h2>${escapeHtml(sys.name)}</h2>
          <div class="dim mono">${sys.pwsid}</div>
        </div>
        <div class="detail-grid">
          <div><div class="k">Population served</div><div class="v">${fmtNum(sys.population_served)}</div></div>
          <div><div class="k">Connections</div><div class="v">${fmtNum(sys.service_connections)}</div></div>
          <div><div class="k">Type</div><div class="v">${escapeHtml(sys.pws_type || '')}</div></div>
          <div><div class="k">Source</div><div class="v">${escapeHtml(sourceLabel(sys.primary_source))}</div></div>
          <div><div class="k">Owner</div><div class="v">${escapeHtml(sys.owner_type || '')}</div></div>
          <div><div class="k">Primacy agency</div><div class="v">${escapeHtml(sys.primacy_agency || '')}</div></div>
          <div><div class="k">Admin contact</div><div class="v">${escapeHtml(sys.admin_name || '—')}</div></div>
          <div><div class="k">Phone</div><div class="v">${escapeHtml(sys.admin_phone || '—')}</div></div>
        </div>
        <div>
          <h3>EPA record</h3>
          <a href="${body.envirofacts_url}" target="_blank">${body.envirofacts_url}</a>
        </div>
        <div>
          <h3>Open violations (${openV.length} of ${v.length})</h3>
          ${renderViolations(openV.length ? openV : v)}
        </div>
        <div>
          <h3>Lead & Copper samples (${lcr.length})</h3>
          ${renderLcr(lcr)}
        </div>
        <div>
          <h3>Service areas (${areas.length})</h3>
          ${renderAreas(areas)}
        </div>
      </div>
    `;

    const win = window.open('', '_blank', 'width=800,height=900,scrollbars=yes');
    if (win) {
      win.document.write(`<!doctype html><html><head><title>${sys.pwsid} — ${escapeHtml(sys.name)}</title>`);
      win.document.write('<link rel="stylesheet" href="/static/styles.css"></head><body>');
      win.document.write(html);
      win.document.write('</body></html>');
      win.document.close();
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

function renderViolations(list) {
  if (!list.length) return '<div class="dim">None on record.</div>';
  return '<ul class="mini-list">' + list.slice(0, 25).map((v) => `
    <li>
      <span>
        <strong>${escapeHtml(v.category || '—')}</strong>
        ${v.is_health_based ? '<span class="tag red">health</span>' : ''}
        <span class="dim">code ${escapeHtml(v.code || '')}</span>
        <div class="dim mono">contam ${escapeHtml(v.contaminant_code || '—')} · rule ${escapeHtml(v.rule_code || '—')}</div>
      </span>
      <span class="dim nowrap">${escapeHtml(v.begin_date || '')}<br><span class="tag ${
        ['O','K','U'].includes((v.compliance_status || '').toUpperCase()) ? 'amber' : 'muted'
      }">${escapeHtml(v.compliance_status || '')}</span></span>
    </li>`).join('') + '</ul>';
}

function renderLcr(list) {
  if (!list.length) return '<div class="dim">No LCR samples on record.</div>';
  return '<ul class="mini-list">' + list.slice(0, 25).map((r) => `
    <li>
      <span>
        <strong>${escapeHtml(r.contaminant_code || '—')}</strong>
        ${r.exceeds_action ? '<span class="tag red">exceeds action level</span>' : ''}
      </span>
      <span class="dim nowrap">${escapeHtml(String(r.sample_measure ?? ''))} ${escapeHtml(r.unit_of_measure || '')}<br>${escapeHtml(r.sampling_end_date || '')}</span>
    </li>`).join('') + '</ul>';
}

function renderAreas(list) {
  if (!list.length) return '<div class="dim">No service areas on record.</div>';
  const uniq = {};
  list.forEach((a) => {
    const key = `${a.zip_code || ''}|${a.city || ''}`;
    uniq[key] = a;
  });
  return '<ul class="mini-list">' + Object.values(uniq).slice(0, 50).map((a) => `
    <li>
      <span><strong>${escapeHtml(a.zip_code || '—')}</strong> ${escapeHtml(a.city || '')}</span>
      <span class="dim">${escapeHtml(a.area_type || '')}</span>
    </li>`).join('') + '</ul>';
}

// ---------------- zips tab ----------------

async function refreshZips() {
  const params = new URLSearchParams();
  if ($('#zipFlaggedOnly').checked) params.set('flagged_only', 'true');
  const sort = $('#zipSort').value;
  if (sort) params.set('sort', sort);
  const search = $('#zipSearch').value.trim();
  if (search) params.set('search', search);

  try {
    const body = await api(`/api/zips?${params.toString()}`);
    state.zips = body.zips || [];
    renderStats(body.stats);
    renderZips(state.zips);
  } catch (e) {
    console.error(e);
  }
}

function flagTags(flags, row) {
  if (!flags) return '';
  const parts = [];
  if (flags.pfas_mcl)   parts.push('<span class="tag red">PFAS &gt; MCL</span>');
  else if (flags.pfas)  parts.push('<span class="tag amber">PFAS</span>');
  if (flags.lcr_lead)   parts.push('<span class="tag red">Lead</span>');
  if (flags.lcr_copper) parts.push('<span class="tag red">Copper</span>');
  if (flags.mcl)        parts.push('<span class="tag red">MCL</span>');
  if (flags.mrdl)       parts.push('<span class="tag amber">MRDL</span>');
  if (flags.tt)         parts.push('<span class="tag amber">TT</span>');
  const tier = row && row.lead_risk_tier;
  if (tier === 'high')      parts.push('<span class="tag red">Lead risk: high</span>');
  else if (tier === 'medium') parts.push('<span class="tag amber">Lead risk: med</span>');
  return parts.join('');
}

function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '';
  return '$' + Number(n).toLocaleString();
}

function renderZips(rows) {
  const tbody = $('#zipsBody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty"><div class="empty-icon">🎯</div>
      <p>No ZIPs match. Try unchecking "flagged only" or running a sync first.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r) => `
    <tr data-zip="${r.zip_code}">
      <td class="mono"><strong>${r.zip_code}</strong></td>
      <td>${escapeHtml(r.city || '')}</td>
      <td style="text-align:right"><strong>${(r.risk_score || 0).toFixed(1)}</strong></td>
      <td style="text-align:right">${(r.opportunity_score || 0).toFixed(1)}</td>
      <td style="text-align:right">${fmtMoney(r.median_household_income)}</td>
      <td style="text-align:right">${fmtNum(r.population_impacted)}</td>
      <td>${escapeHtml(r.top_issue || '')}</td>
      <td>${flagTags(r.flags, r)}</td>
      <td><span class="tag ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td>
    </tr>`,
    )
    .join('');
  tbody.querySelectorAll('tr').forEach((tr) => {
    tr.addEventListener('click', () => {
      state.selectedZip = tr.dataset.zip;
      setView('pipeline');
    });
  });
}

function statusClass(status) {
  return ({
    'new':           'blue',
    'researching':   'amber',
    'campaign_live': 'blue',
    'converted':     'green',
    'skip':          'muted',
  })[status] || 'muted';
}

// ---------------- pipeline tab ----------------

async function refreshPipeline() {
  const params = new URLSearchParams();
  const s = $('#pipeStatus').value;
  if (s) params.set('status', s);
  const search = $('#pipeSearch').value.trim();
  if (search) params.set('search', search);
  params.set('sort', 'score_desc');

  try {
    const body = await api(`/api/zips?${params.toString()}`);
    state.pipelineZips = body.zips || [];
    renderStats(body.stats);
    renderPipelineList(state.pipelineZips);
    if (state.selectedZip) {
      const found = state.pipelineZips.find((z) => z.zip_code === state.selectedZip);
      if (found) openPipelineDetail(found.zip_code);
      else state.selectedZip = null;
    }
  } catch (e) {
    console.error(e);
  }
}

function renderPipelineList(rows) {
  const list = $('#pipelineList');
  if (!rows.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">📋</div>
      <p>No ZIPs in pipeline. Try changing the filter, or run a sync.</p></div>`;
    return;
  }
  list.innerHTML = rows
    .map(
      (r) => `
    <div class="lead-item ${r.zip_code === state.selectedZip ? 'active' : ''}" data-zip="${r.zip_code}">
      <div class="lead-item-title">
        ${r.zip_code}
        <span class="tag ${statusClass(r.status)}">${r.status}</span>
      </div>
      <div class="lead-item-sub">
        ${escapeHtml(r.city || '')} &middot; risk ${(r.risk_score || 0).toFixed(1)} &middot;
        ${fmtNum(r.population_impacted)} residents${r.median_household_income ? ' · ' + fmtMoney(r.median_household_income) : ''}
      </div>
      <div>${flagTags(r.flags, r)}</div>
    </div>`,
    )
    .join('');
  list.querySelectorAll('.lead-item').forEach((el) => {
    el.addEventListener('click', () => openPipelineDetail(el.dataset.zip));
  });
}

async function openPipelineDetail(zip) {
  state.selectedZip = zip;
  $$('#pipelineList .lead-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.zip === zip);
  });
  try {
    const body = await api(`/api/zips/${encodeURIComponent(zip)}`);
    renderPipelineDetail(body);
  } catch (e) {
    $('#detailPane').innerHTML = `<div class="detail"><p>Error: ${escapeHtml(e.message)}</p></div>`;
  }
}

function renderPipelineDetail(z) {
  const tpl = z.templates || {};
  const systems = z.systems || [];
  const contam = z.flagged_contaminants || [];
  const pfas = z.pfas_results || [];
  const lsl = z.lsl_inventory || [];
  const demo = z.demographics || {};
  const inputs = (tpl.inputs || {});

  const systemCards = systems
    .map(
      (s) => `
      <li>
        <span>
          <strong>${escapeHtml(s.name)}</strong>
          <div class="dim mono" style="font-size:11px">${s.pwsid} · pop ${fmtNum(s.population_served)}</div>
        </span>
        <span>
          ${s.open_violations ? `<span class="tag amber">${s.open_violations} open</span>` : ''}
          ${s.lcr_exceedances ? `<span class="tag red">Pb/Cu</span>` : ''}
        </span>
      </li>`,
    )
    .join('');

  const contamList = contam
    .map(
      (c) => `<li><span>${escapeHtml(c.contaminant_code || '')} ${escapeHtml(c.category || '')}</span>
        <span class="dim">${escapeHtml(c.begin_date || '')}</span></li>`,
    )
    .join('');

  const templates = [
    ['Door hanger',         'door_hanger'],
    ['Postcard',            'postcard'],
    ['Facebook ad headline', 'facebook_ad_headline'],
    ['Facebook ad body',    'facebook_ad_body'],
    ['Nextdoor post',       'nextdoor_post'],
    ['Email subject',       'email_subject'],
    ['Email body',          'email'],
  ];

  const subareas = (tpl.subareas || []).filter((s) => s.recommended !== false || (tpl.subareas || []).length === 1);
  const hasSubareas = subareas.length > 0;
  const severityBadge = (sev) => {
    const cls = sev === 'high' ? 'red' : sev === 'medium' ? 'amber' : 'green';
    return `<span class="tag ${cls}">${escapeHtml(sev || 'low')}</span>`;
  };
  const subareaCopyBlock = (sub, idx) => `
    <div class="subarea-copy${idx === 0 ? ' subarea-copy--active' : ''}" data-subarea-idx="${idx}">
      <div class="subarea-meta">
        <div>
          <strong>${escapeHtml(sub.label)}</strong>
          <div class="dim" style="font-size:12px">
            ${fmtNum(sub.population)} residents · PWSIDs: ${sub.pwsids.map(escapeHtml).join(', ')}
          </div>
        </div>
        <div>${severityBadge(sub.severity)}</div>
      </div>
      ${(sub.evidence && sub.evidence.headline_number) ? `
        <div class="subarea-evidence">
          <strong>${escapeHtml(sub.evidence.headline_number)}</strong>
          ${sub.evidence.mcl_reference ? ` · <span class="dim">${escapeHtml(sub.evidence.mcl_reference)}</span>` : ''}
          ${sub.evidence.multiplier ? ` · <span class="tag red">${escapeHtml(sub.evidence.multiplier)}</span>` : ''}
          ${sub.evidence.date ? ` · <span class="dim">${escapeHtml(sub.evidence.date)}</span>` : ''}
        </div>` : ''}
      <div><a href="${sub.epa_link}" target="_blank" class="dim" style="font-size:12px">${escapeHtml(sub.epa_link)}</a></div>
      ${templates.map(([label, key]) => `
        <div class="template-card">
          <h4>
            <span>${label}</span>
            <button class="btn btn-ghost btn-sm" data-copy="sub-${idx}-${key}">Copy</button>
          </h4>
          <pre id="tpl-sub-${idx}-${key}">${escapeHtml((sub.templates || {})[key] || '')}</pre>
        </div>`).join('')}
    </div>`;

  $('#detailPane').innerHTML = `
    <div class="detail">
      <div>
        <h2>ZIP ${z.zip_code}</h2>
        <div class="dim">${escapeHtml(z.city || '')} \u00b7 ${escapeHtml(z.county || '')}, ${escapeHtml(z.state || '')}</div>
      </div>
      <div class="detail-grid">
        <div><div class="k">Risk score</div><div class="v">${(z.risk_score || 0).toFixed(1)}</div></div>
        <div><div class="k">Opportunity score</div><div class="v">${(z.opportunity_score || 0).toFixed(1)}</div></div>
        <div><div class="k">Population impacted</div><div class="v">${fmtNum(z.population_impacted)}</div></div>
        <div><div class="k">Top issue</div><div class="v">${escapeHtml(z.top_issue || '—')}</div></div>
        <div><div class="k">Top contaminant</div><div class="v">${escapeHtml(z.top_contaminant || '—')}</div></div>
        <div><div class="k">Lead risk tier</div><div class="v">${leadTierBadge(z.lead_risk_tier)}</div></div>
        <div><div class="k">PFAS</div><div class="v">${z.pfas_detected ? '<span class="tag red">detected</span>' : '<span class="dim">none on record</span>'}</div></div>
        <div><div class="k">Median HH income</div><div class="v">${demo.median_household_income ? fmtMoney(demo.median_household_income) : '<span class="dim">—</span>'}</div></div>
        <div><div class="k">Median home value</div><div class="v">${demo.median_home_value ? fmtMoney(demo.median_home_value) : '<span class="dim">—</span>'}</div></div>
        <div><div class="k">Owner-occupied</div><div class="v">${demo.owner_occupied_pct != null ? demo.owner_occupied_pct + '%' : '<span class="dim">—</span>'}</div></div>
        <div><div class="k">Pre-1980 housing</div><div class="v">${demo.pre_1980_housing_pct != null ? demo.pre_1980_housing_pct + '%' : '<span class="dim">—</span>'}</div></div>
      </div>

      <div>
        <h3>Status & notes</h3>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <select class="status-select" id="zipStatusSel">
            ${['new','researching','campaign_live','converted','skip'].map(
              (s) => `<option value="${s}" ${s === z.status ? 'selected' : ''}>${s}</option>`,
            ).join('')}
          </select>
          <button class="btn btn-sm" id="saveStatusBtn">Save</button>
        </div>
        <textarea class="notes" id="zipNotes" placeholder="Notes, campaign details, test orders…">${escapeHtml(z.notes || '')}</textarea>
        <div style="margin-top:6px"><button class="btn btn-sm" id="saveNotesBtn">Save notes</button>
          <span class="dim" id="saveStatus" style="margin-left:8px;font-size:12px"></span></div>
      </div>

      <div>
        <h3>Systems serving this ZIP (${systems.length})</h3>
        <ul class="mini-list">${systemCards || '<li class="dim">None</li>'}</ul>
      </div>

      ${contam.length ? `<div>
        <h3>Flagged contaminants on record</h3>
        <ul class="mini-list">${contamList}</ul>
      </div>` : ''}

      ${pfas.length ? `<div>
        <h3>PFAS detections (UCMR 5)</h3>
        <ul class="mini-list">${pfas.map((p) => `
          <li>
            <span>
              <strong>${escapeHtml(p.contaminant || '')}</strong>
              ${p.exceeds_mcl ? '<span class="tag red">&gt; 2024 MCL</span>' :
                p.exceeds_ha ? '<span class="tag amber">detected</span>' : ''}
            </span>
            <span class="dim nowrap">${escapeHtml(String(p.sample_measure ?? ''))} ${escapeHtml(p.unit_of_measure || '')}<br>${escapeHtml(p.collection_date || '')}</span>
          </li>`).join('')}</ul>
      </div>` : ''}

      ${lsl.length ? `<div>
        <h3>Lead Service Line inventory</h3>
        <ul class="mini-list">${lsl.map((l) => `
          <li>
            <span><strong>${escapeHtml(l.pwsid)}</strong>
              <div class="dim" style="font-size:11px">source: ${escapeHtml(l.data_source || 'manual')}${l.reported_date ? ' · ' + escapeHtml(l.reported_date) : ''}</div>
            </span>
            <span class="dim">Lead ${fmtNum(l.lead_lines)} · Unknown ${fmtNum(l.unknown_lines)} / ${fmtNum(l.total_lines)}</span>
          </li>`).join('')}</ul>
      </div>` : ''}

      <div>
        <h3>EPA source</h3>
        <a href="${inputs.epa_link || '#'}" target="_blank">${escapeHtml(inputs.epa_link || '')}</a>
      </div>

      <div>
        <h3>Outreach templates</h3>
        <p class="dim" style="font-size:12px;margin:0 0 8px">Each quotes the public EPA record so homeowners can verify. Copy-to-clipboard only — no automated sending.</p>
        ${hasSubareas && subareas.length > 1 ? `
          <div class="dim" style="font-size:12px;margin-bottom:8px">
            This ZIP is served by utilities with materially different risk profiles. Pick the sub-area you're actually targeting:
          </div>
          <div class="subarea-tabs" role="tablist">
            ${subareas.map((s, i) => `
              <button class="subarea-tab${i === 0 ? ' active' : ''}" data-subarea-tab="${i}" type="button">
                ${severityBadge(s.severity)} ${escapeHtml(s.label)}
              </button>`).join('')}
          </div>
          ${subareas.map((s, i) => subareaCopyBlock(s, i)).join('')}
        ` : hasSubareas ? subareaCopyBlock(subareas[0], 0) : templates.map(([label, key]) => `
          <div class="template-card">
            <h4>
              <span>${label}</span>
              <button class="btn btn-ghost btn-sm" data-copy="${key}">Copy</button>
            </h4>
            <pre id="tpl-${key}">${escapeHtml(tpl[key] || '')}</pre>
          </div>`).join('')}
      </div>
    </div>
  `;

  $('#saveStatusBtn').addEventListener('click', async () => {
    const newStatus = $('#zipStatusSel').value;
    await saveZipUpdate(z.zip_code, { status: newStatus }, 'Status saved.');
  });
  $('#saveNotesBtn').addEventListener('click', async () => {
    const notes = $('#zipNotes').value;
    await saveZipUpdate(z.zip_code, { notes }, 'Notes saved.');
  });
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.copy;
      const pre = document.getElementById('tpl-' + key);
      if (!pre) return;
      try {
        await navigator.clipboard.writeText(pre.textContent);
        btn.textContent = 'Copied!';
        setTimeout(() => (btn.textContent = 'Copy'), 1200);
      } catch (_) {
        btn.textContent = 'Copy failed';
      }
    });
  });
  $$('[data-subarea-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.subareaTab;
      $$('[data-subarea-tab]').forEach((b) => b.classList.toggle('active', b.dataset.subareaTab === idx));
      $$('[data-subarea-idx]').forEach((pane) => pane.classList.toggle('subarea-copy--active', pane.dataset.subareaIdx === idx));
    });
  });
}

async function saveZipUpdate(zip, patch, okMsg) {
  try {
    await api(`/api/zips/${encodeURIComponent(zip)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    $('#saveStatus').textContent = okMsg;
    setTimeout(() => ($('#saveStatus').textContent = ''), 1800);
    refreshPipeline();
  } catch (e) {
    $('#saveStatus').textContent = 'Error: ' + e.message;
  }
}

// ---------------- map tab ----------------

function leadTierBadge(tier) {
  if (!tier || tier === 'unknown') return '<span class="dim">unknown</span>';
  const cls = tier === 'high' ? 'red' : tier === 'medium' ? 'amber' : 'green';
  return `<span class="tag ${cls}">${tier}</span>`;
}

function riskColor(score) {
  if (score >= 30) return '#c0202b';
  if (score >= 15) return '#e07d10';
  if (score >= 5)  return '#d7c04a';
  if (score > 0)   return '#4fa5d8';
  return '#8aa0ad';
}

function radiusFor(pop) {
  if (!pop) return 6;
  return Math.min(40, 6 + Math.log10(Math.max(pop, 10)) * 5);
}

async function refreshMap() {
  if (!window.L) {
    $('#map').innerHTML = '<div class="empty"><p>Leaflet failed to load.</p></div>';
    return;
  }
  if (!state.map) {
    state.map = L.map('map').setView([26.7153, -80.0534], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(state.map);
    state.mapLayer = L.layerGroup().addTo(state.map);
  }

  $('#mapStatus').textContent = 'Loading…';
  try {
    const params = new URLSearchParams();
    params.set('flagged_only', $('#mapFlaggedOnly').checked ? 'true' : 'false');
    const body = await api(`/api/map?${params.toString()}`);
    renderMapFeatures(body.features || []);
    const msg = `${body.features.length} mapped of ${body.total_zips}` +
                (body.pending_lookups ? ` · ${body.pending_lookups} ZIPs still resolving` : '');
    $('#mapStatus').textContent = msg;
  } catch (e) {
    $('#mapStatus').textContent = 'Error: ' + e.message;
  }
}

function renderMapFeatures(features) {
  state.mapLayer.clearLayers();
  if (!features.length) return;
  const bounds = [];
  features.forEach((f) => {
    const color = riskColor(f.risk_score || 0);
    const marker = L.circleMarker([f.lat, f.lon], {
      radius: radiusFor(f.population),
      color: f.pfas_detected ? '#c0202b' : color,
      weight: f.pfas_detected ? 3 : 1,
      fillColor: color,
      fillOpacity: 0.55,
    });
    const flagsLine = [
      f.pfas_detected ? 'PFAS' : null,
      f.lead_risk_tier === 'high' ? 'Lead risk: high' : null,
      f.flags?.mcl ? 'MCL' : null,
      f.flags?.lcr_lead ? 'Lead exceedance' : null,
    ].filter(Boolean).join(' · ');
    marker.bindPopup(`
      <div style="min-width:200px">
        <div style="font-weight:700;font-size:15px">${f.zip_code}</div>
        <div style="color:#556">${escapeHtml(f.city || '')}</div>
        <div style="margin-top:6px">Risk <strong>${(f.risk_score||0).toFixed(1)}</strong>
             · Opp <strong>${(f.opportunity_score||0).toFixed(1)}</strong></div>
        <div>Population ${fmtNum(f.population)}</div>
        ${f.median_household_income ? `<div>Median HHI ${fmtMoney(f.median_household_income)}</div>` : ''}
        <div style="margin-top:4px">${escapeHtml(f.top_issue || '')}</div>
        ${flagsLine ? `<div style="margin-top:4px;font-size:12px;color:#b22">${flagsLine}</div>` : ''}
        <button onclick="window.__openZip('${f.zip_code}')" style="margin-top:8px">Open in pipeline</button>
      </div>
    `);
    marker.addTo(state.mapLayer);
    bounds.push([f.lat, f.lon]);
  });
  if (bounds.length) state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
}

window.__openZip = (zip) => {
  state.selectedZip = zip;
  setView('pipeline');
};

// ---------------- alerts panel ----------------

async function loadAlerts() {
  const panel = $('#alertPanel');
  const body = $('#alertPanelBody');
  body.innerHTML = '<div class="dim">Loading…</div>';
  panel.style.display = 'block';
  try {
    const r = await api('/api/alerts?limit=50');
    const alerts = r.alerts || [];
    if (!alerts.length) {
      body.innerHTML = '<div class="dim">No alerts. New MCL / Lead & Copper / PFAS detections will show up here after each sync.</div>';
      return;
    }
    body.innerHTML = alerts.map((a) => `
      <div class="alert-item ${a.seen ? '' : 'unread'}" data-zip="${a.zip_code || ''}">
        <div class="alert-row">
          <span class="tag ${a.severity === 'high' ? 'red' : a.severity === 'medium' ? 'amber' : 'muted'}">${escapeHtml(a.alert_type)}</span>
          <strong>${escapeHtml(a.title || '')}</strong>
        </div>
        <div class="dim" style="font-size:11px">${escapeHtml(a.pwsid || '')} ${a.zip_code ? ' · ZIP ' + a.zip_code : ''} · ${shortDate(a.created_at)}</div>
      </div>`).join('');
    body.querySelectorAll('.alert-item').forEach((el) => {
      el.addEventListener('click', () => {
        const zip = el.dataset.zip;
        if (zip) { state.selectedZip = zip; setView('pipeline'); $('#alertPanel').style.display = 'none'; }
      });
    });
  } catch (e) {
    body.innerHTML = `<div class="dim">Error: ${escapeHtml(e.message)}</div>`;
  }
}

async function markAlertsRead() {
  await api('/api/alerts/mark-read', { method: 'POST', body: JSON.stringify({}) });
  loadConfig();
  loadAlerts();
}

// ---------------- utils ----------------

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------- wire up ----------------

document.addEventListener('DOMContentLoaded', () => {
  setTheme(localStorage.getItem('aqua-theme') || 'light');

  $$('.tab').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));

  $('#themeToggle').addEventListener('click', () => {
    const curr = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(curr);
  });

  $('#syncBtn').addEventListener('click', runSync);

  $('#sysRefresh').addEventListener('click', refreshSystems);
  $('#sysSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') refreshSystems(); });
  $('#sysFlaggedOnly').addEventListener('change', refreshSystems);
  $('#sysIssueType').addEventListener('change', refreshSystems);

  $('#zipRefresh').addEventListener('click', refreshZips);
  $('#zipSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') refreshZips(); });
  $('#zipFlaggedOnly').addEventListener('change', refreshZips);
  $('#zipSort').addEventListener('change', refreshZips);

  $('#pipeSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') refreshPipeline(); });
  $('#pipeStatus').addEventListener('change', refreshPipeline);

  $('#exportBtn').addEventListener('click', () => { window.location.href = '/api/export.csv'; });

  $('#ucmrFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const status = $('#ucmrStatus');
    status.textContent = 'Uploading UCMR 5…';
    const fd = new FormData();
    fd.append('file', f);
    try {
      const res = await fetch('/api/ucmr/import', { method: 'POST', body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || 'upload failed');
      status.textContent = `Imported ${body.imported} rows for ${body.pwsids} PWSIDs.`;
      await loadConfig();
      if (state.view === 'zips') refreshZips();
      if (state.view === 'pipeline') refreshPipeline();
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
    }
    e.target.value = '';
  });

  $('#mapFlaggedOnly').addEventListener('change', refreshMap);
  $('#mapResolveBtn').addEventListener('click', refreshMap);

  $('#alertBtn').addEventListener('click', () => {
    const panel = $('#alertPanel');
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    loadAlerts();
  });
  $('#alertCloseBtn').addEventListener('click', () => { $('#alertPanel').style.display = 'none'; });
  $('#alertMarkAllBtn').addEventListener('click', markAlertsRead);

  // Poll config periodically so the alert badge reflects scheduled syncs.
  state.alertTimer = setInterval(loadConfig, 60_000);

  loadConfig().then(() => refreshSystems());
});
