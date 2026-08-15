// Local dev server for the water-quality page.
//
// `python -m http.server` cannot serve /api/water/*, so the page's lookup and
// profile panels are untestable against it. This serves the repo root as static
// files and routes /api/water/* through the real Netlify function handler, so
// what you see locally is what the deployed site does.
//
//   node water-quality/devserver.mjs            -> http://localhost:8765
//   node water-quality/devserver.mjs --port 9000
//   node water-quality/devserver.mjs --fixtures  -> serve a synthetic dataset
//
// --fixtures builds the test dataset into a temp directory and points the
// function at it, so the full page can be exercised before any real ingest has
// run. The data it shows is invented (fictional FL999xxxx utilities) and is for
// development only.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 8765;
const useFixtures = args.includes('--fixtures');

if (useFixtures) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fwq-dev-'));
  console.log(`Building synthetic dataset into ${tmp} ...`);
  execFileSync('python3', ['-c', `
import sys; sys.path.insert(0, ${JSON.stringify(path.join(REPO_ROOT, 'water-quality'))})
from datetime import datetime, timezone
from pathlib import Path
from fwq import build, utilities
from tests import fixtures
config = utilities.UtilityConfig.from_dict({
    "slug": "example", "name": "Example Shoreline Utility Authority",
    "priority_analytes": {"ids": [
        "pfoa", "pfos", "pfhxs", "pfbs", "lead", "copper", "tthm"]},
})
config.pwsid = fixtures.SYNTHETIC_PWSID_A
result = build.ingest_state(
    fixtures.FakeClient(), focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
    retrieved_at=datetime.now(timezone.utc),
    codemap_path=Path(${JSON.stringify(tmp)}) / "codes.json")
build.write_dataset(result, {"example": config}, out_dir=${JSON.stringify(tmp)})
`], { cwd: path.join(REPO_ROOT, 'water-quality'), stdio: 'inherit' });
  process.env.FWQ_DATA_DIR = tmp;
}

const { handler } = require(path.join(REPO_ROOT, 'netlify', 'functions', 'water-api.js'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname.startsWith('/api/water')) {
    const result = await handler({
      httpMethod: req.method,
      path: url.pathname,
      rawQuery: url.searchParams.toString(),
      queryStringParameters: Object.fromEntries(url.searchParams),
      headers: { 'x-nf-client-connection-ip': req.socket.remoteAddress || 'dev' },
    });
    res.writeHead(result.statusCode, result.headers || {});
    res.end(result.body || '');
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  // Mirror netlify.toml's extensionless pretty paths.
  if (!path.extname(pathname)) pathname += '.html';

  const filePath = path.join(REPO_ROOT, pathname);
  if (!filePath.startsWith(REPO_ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`Not found: ${pathname}`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`\n  Water quality dev server\n`);
  console.log(`    Page:  http://localhost:${port}/water-quality.html`);
  console.log(`    API:   http://localhost:${port}/api/water/health`);
  if (useFixtures) {
    console.log(`\n    Serving SYNTHETIC data (fictional FL999xxxx utilities).`);
    console.log(`    Try ZIP 33410 — two candidates, one with a PFOA exceedance.`);
  } else {
    console.log(`\n    Serving the committed dataset. Lookup returns 503 until an`);
    console.log(`    ingest has run; the contaminant reference works either way.`);
  }
  console.log('');
});
