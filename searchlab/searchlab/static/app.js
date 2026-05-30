// SearchLab UI: vanilla JS, no build step.
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---- toast ----------------------------------------------------------
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 3500);
}

// ---- API helper -----------------------------------------------------
async function api(path, opts = {}) {
  const init = { headers: { 'Content-Type': 'application/json' }, ...opts };
  if (init.body && typeof init.body !== 'string') init.body = JSON.stringify(init.body);
  const r = await fetch(path, init);
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
  if (!r.ok) {
    const err = new Error(data.detail || r.statusText);
    err.data = data;
    throw err;
  }
  return data;
}

function safeParseJSON(s, fallback = null) {
  if (!s || !s.trim()) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

// ---- tabs -----------------------------------------------------------
$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  $$('#tabs .tab').forEach(b => b.classList.toggle('active', b === btn));
  const id = btn.dataset.tab;
  $$('main .panel').forEach(p => p.classList.toggle('active', p.id === `tab-${id}`));
  if (id === 'experiments') refreshExperiments();
});

// ---- corpora & algorithms (shared dropdowns) ------------------------
async function refreshCorpora() {
  const { corpora } = await api('/api/corpora');
  const list = $('#corpora-list');
  list.innerHTML = '';
  if (!corpora.length) {
    list.innerHTML = '<div class="muted">No corpora yet. Load a sample, generate one, crawl, or upload.</div>';
  } else {
    for (const c of corpora) {
      const row = document.createElement('div');
      row.className = 'list-item';
      row.innerHTML = `
        <div>
          <strong>${c.name}</strong>
          <div class="meta">id ${c.id} &middot; ${c.docs} docs &middot; ${c.links} links &middot; ${c.created_at}</div>
          <div class="meta">${c.description || ''}</div>
        </div>
        <div class="actions">
          <button class="primary" data-action="docs" data-id="${c.id}">View docs</button>
          <button class="primary" data-action="del" data-id="${c.id}" style="background:#ef4444">Delete</button>
        </div>`;
      list.appendChild(row);
    }
  }
  list.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = +btn.dataset.id;
    if (btn.dataset.action === 'del') {
      if (!confirm('Delete corpus #' + id + '?')) return;
      await api('/api/corpora/' + id, { method: 'DELETE' });
      toast('Deleted');
      refreshAll();
    } else if (btn.dataset.action === 'docs') {
      const { documents } = await api('/api/corpora/' + id + '/documents?limit=20');
      alert(documents.map(d => `#${d.id}  ${d.title || ''}\n  ${d.url || ''}\n  ${d.snippet || ''}`).join('\n\n'));
    }
  };

  for (const sel of ['#s-corpus', '#c-corpus', '#e-corpus']) {
    const el = $(sel);
    const cur = el.value;
    el.innerHTML = corpora.map(c => `<option value="${c.id}">${c.name} (${c.docs} docs)</option>`).join('');
    if (cur) el.value = cur;
  }
}

async function refreshAlgos() {
  const { algorithms, load_errors } = await api('/api/algorithms');
  const list = $('#algos-list');
  list.innerHTML = algorithms.map(a => `
    <div class="list-item">
      <div>
        <strong>${a.name}</strong>
        <span class="tag">${a.class}</span>
        <div class="meta">${a.description || ''}</div>
        <div class="meta">params: <code>${JSON.stringify(a.params)}</code></div>
      </div>
    </div>`).join('') || '<div class="muted">No algorithms.</div>';

  const errs = $('#algos-errors');
  if (load_errors && load_errors.length) {
    errs.innerHTML = '<h3>Plugin load errors</h3>' + load_errors.map(e =>
      `<pre style="white-space:pre-wrap;color:var(--err)">${e.file || e.class}: ${e.error}</pre>`
    ).join('');
  } else {
    errs.innerHTML = '';
  }

  const opts = algorithms.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
  $('#s-algo').innerHTML = opts;
  $('#c-algos').innerHTML = opts;
  $('#e-algo-a').innerHTML = opts;
  $('#e-algo-b').innerHTML = opts;
}

async function refreshAll() {
  try {
    await Promise.all([refreshCorpora(), refreshAlgos()]);
  } catch (e) {
    toast('Failed to load: ' + e.message, true);
  }
}

