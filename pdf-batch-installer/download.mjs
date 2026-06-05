#!/usr/bin/env node
/**
 * pdf-batch-installer
 *
 * Batch-downloads ("installs") every PDF from an Apache-style directory
 * listing such as the Gentoomen Library mirror at theswissbay.ch.
 *
 * Zero dependencies — runs on Node 18+ using built-in fetch + web streams.
 *
 * Examples:
 *   node download.mjs                       # downloads the default Game Dev/Programming folder
 *   node download.mjs --recursive           # descend into subfolders too
 *   node download.mjs --out ~/pdfs          # choose an output directory
 *   node download.mjs --list                # preview the file list, download nothing
 *   node download.mjs --filter "unreal|opengl" --concurrency 6
 *   node download.mjs "https://example.com/some/dir/"   # any other listing URL
 */
import { createWriteStream } from "node:fs";
import { mkdir, stat, rename, rm } from "node:fs/promises";
import { dirname, join, basename, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { homedir } from "node:os";

const DEFAULT_URL =
  "https://theswissbay.ch/pdf/Gentoomen%20Library/Game%20Development/Programming/";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------- args ----

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    out: "downloads",
    concurrency: 4,
    recursive: false,
    list: false,
    force: false,
    filter: null,
    retries: 3,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "-o":
      case "--out":
        opts.out = next();
        break;
      case "-c":
      case "--concurrency":
        opts.concurrency = Math.max(1, Number(next()) || 1);
        break;
      case "-r":
      case "--recursive":
        opts.recursive = true;
        break;
      case "-l":
      case "--list":
      case "--dry-run":
        opts.list = true;
        break;
      case "-f":
      case "--filter":
        opts.filter = new RegExp(next(), "i");
        break;
      case "--force":
        opts.force = true;
        break;
      case "--retries":
        opts.retries = Math.max(0, Number(next()) || 0);
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      default:
        if (a.startsWith("-")) {
          console.error(`Unknown option: ${a}`);
          process.exit(2);
        }
        rest.push(a);
    }
  }
  if (rest[0]) opts.url = rest[0];
  if (opts.out.startsWith("~")) opts.out = join(homedir(), opts.out.slice(1));
  return opts;
}

const HELP = `pdf-batch-installer — batch download PDFs from a directory listing

Usage:
  node download.mjs [url] [options]

Arguments:
  url                  Directory listing URL to scan
                       (default: Gentoomen Library / Game Development / Programming)

Options:
  -o, --out <dir>      Output directory                       (default: ./downloads)
  -c, --concurrency N  Parallel downloads                     (default: 4)
  -r, --recursive      Descend into subfolders
  -f, --filter <re>    Only download files whose path matches the regex (case-insensitive)
  -l, --list           List matching PDFs and exit (no download)
      --force          Re-download even if a complete copy already exists
      --retries N      Retry attempts per file                (default: 3)
  -h, --help           Show this help

Examples:
  node download.mjs --list
  node download.mjs --recursive --out ~/Books/gamedev
  node download.mjs --filter "unreal|opengl|directx" -c 6
`;

// --------------------------------------------------------------- http ----

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, init, retries) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, Accept: "*/*", ...(init?.headers || {}) },
        redirect: "follow",
      });
      if (!res.ok && res.status >= 500) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(500 * 2 ** attempt);
    }
  }
  throw lastErr;
}

// -------------------------------------------------------------- crawl ----

