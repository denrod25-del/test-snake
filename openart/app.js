// =============================================================
// OpenArt-style AI Creator Studio (UI clone)
// All "AI generation" is mocked locally so the demo runs offline.
// To wire to a real backend, replace `runMockGeneration` with
// fetch() calls to your API and return { url, type } when done.
// =============================================================

/* ---------- Tool catalog ---------- */
const TOOLS = [
  // Video
  { id: 'frame-to-video',   cat: 'video',     name: 'Frame to Video',   desc: 'Animate a still frame into a cinematic clip.', tag: 'Popular',
    fields: ['image', 'prompt', 'duration', 'aspect'] },
  { id: 'text-to-video',    cat: 'video',     name: 'Text to Video',    desc: 'Generate a short video from a text prompt.',     tag: 'New',
    fields: ['prompt', 'duration', 'aspect', 'style'] },
  { id: 'edit-video',       cat: 'video',     name: 'Edit Video',       desc: 'Edit a clip with natural-language instructions.',
    fields: ['video', 'prompt'] },
  { id: 'motion-sync',      cat: 'video',     name: 'Motion Sync',      desc: 'Transfer motion from a reference video.',         tag: 'Pro',
    fields: ['image', 'video', 'prompt'] },
  { id: 'lip-sync',         cat: 'video',     name: 'Lip-Sync',         desc: 'Sync lip movement to an audio track.',
    fields: ['video', 'audio'] },
  { id: 'upscale-video',    cat: 'video',     name: 'Upscale Video',    desc: 'Enhance video to up to 4K resolution.',
    fields: ['video', 'scale'] },
  { id: 'replace-character',cat: 'video',     name: 'Replace Character',desc: 'Swap a character in your video for a new one.',
    fields: ['video', 'image', 'prompt'] },
  { id: 'extend-video',     cat: 'video',     name: 'Extend Video',     desc: 'Extend a clip with seamless new footage.',
    fields: ['video', 'duration', 'prompt'] },
  { id: 'add-sound-effect', cat: 'video',     name: 'Add Sound Effect', desc: 'Generate matching SFX for any video.',
    fields: ['video', 'prompt'] },
  { id: 'restyle-video',    cat: 'video',     name: 'Restyle Video',    desc: 'Change the visual style of an existing video.',
    fields: ['video', 'style', 'prompt'] },

  // Image
  { id: 'text-to-image',    cat: 'image',     name: 'Text to Image',    desc: 'Generate beautiful images from text.',           tag: 'Popular',
    fields: ['prompt', 'aspect', 'style'] },
  { id: 'edit-image',       cat: 'image',     name: 'Edit Image',       desc: 'Edit an image using a natural-language prompt.',
    fields: ['image', 'prompt'] },
  { id: 'remove-bg',        cat: 'image',     name: 'Remove Background',desc: 'Cut out the subject in one click.',
    fields: ['image'] },
  { id: 'upscale-image',    cat: 'image',     name: 'Upscale Image',    desc: 'Enhance image quality and resolution.',
    fields: ['image', 'scale'] },
  { id: 'restyle-image',    cat: 'image',     name: 'Restyle Image',    desc: 'Apply a brand-new visual style.',
    fields: ['image', 'style'] },
  { id: 'inpaint',          cat: 'image',     name: 'Inpaint',          desc: 'Erase or replace parts of an image.',
    fields: ['image', 'prompt'] },

  // Character
  { id: 'character-create', cat: 'character', name: 'Create Character', desc: 'Design a consistent character from scratch.',    tag: 'Studio',
    fields: ['prompt', 'style'] },
  { id: 'character-pose',   cat: 'character', name: 'Repose Character', desc: 'Repose your character in any scene.',
    fields: ['image', 'prompt'] },
  { id: 'character-train',  cat: 'character', name: 'Train Character',  desc: 'Train a custom character from your photos.',
    fields: ['image', 'prompt'] },

  // World
  { id: 'world-build',      cat: 'world',     name: 'Build World',      desc: 'Design a coherent world / scene library.',
    fields: ['prompt', 'style'] },
  { id: 'world-360',        cat: 'world',     name: '360° Scene',       desc: 'Generate immersive 360° environments.',
    fields: ['prompt'] },

  // Audio
  { id: 'tts',              cat: 'audio',     name: 'Text to Speech',   desc: 'Lifelike voiceovers in many languages.',
    fields: ['prompt', 'voice'] },
  { id: 'music-gen',        cat: 'audio',     name: 'Music Generator',  desc: 'Compose original music from a prompt.',
    fields: ['prompt', 'duration'] },
  { id: 'sfx-gen',          cat: 'audio',     name: 'Sound Effects',    desc: 'Generate any sound effect on demand.',
    fields: ['prompt'] },
];

