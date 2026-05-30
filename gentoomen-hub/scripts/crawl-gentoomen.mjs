/**
 * Recursively indexes Apache-style directory listings for the Gentoomen Library
 * mirror at theswissbay.ch. Writes a JSON catalog for the hub app.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_ROOT =
  "https://theswissbay.ch/pdf/Gentoomen%20Library/";
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY ?? 8);
const MAX_DIRS = process.env.CRAWL_MAX_DIRS
  ? Number(process.env.CRAWL_MAX_DIRS)
  : Infinity;

const OUT = join(__dirname, "..", "public", "data", "library-index.json");

const UA =
  "Mozilla/5.0 (compatible; GentoomenHubIndexer/1.0; +local research)";

function extractHrefs(html) {
  const out = [];
  const re = /href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function shouldSkipHref(href) {
  if (!href || href === "../" || href === "/") return true;
  if (href.includes("?")) return true;
  if (href.startsWith("#")) return true;
  if (href.startsWith("mailto:")) return true;
  return false;
}

function relPathFromRoot(root, fileUrl) {
  const prefix = new URL(root).pathname;
  const p = new URL(fileUrl).pathname;
  if (!p.startsWith(prefix)) return p;
  return decodeURIComponent(p.slice(prefix.length));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function main() {
  const root = process.argv[2] || DEFAULT_ROOT;
  const rootNorm = root.endsWith("/") ? root : `${root}/`;

  const queue = [rootNorm];
  const queued = new Set([rootNorm]);
  const pdfs = [];
  let dirsVisited = 0;

  async function processDir(dirUrl) {
    const html = await fetchHtml(dirUrl);
    const hrefs = extractHrefs(html);
    for (const href of hrefs) {
      if (shouldSkipHref(href)) continue;
      const absoluteRaw = new URL(href, dirUrl).href;
      const trailing = href.endsWith("/");
      const lower = href.toLowerCase();

      if (trailing || href === "/") {
        const u = absoluteRaw.endsWith("/") ? absoluteRaw : `${absoluteRaw}/`;
        if (!queued.has(u)) {
          queued.add(u);
          queue.push(u);
        }
      } else if (lower.endsWith(".pdf")) {
        const path = relPathFromRoot(rootNorm, absoluteRaw);
        const title = decodeURIComponent(
          path.split("/").filter(Boolean).pop() ?? path
        ).replace(/\.pdf$/i, "");
        pdfs.push({
          title,
          path,
          url: absoluteRaw,
          topCategory:
            decodeURIComponent(path.split("/").filter(Boolean)[0] ?? "Misc"),
        });
      }
    }
    dirsVisited += 1;
  }

  while (queue.length && dirsVisited < MAX_DIRS) {
    const batch = [];
    while (
      batch.length < CONCURRENCY &&
      queue.length &&
      dirsVisited + batch.length < MAX_DIRS
    ) {
      const next = queue.shift();
      if (next) batch.push(next);
    }
    if (!batch.length) break;
    await Promise.all(batch.map((u) => processDir(u)));
  }

  const byCategory = {};
  for (const p of pdfs) {
    const c = p.topCategory;
    byCategory[c] = (byCategory[c] ?? 0) + 1;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: rootNorm,
    attribution:
      "Index derived from directory listings at theswissbay.ch (Gentoomen Library mirror). PDFs remain hosted by the mirror; verify licensing before redistributing.",
    stats: {
      directoriesVisited: dirsVisited,
      pdfCount: pdfs.length,
      categories: Object.keys(byCategory).length,
      truncatedByMaxDirs:
        Number.isFinite(MAX_DIRS) && queue.length > 0
          ? MAX_DIRS
          : undefined,
    },
    categoryCounts: byCategory,
    pdfs,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload));
  console.log(
    `Wrote ${payload.stats.pdfCount} PDFs (${payload.stats.directoriesVisited} dirs) → ${OUT}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