// ---- DATA tab handlers ---------------------------------------------
$('#load-sample').onclick = async () => {
  try {
    const r = await api('/api/data/sample/ir-classics', { method: 'POST' });
    toast(`Loaded ir-classics: ${r.n_docs} docs, ${r.n_links} links`);
    refreshAll();
  } catch (e) { toast(e.message, true); }
};

$('#gen-syn').onclick = async () => {
  const body = {
    name: $('#syn-name').value,
    n_docs: +$('#syn-docs').value,
    graph_kind: $('#syn-graph').value,
    seed: +$('#syn-seed').value,
  };
  try {
    const r = await api('/api/data/synthetic', { method: 'POST', body });
    toast(`Generated ${r.n_docs} docs, ${r.n_links} links`);
    refreshAll();
  } catch (e) { toast(e.message, true); }
};

$('#run-crawl').onclick = async () => {
  const seeds = $('#cr-seeds').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!seeds.length) return toast('Provide at least one seed URL', true);
  const body = {
    name: $('#cr-name').value || 'crawl-1',
    seeds,
    max_pages: +$('#cr-max').value,
    max_depth: +$('#cr-depth').value,
    same_domain_only: $('#cr-same').checked,
    delay_ms: 200,
  };
  try {
    toast('Crawling... this may take a moment');
    const r = await api('/api/data/crawl', { method: 'POST', body });
    toast(`Crawled ${r.n_docs} pages, ${r.n_links} internal links`);
    refreshAll();
  } catch (e) { toast(e.message, true); }
};

$('#run-upload').onclick = async () => {
  const file = $('#up-file').files[0];
  if (!file) return toast('Pick a file first', true);
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', $('#up-name').value || 'uploaded');
  try {
    const r = await fetch('/api/data/upload', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'upload failed');
    toast(`Uploaded ${data.n_docs} docs, ${data.n_links} links`);
    refreshAll();
  } catch (e) { toast(e.message, true); }
};

// ---- SEARCH tab -----------------------------------------------------
function renderResult(r) {
  return `
    <div class="result">
      <div class="top">
        <div>
          <span class="rank">#${r.rank}</span>
          <span class="title">${r.title || `doc ${r.doc_id}`}</span>
        </div>
        <span class="score">score ${r.score.toFixed(4)}</span>
      </div>
      ${r.url ? `<div class="url">${r.url}</div>` : ''}
      <div class="snippet">${(r.snippet || '').replace(/</g, '&lt;')}</div>
      <details>
        <summary>Why this rank?</summary>
        <pre>${JSON.stringify(r.explanation, null, 2)}</pre>
      </details>
    </div>`;
}

$('#run-search').onclick = async () => {
  const body = {
    corpus_id: +$('#s-corpus').value,
    query: $('#s-q').value,
    algorithm: $('#s-algo').value,
    top_k: +$('#s-k').value,
    params: safeParseJSON($('#s-params').value, {}) || {},
  };
  if (!body.corpus_id || !body.query) return toast('Pick a corpus and enter a query', true);
  try {
    const data = await api('/api/search', { method: 'POST', body });
    const out = $('#search-results');
    out.innerHTML = `
      <div class="summary-box">
${data.algorithm} on corpus ${data.corpus_id}  query: "${data.query}"
matched ${data.n_total_matches} docs, showing top ${data.n_results}
params: ${JSON.stringify(data.params)}
      </div>` + data.results.map(renderResult).join('');
  } catch (e) { toast(e.message, true); }
};

// ---- COMPARE tab ----------------------------------------------------
$('#run-compare').onclick = async () => {
  const algos = Array.from($('#c-algos').selectedOptions).map(o => o.value);
  if (algos.length < 2) return toast('Select at least 2 algorithms', true);
  const body = {
    corpus_id: +$('#c-corpus').value,
    query: $('#c-q').value,
    algorithms: algos,
    top_k: +$('#c-k').value,
  };
  if (!body.query) return toast('Enter a query', true);
  try {
    const data = await api('/api/compare', { method: 'POST', body });
    const cols = algos.map(a => {
      const r = data.results[a];
      return `<div class="compare-col">
        <h3>${a}</h3>
        ${r.results.map(renderResult).join('') || '<div class="muted">no results</div>'}
      </div>`;
    }).join('');
    $('#compare-results').innerHTML = `<div class="compare-grid">${cols}</div>`;
  } catch (e) { toast(e.message, true); }
};