const FIELD_DEFS = {
  prompt:   { label: 'Prompt',           type: 'textarea', placeholder: 'Describe what you want to create…', required: true },
  image:    { label: 'Reference image',  type: 'file', accept: 'image/*' },
  video:    { label: 'Source video',     type: 'file', accept: 'video/*' },
  audio:    { label: 'Audio track',      type: 'file', accept: 'audio/*' },
  duration: { label: 'Duration (sec)',   type: 'number', min: 1, max: 60, value: 5 },
  aspect:   { label: 'Aspect ratio',     type: 'select', options: ['16:9', '9:16', '1:1', '4:3', '21:9'] },
  style:    { label: 'Style',            type: 'select', options: ['Cinematic', 'Anime', 'Photorealistic', 'Watercolor', '3D', 'Pixel Art', 'Cyberpunk'] },
  scale:    { label: 'Scale factor',     type: 'select', options: ['2x', '4x'] },
  voice:    { label: 'Voice',            type: 'select', options: ['Aria (en)', 'Leo (en)', 'Mei (zh)', 'Hugo (es)', 'Nova (ja)'] },
};

/* ---------- DOM helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Storage ---------- */
const STORAGE_KEY = 'openart_creations_v1';
const loadCreations = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
};
const saveCreations = (c) => localStorage.setItem(STORAGE_KEY, JSON.stringify(c));

/* ---------- Render tools grid ---------- */
const grid = $('#toolsGrid');
let activeCat = 'video';
let searchQuery = '';

function thumbStyle(seed) {
  // Deterministic gradient per tool id
  const hash = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const palettes = [
    ['#6366f1', '#06b6d4'],
    ['#ec4899', '#8b5cf6'],
    ['#f59e0b', '#ef4444'],
    ['#10b981', '#3b82f6'],
    ['#a78bfa', '#22d3ee'],
    ['#f472b6', '#fb7185'],
    ['#0ea5e9', '#22c55e'],
    ['#facc15', '#f97316'],
  ];
  const [a, b] = palettes[hash % palettes.length];
  const angle = (hash * 17) % 360;
  return `background: linear-gradient(${angle}deg, ${a}, ${b});`;
}

function renderTools() {
  const filtered = TOOLS.filter(t => t.cat === activeCat &&
    (!searchQuery || (t.name + ' ' + t.desc).toLowerCase().includes(searchQuery)));
  grid.innerHTML = filtered.map(t => `
    <article class="tool-card" data-tool="${t.id}">
      <div class="tool-thumb" style="${thumbStyle(t.id)}"></div>
      <div class="tool-meta">
        <div class="tool-name">${t.name}</div>
        <div class="tool-desc">${t.desc}</div>
        ${t.tag ? `<span class="tool-tag">${t.tag}</span>` : ''}
      </div>
    </article>
  `).join('') || `<div class="empty-state"><div class="empty-art">🔍</div><h3>No tools found</h3><p>Try a different search.</p></div>`;
  $$('.tool-card', grid).forEach(card => card.addEventListener('click', () => openTool(card.dataset.tool)));
}

/* ---------- Category tabs + sidebar nav ---------- */
$$('.cat-tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.cat-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeCat = tab.dataset.cat;
  syncSidebar();
  renderTools();
}));

$$('.nav-item[data-route]').forEach(item => item.addEventListener('click', (e) => {
  e.preventDefault();
  const r = item.dataset.route;
  if (['video', 'image', 'character', 'world', 'audio'].includes(r)) {
    activeCat = r;
    $$('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === r));
    syncSidebar();
    renderTools();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (r === 'home') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    toast(`"${item.textContent.trim()}" coming soon`);
  }
  if (window.innerWidth <= 980) $('#sidebar').classList.remove('open');
}));

function syncSidebar() {
  $$('.nav-item[data-route]').forEach(i => i.classList.toggle('active', i.dataset.route === activeCat));
}

/* ---------- Pinned tools ---------- */
$$('.pinned-tool').forEach(b => b.addEventListener('click', () => {
  const map = { 'motion-sync': 'motion-sync', 'lip-sync': 'lip-sync', 'edit-image': 'edit-image', 'edit-video': 'edit-video' };
  openTool(map[b.dataset.tool]);
}));

/* ---------- Search ---------- */
$('#searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  renderTools();
});