function extractHrefs(html) {
  const out = [];
  const re = /href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function skipHref(href) {
  if (!href) return true;
  if (href === "../" || href === "/" || href === "./") return true;
  if (href.startsWith("#") || href.startsWith("?")) return true;
  if (href.startsWith("mailto:")) return true;
  // Apache column-sort links like ?C=N;O=A
  if (href.includes("?C=")) return true;
  return false;
}

function relPath(rootUrl, fileUrl) {
  const prefix = new URL(rootUrl).pathname;
  const p = new URL(fileUrl).pathname;
  const sliced = p.startsWith(prefix) ? p.slice(prefix.length) : p;
  return decodeURIComponent(sliced).replace(/^\/+/, "");
}

/**
 * Guard against directory traversal. A crafted listing can encode separators
 * or dot-segments (e.g. `%2e%2e%2f` → `../`) that survive `new URL()` but are
 * decoded by relPath(); without this check `join(out, path)` could write
 * outside the install directory. Reject absolute paths, Windows drives, and
 * any `..` segment.
 */
function isSafeRelPath(p) {
  if (!p) return false;
  const norm = p.replace(/\\/g, "/");
  if (norm.startsWith("/")) return false;
  if (/^[a-zA-Z]:/.test(norm)) return false;
  return norm.split("/").every((seg) => seg !== "..");
}

/**
 * Walk the listing, collecting every .pdf. When recursive, descend into
 * subdirectories (breadth-first, deduped). Returns sorted pdf entries.
 */
async function crawl(rootUrl, { recursive, retries }) {
  const root = rootUrl.endsWith("/") ? rootUrl : `${rootUrl}/`;
  const queue = [root];
  const seen = new Set([root]);
  const pdfs = [];

  while (queue.length) {
    const dirUrl = queue.shift();
    let html;
    try {
      const res = await fetchWithRetry(dirUrl, {}, retries);
      if (!res.ok) {
        console.error(`  ! skipping ${dirUrl} (HTTP ${res.status})`);
        continue;
      }
      html = await res.text();
    } catch (err) {
      console.error(`  ! failed to read ${dirUrl}: ${err.message}`);
      continue;
    }

    for (const href of extractHrefs(html)) {
      if (skipHref(href)) continue;
      const abs = new URL(href, dirUrl).href;
      // stay within the root subtree
      if (!abs.startsWith(new URL(root).origin)) continue;

      if (href.endsWith("/")) {
        if (!recursive) continue;
        const u = abs.endsWith("/") ? abs : `${abs}/`;
        if (u.startsWith(root) && !seen.has(u)) {
          seen.add(u);
          queue.push(u);
        }
      } else if (/\.pdf$/i.test(href)) {
        const path = relPath(root, abs);
        if (!isSafeRelPath(path)) {
          console.error(`  ! skipping unsafe path (would escape --out): ${path}`);
          continue;
        }
        pdfs.push({ url: abs, path, name: basename(path) });
      }
    }
  }

  // dedupe by url, sort by path for stable output
  const byUrl = new Map(pdfs.map((p) => [p.url, p]));
  return [...byUrl.values()].sort((a, b) => a.path.localeCompare(b.path));
}

// ----------------------------------------------------------- download ----

function humanSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "?";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

async function fileSize(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return -1;
  }
}

/**
 * Download a single PDF. Skips when a complete copy already exists (size
 * matches the server's Content-Length). Streams to a .part file, then
 * atomically renames on success.
 */
async function downloadOne(pdf, opts) {
  const dest = join(opts.out, pdf.path);
  // Defense in depth: never write outside the chosen output directory, even
  // if a path slipped past isSafeRelPath().
  const outRoot = resolve(opts.out);
  const resolved = resolve(dest);
  if (resolved !== outRoot && !resolved.startsWith(outRoot + sep)) {
    throw new Error(`refusing to write outside output dir: ${pdf.path}`);
  }
  await mkdir(dirname(dest), { recursive: true });

  const res = await fetchWithRetry(pdf.url, {}, opts.retries);
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const remote = Number(res.headers.get("content-length")) || 0;

  if (!opts.force && remote > 0) {
    const local = await fileSize(dest);
    if (local === remote) {
      res.body.cancel?.();
      return { skipped: true, bytes: local };
    }
  }

  const tmp = `${dest}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  await rename(tmp, dest);
  return { skipped: false, bytes: (await fileSize(dest)) || remote };
}

/** Simple promise pool that keeps `limit` downloads in flight. */
async function runPool(items, limit, worker) {
  let idx = 0;
  const results = new Array(items.length);
  async function next() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next())
  );
  return results;
}

// --------------------------------------------------------------- main ----

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }

  console.log(`Scanning: ${decodeURIComponent(opts.url)}`);
  console.log(`Recursive: ${opts.recursive ? "yes" : "no"}`);

  let pdfs = await crawl(opts.url, opts);
  if (opts.filter) pdfs = pdfs.filter((p) => opts.filter.test(p.path));

  if (pdfs.length === 0) {
    console.log("No PDFs found matching the criteria.");
    return;
  }

  console.log(`\nFound ${pdfs.length} PDF(s):`);
  for (const p of pdfs) console.log(`  • ${p.path}`);

  if (opts.list) {
    console.log(`\n(--list) Not downloading. Drop --list to install.`);
    return;
  }

  console.log(
    `\nInstalling to "${opts.out}" with concurrency ${opts.concurrency}...\n`
  );

  let done = 0;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;
  const failures = [];

  await runPool(pdfs, opts.concurrency, async (pdf) => {
    const label = pdf.path;
    try {
      const r = await downloadOne(pdf, opts);
      done++;
      if (r.skipped) {
        skipped++;
        console.log(`[${done}/${pdfs.length}] ✓ exists  ${label}`);
      } else {
        downloaded++;
        totalBytes += r.bytes || 0;
        console.log(
          `[${done}/${pdfs.length}] ↓ done   ${label} (${humanSize(r.bytes)})`
        );
      }
    } catch (err) {
      done++;
      failed++;
      failures.push({ path: label, error: err.message });
      console.error(`[${done}/${pdfs.length}] ✗ FAIL   ${label} — ${err.message}`);
    }
  });

  console.log(
    `\nDone. ${downloaded} downloaded, ${skipped} already present, ${failed} failed.`
  );
  if (downloaded) console.log(`Transferred ~${humanSize(totalBytes)}.`);
  if (failures.length) {
    console.log(`\nFailed files (re-run to retry):`);
    for (const f of failures) console.log(`  - ${f.path}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\nFatal: ${err.stack || err.message}`);
  process.exit(1);
});
