// Shared JSON load for SPI: filesystem (tests / included_files) then site fetch.
const fs = require('fs');
const path = require('path');
const { getCanonicalSiteUrl } = require('./config');

// Netlify esbuild + included_files usually land under process.cwd() (/var/task)
// with the same relative paths as the repo. Also try common __dirname offsets.
const REPO_ROOT_CANDIDATES = [
  process.cwd(),
  path.resolve(__dirname, '../../..'),
  path.resolve(__dirname, '../../../..'),
  path.resolve(__dirname, '..'),
  path.resolve(__dirname, '../..'),
  '/var/task',
];

function resolveLocal(relPath) {
  const clean = String(relPath || '').replace(/^\/+/, '');
  for (const root of REPO_ROOT_CANDIDATES) {
    const full = path.join(root, clean);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

async function loadJson(relPath, opts = {}) {
  if (opts.loader) return opts.loader(relPath);
  const local = resolveLocal(relPath);
  if (local) {
    return JSON.parse(fs.readFileSync(local, 'utf8'));
  }
  const base = (opts.siteUrl || getCanonicalSiteUrl()).replace(/\/+$/, '');
  const url = `${base}/${String(relPath).replace(/^\/+/, '')}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${relPath}: HTTP ${res.status}`);
  return res.json();
}

module.exports = { loadJson, resolveLocal };