/* ---------- Mobile menu ---------- */
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

/* ---------- Modal ---------- */
const modal = $('#modal');
let currentTool = null;
let currentFiles = {}; // { fieldName: File }

function openTool(toolId) {
  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) return;
  currentTool = tool;
  currentFiles = {};
  $('#modalTitle').textContent = tool.name;
  $('#modalSub').textContent = tool.desc;
  $('#costEst').textContent = `${3 + tool.fields.length * 2} credits`;
  $('#previewPane').innerHTML = `<div class="preview-placeholder">Output will appear here</div>`;
  $('#generateBtn').disabled = false;
  $('#generateBtn').textContent = 'Generate';
  renderForm(tool);
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  currentTool = null;
}
$('#closeModal').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

function renderForm(tool) {
  const form = $('#toolForm');
  const groups = [];
  let row = [];
  tool.fields.forEach(name => {
    const def = FIELD_DEFS[name];
    if (!def) return;
    const isCompact = ['duration', 'aspect', 'scale', 'voice', 'style'].includes(name);
    if (isCompact) row.push({ name, def });
    else { if (row.length) { groups.push({ row }); row = []; } groups.push({ name, def }); }
  });
  if (row.length) groups.push({ row });

  form.innerHTML = groups.map(g => {
    if (g.row) {
      return `<div class="${g.row.length > 1 ? 'row2' : ''}">${g.row.map(({ name, def }) => fieldHtml(name, def)).join('')}</div>`;
    }
    return fieldHtml(g.name, g.def);
  }).join('');

  // wire file inputs
  $$('.upload', form).forEach(up => {
    const input = $('input', up);
    const fieldName = up.dataset.field;
    up.addEventListener('click', () => input.click());
    up.addEventListener('dragover', (e) => { e.preventDefault(); up.classList.add('drag'); });
    up.addEventListener('dragleave', () => up.classList.remove('drag'));
    up.addEventListener('drop', (e) => {
      e.preventDefault(); up.classList.remove('drag');
      if (e.dataTransfer.files[0]) handleFile(fieldName, e.dataTransfer.files[0], up);
    });
    input.addEventListener('change', (e) => {
      if (e.target.files[0]) handleFile(fieldName, e.target.files[0], up);
    });
  });
}

function fieldHtml(name, def) {
  const id = `f_${name}`;
  if (def.type === 'textarea') {
    return `<div class="field">
      <label for="${id}">${def.label}${def.required ? ' *' : ''}</label>
      <textarea id="${id}" name="${name}" placeholder="${def.placeholder || ''}"></textarea>
    </div>`;
  }
  if (def.type === 'select') {
    return `<div class="field">
      <label for="${id}">${def.label}</label>
      <select id="${id}" name="${name}">${def.options.map(o => `<option>${o}</option>`).join('')}</select>
    </div>`;
  }
  if (def.type === 'number') {
    return `<div class="field">
      <label for="${id}">${def.label}</label>
      <input id="${id}" name="${name}" type="number" min="${def.min ?? 0}" max="${def.max ?? 100}" value="${def.value ?? 1}" />
    </div>`;
  }
  if (def.type === 'file') {
    const icon = def.accept?.startsWith('image') ? '🖼️' : def.accept?.startsWith('video') ? '🎬' : '🎵';
    return `<div class="field">
      <label>${def.label}</label>
      <div class="upload" data-field="${name}">
        <input type="file" accept="${def.accept}" />
        <div class="upload-icon">${icon}</div>
        <div class="upload-text">Click to upload or drag &amp; drop</div>
        <div class="upload-hint">${def.accept.replace('/*', '').toUpperCase()} • up to 100MB</div>
      </div>
    </div>`;
  }
  return '';
}

function handleFile(fieldName, file, container) {
  currentFiles[fieldName] = file;
  const url = URL.createObjectURL(file);
  // Remove previous preview if any
  const existing = $('.upload-preview', container);
  if (existing) existing.remove();
  const txt = $('.upload-text', container);
  txt.textContent = file.name;

  let el;
  if (file.type.startsWith('image/')) el = `<img class="upload-preview" src="${url}" alt="" />`;
  else if (file.type.startsWith('video/')) el = `<video class="upload-preview" src="${url}" muted></video>`;
  else if (file.type.startsWith('audio/')) el = `<audio class="upload-preview" controls src="${url}"></audio>`;
  else el = '';
  if (el) container.insertAdjacentHTML('beforeend', el);
}

