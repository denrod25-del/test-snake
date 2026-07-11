#!/usr/bin/env node
/* Shared Firecrawl cloud (or self-host) helpers — zero npm deps. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE = 'https://api.firecrawl.dev';

// Load scripts/.env if present (does not override existing env vars)
(function loadDotEnv() {
  try {
    const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (!process.env[k]) process.env[k] = v.replace(/^["']|["']$/g, '');
    }
  } catch { /* ignore */ }
})();

export function getConfig() {
  const key = process.env.FIRECRAWL_API_KEY || '';
  const base = (process.env.FIRECRAWL_API_URL || DEFAULT_BASE).replace(/\/$/, '');
  return { key, base, isSelfHost: Boolean(process.env.FIRECRAWL_API_URL) };
}

export function requireKey() {
  const { key, base, isSelfHost } = getConfig();
  // Self-host often runs with USE_DB_AUTHENTICATION=false (no key)
  if (!key && !isSelfHost) {
    console.error(`
[ERROR] FIRECRAWL_API_KEY is not set.

  Cloud:  get a free key at https://www.firecrawl.dev/app/api-keys
          then:  $env:FIRECRAWL_API_KEY="fc-..."

  Self-host: clone is in ./firecrawl — see scripts/FIRECRAWL.md
             then:  $env:FIRECRAWL_API_URL="http://localhost:3002"
`);
    process.exit(1);
  }
  return { key, base };
}

export async function firecrawlScrape(url, options = {}) {
  const { key, base } = requireKey();
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;

  const body = { url, ...options };
  const res = await fetch(`${base}/v2/scrape`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Firecrawl non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || json.success === false) {
    const msg = json.error || json.message || text.slice(0, 200);
    throw new Error(`Firecrawl ${res.status}: ${msg}`);
  }
  return json.data || json;
}

export async function firecrawlSearch(query, options = {}) {
  const { key, base } = requireKey();
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(`${base}/v2/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, ...options })
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(`Firecrawl search ${res.status}: ${json.error || JSON.stringify(json).slice(0, 200)}`);
  }
  return json.data || json;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    }
  }
  return flags;
}

export function ensureHttps(site) {
  if (!site) return null;
  if (/^https?:\/\//i.test(site)) return site;
  return `https://${site}`;
}