// ---- EXPERIMENTS tab -----------------------------------------------
async function refreshJudgedHint() {
  const cid = +$('#e-corpus').value;
  if (!cid) { $('#e-judged-hint').textContent = ''; return; }
  try {
    const { queries } = await api('/api/corpora/' + cid + '/judged-queries');
    if (queries.length) {
      $('#e-judged-hint').innerHTML = 'Judged queries available: ' +
        queries.map(q => `<a href="#" data-q="${q.replace(/"/g,'&quot;')}">${q}</a>`).join(' &middot; ');
      $('#e-judged-hint').onclick = (e) => {
        const a = e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        const ta = $('#e-queries');
        ta.value = (ta.value ? ta.value + '\n' : '') + a.dataset.q;
      };
    } else {
      $('#e-judged-hint').textContent = 'No judged queries for this corpus yet.';
    }
  } catch { /* ignore */ }
}

$('#e-corpus').addEventListener('change', refreshJudgedHint);

$('#run-experiment').onclick = async () => {
  const queries = $('#e-queries').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!queries.length) return toast('Enter at least one query', true);
  const body = {
    name: $('#e-name').value || 'exp',
    corpus_id: +$('#e-corpus').value,
    queries,
    algo_a: $('#e-algo-a').value,
    algo_b: $('#e-algo-b').value,
    params_a: safeParseJSON($('#e-params-a').value, {}) || {},
    params_b: safeParseJSON($('#e-params-b').value, {}) || {},
    top_k: +$('#e-k').value,
  };
  try {
    toast('Running experiment...');
    const data = await api('/api/experiments', { method: 'POST', body });
    renderExperiment(data, $('#experiment-output'));
    refreshExperiments();
  } catch (e) { toast(e.message, true); }
};

function renderExperiment(data, mount) {
  const s = data.summary || {};
  let winner = '';
  if (s.winner) {
    const cls = `winner-${s.winner}`;
    winner = `<span class="${cls}">winner: ${s.winner}</span>`;
  }
  let metricsTable = '';
  if (s.mean_metrics_a) {
    const keys = Object.keys(s.mean_metrics_a);
    metricsTable = `
<strong>Mean metrics over ${s.n_judged_queries} judged queries</strong>
metric  | A (${data.algo_a}) | B (${data.algo_b}) | delta
${keys.map(k => `${k.padEnd(8)} | ${String(s.mean_metrics_a[k]).padEnd(16)} | ${String(s.mean_metrics_b[k]).padEnd(16)} | ${s.delta[k]}`).join('\n')}
`;
  }
  mount.innerHTML = `
    <div class="card">
      <h2>${data.name} &middot; experiment #${data.experiment_id} ${winner}</h2>
      <div class="muted">${data.algo_a} vs ${data.algo_b} on corpus ${data.corpus_id}</div>
      <div class="summary-box">queries: ${s.n_queries}, judged: ${s.n_judged_queries}, mean Jaccard@k: ${s['mean_jaccard@k']}
${metricsTable}</div>
      <details><summary>Per-query details</summary>
        <pre style="background:var(--bg-3);padding:10px;border-radius:6px;overflow:auto;max-height:480px;font-size:11.5px">${JSON.stringify(data.per_query, null, 2)}</pre>
      </details>
    </div>`;
}

async function refreshExperiments() {
  try {
    const { experiments } = await api('/api/experiments');
    $('#experiments-list').innerHTML = experiments.map(e => `
      <div class="list-item">
        <div><strong>#${e.id} ${e.name}</strong>
          <div class="meta">${e.algo_a} vs ${e.algo_b} on corpus ${e.corpus_id} &middot; ${e.created_at}</div>
        </div>
        <div class="actions"><button class="primary" data-id="${e.id}">View</button></div>
      </div>`).join('') || '<div class="muted">No experiments yet.</div>';
    $('#experiments-list').onclick = async (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      const data = await api('/api/experiments/' + btn.dataset.id);
      renderExperiment({ ...data, ...data.payload, experiment_id: data.id }, $('#experiment-output'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  } catch (e) { /* ignore */ }
}

// ---- ALGORITHMS tab -------------------------------------------------
$('#reload-algos').onclick = async () => {
  try {
    await api('/api/algorithms/reload', { method: 'POST' });
    await refreshAlgos();
    toast('Plugins reloaded');
  } catch (e) { toast(e.message, true); }
};

// ---- boot -----------------------------------------------------------
refreshAll();