/* ---------- Reset ---------- */
$('#resetBtn').addEventListener('click', () => {
  if (currentTool) {
    currentFiles = {};
    renderForm(currentTool);
    $('#previewPane').innerHTML = `<div class="preview-placeholder">Output will appear here</div>`;
  }
});

/* ---------- Generate (mocked) ---------- */
$('#generateBtn').addEventListener('click', async () => {
  if (!currentTool) return;
  const form = $('#toolForm');
  const data = Object.fromEntries(new FormData(form));
  Object.assign(data, currentFiles);

  // Validate required prompt for tools that have one
  const def = FIELD_DEFS.prompt;
  if (currentTool.fields.includes('prompt') && def.required && !String(data.prompt || '').trim()) {
    toast('Please enter a prompt.');
    return;
  }

  $('#generateBtn').disabled = true;
  $('#generateBtn').textContent = 'Generating…';

  const preview = $('#previewPane');
  preview.innerHTML = `
    <div class="progress">
      <div class="progress-bar"><div class="progress-fill" id="pFill"></div></div>
      <div class="progress-label" id="pLabel">Initializing model…</div>
    </div>
  `;
  const fill = $('#pFill');
  const label = $('#pLabel');

  const stages = ['Initializing model…', 'Encoding inputs…', 'Sampling…', 'Decoding…', 'Polishing output…'];
  for (let i = 0; i < stages.length; i++) {
    label.textContent = stages[i];
    fill.style.width = `${((i + 1) / stages.length) * 100}%`;
    await sleep(500 + Math.random() * 500);
  }

  const result = await runMockGeneration(currentTool, data);
  showResult(result);

  // Save to creations
  const creations = loadCreations();
  creations.unshift({
    id: 'c_' + Date.now(),
    tool: currentTool.id,
    toolName: currentTool.name,
    type: result.type,
    url: result.url,
    name: (data.prompt && String(data.prompt).slice(0, 40)) || currentTool.name,
    createdAt: Date.now(),
  });
  saveCreations(creations);
  renderCreations();

  $('#generateBtn').disabled = false;
  $('#generateBtn').textContent = 'Generate again';
  toast(`${currentTool.name} ready ✓`);
});

function showResult({ url, type }) {
  const preview = $('#previewPane');
  if (type === 'image') preview.innerHTML = `<img src="${url}" alt="generated" />`;
  else if (type === 'video') preview.innerHTML = `<video src="${url}" controls autoplay loop muted></video>`;
  else if (type === 'audio') preview.innerHTML = `<audio src="${url}" controls autoplay></audio>`;
}

/* ---------- Mock Generation ----------
   Replace this with a real fetch() to your backend. Returns
   { url, type } where type is 'image' | 'video' | 'audio'.
*/
async function runMockGeneration(tool, data) {
  // If user uploaded a file matching the output type, just echo it back
  // (lets users see "their" content as the result for demo realism).
  if (tool.cat === 'video' && data.video instanceof File)
    return { url: URL.createObjectURL(data.video), type: 'video' };
  if (tool.cat === 'image' && data.image instanceof File && tool.id !== 'restyle-image')
    return { url: URL.createObjectURL(data.image), type: 'image' };
  if (tool.cat === 'audio' && data.audio instanceof File)
    return { url: URL.createObjectURL(data.audio), type: 'audio' };

  // Otherwise synthesize a placeholder result
  if (tool.cat === 'audio') {
    return { url: makeBeepDataUrl(parseFloat(data.duration) || 3), type: 'audio' };
  }
  if (tool.cat === 'video') {
    // No real video synthesis client-side — show an animated SVG as a poster image
    return { url: makePosterImage(tool.name + ' • ' + (data.prompt || 'video')), type: 'image' };
  }
  // image-like
  return { url: makePosterImage(tool.name + ' • ' + (data.prompt || 'image')), type: 'image' };
}

function makePosterImage(text) {
  const w = 768, h = 480;
  const hash = [...text].reduce((a, c) => a + c.charCodeAt(0), 0);
  const palettes = [['#6366f1', '#06b6d4', '#a78bfa'], ['#ec4899', '#8b5cf6', '#22d3ee'],
                    ['#f59e0b', '#ef4444', '#f472b6'], ['#10b981', '#3b82f6', '#a78bfa']];
  const p = palettes[hash % palettes.length];
  const blobs = Array.from({ length: 6 }, (_, i) => {
    const cx = 80 + ((hash * (i + 3)) % (w - 160));
    const cy = 80 + ((hash * (i + 7)) % (h - 160));
    const r = 120 + ((hash * (i + 11)) % 120);
    const c = p[i % p.length];
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="0.55"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><filter id="b"><feGaussianBlur stdDeviation="40"/></filter></defs>
    <rect width="100%" height="100%" fill="#0b0b10"/>
    <g filter="url(#b)">${blobs}</g>
    <text x="32" y="${h - 32}" font-family="Inter, sans-serif" font-size="20" font-weight="700" fill="#fff" opacity="0.9">${escapeXml(text).slice(0, 60)}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function escapeXml(s) { return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])); }

function makeBeepDataUrl(seconds) {
  // Generate a simple WAV beep
  const sr = 22050;
  const len = Math.max(1, Math.floor(seconds)) * sr;
  const buf = new ArrayBuffer(44 + len * 2);
  const view = new DataView(buf);
  const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeStr(36, 'data'); view.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.min(1, t * 4) * Math.min(1, (seconds - t) * 4);
    const v = Math.sin(2 * Math.PI * (220 + 80 * Math.sin(t * 2)) * t) * env * 0.4;
    view.setInt16(44 + i * 2, v * 32767, true);
  }
  const blob = new Blob([buf], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- Creations ---------- */
const creationsGrid = $('#creationsGrid');
const emptyState = $('#emptyState');
let creationsFilter = 'all';

function renderCreations() {
  const all = loadCreations();
  const filtered = all.filter(c => creationsFilter === 'all' ||
    (creationsFilter === 'image' && c.type === 'image') ||
    (creationsFilter === 'video' && c.type === 'video') ||
    (creationsFilter === 'audio' && c.type === 'audio'));
  if (filtered.length === 0) {
    creationsGrid.innerHTML = '';
    creationsGrid.appendChild(emptyState);
    return;
  }
  creationsGrid.innerHTML = filtered.map(c => `
    <article class="creation-card" data-id="${c.id}">
      <div class="creation-thumb">
        ${c.type === 'image' ? `<img src="${c.url}" alt="" />` :
          c.type === 'video' ? `<video src="${c.url}" muted loop playsinline></video>` :
          `<div style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(135deg,#ec4899,#8b5cf6);font-size:32px;">🎵</div>`}
      </div>
      <div class="creation-meta">
        <div class="creation-name" title="${escapeAttr(c.name)}">${escapeHtml(c.name)}</div>
        <span class="creation-type ${c.type}">${c.type}</span>
      </div>
      <button class="creation-del" data-del="${c.id}" title="Delete">✕</button>
    </article>
  `).join('');
  $$('.creation-card', creationsGrid).forEach(card => {
    const c = loadCreations().find(x => x.id === card.dataset.id);
    if (!c) return;
    if (c.type === 'video') {
      const v = $('video', card);
      card.addEventListener('mouseenter', () => v?.play().catch(() => {}));
      card.addEventListener('mouseleave', () => { if (v) { v.pause(); v.currentTime = 0; } });
    }
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) return;
      // Open in modal preview
      currentTool = { name: c.toolName, desc: 'Saved creation', fields: [], cat: c.type };
      $('#modalTitle').textContent = c.toolName;
      $('#modalSub').textContent = 'Saved creation';
      $('#toolForm').innerHTML = `<div class="field"><label>Name</label><input type="text" value="${escapeAttr(c.name)}" disabled/></div><div class="field"><label>Created</label><input type="text" value="${new Date(c.createdAt).toLocaleString()}" disabled/></div>`;
      showResult({ url: c.url, type: c.type });
      $('#generateBtn').textContent = 'Download';
      $('#generateBtn').disabled = false;
      $('#generateBtn').onclick = () => downloadUrl(c.url, c.name);
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
    });
  });
  $$('[data-del]', creationsGrid).forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = b.dataset.del;
    saveCreations(loadCreations().filter(c => c.id !== id));
    renderCreations();
  }));
}

function downloadUrl(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name || 'creation';
  document.body.appendChild(a); a.click(); a.remove();
}

const escapeHtml = (s) => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const escapeAttr = (s) => String(s).replace(/"/g, '&quot;');

$$('.chip').forEach(chip => chip.addEventListener('click', () => {
  $$('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  creationsFilter = chip.dataset.filter;
  renderCreations();
}));

$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  if (tab.dataset.tab === 'collections') toast('Collections coming soon');
}));

$('#clearAll').addEventListener('click', () => {
  if (loadCreations().length && confirm('Delete all creations?')) {
    saveCreations([]);
    renderCreations();
  }
});

$('#emptyCta').addEventListener('click', () => toast('Sign-up flow coming soon'));

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------- Init ---------- */
renderTools();
renderCreations();
