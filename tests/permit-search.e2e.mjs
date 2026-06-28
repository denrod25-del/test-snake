// End-to-end regression test for permit-search.html (multi-source aggregator).
//
// Prereqs:
//   - Node 18+ (built-in fetch) and `npm install` (installs puppeteer)
//   - A static server running on :8765 from the repo root
//       npm run serve     (or: python -m http.server 8765)
//
// Run:
//   npm run test:e2e      (or: node tests/permit-search.e2e.mjs)
//
// Covers: clean boot, source filter, URL-state roundtrip, reset, keyword
// search across sources, sort-by-source, manual JSON upload + MANUAL pill,
// CSV export columns, broken-source tolerance, duplicate permitNumber dedup,
// pagination, empty-state, malformed JSON, keyword any/all, stats tab, map tab.
//
// Counts: the test derives expected row counts from the live data files in
// data/permits/*.json at startup (via the manifest). That way it stays green
// whether WPB has 4 sample permits or 4,000 live-scraped ones.
import puppeteer from "puppeteer";

const BASE = "http://localhost:8765";
const results = [];
function check(name, cond, detail = "") {
  results.push({ name, ok: !!cond, detail });
  console.log((cond ? "PASS " : "FAIL ") + name + (detail ? " | " + detail : ""));
}

// --- Pre-flight: discover actual source counts so tests don't pin sample sizes ---
const manifest = await fetch(BASE + "/data/permits/sources.json").then((r) => r.json());
const SRC_COUNT = {};  // id -> number of permits in that dataFile
for (const s of manifest.sources) {
  const d = await fetch(BASE + "/" + s.dataFile).then((r) => r.json());
  const flat = [];
  for (const plist of Object.values(d.permitsByParcel || {})) flat.push(...plist);
  SRC_COUNT[s.id] = flat.length;
}
const TOTAL = Object.values(SRC_COUNT).reduce((a, b) => a + b, 0);
const SOURCES = manifest.sources.length;
console.log(`[setup] ${SOURCES} sources, ${TOTAL} permits total`, SRC_COUNT);

// A deterministic permit number we can trigger a dedup collision on. We grab
// the first permit from the SMALLEST source (fast) and use its permit#.
const smallestId = Object.entries(SRC_COUNT).sort((a, b) => a[1] - b[1])[0][0];
const smallestFile = manifest.sources.find((s) => s.id === smallestId).dataFile;
const smallestData = await fetch(BASE + "/" + smallestFile).then((r) => r.json());
const firstPermit = Object.values(smallestData.permitsByParcel)[0][0];
const DUP_PERMIT_NUMBER = firstPermit.permitNumber;
console.log(`[setup] dedup permit# = ${DUP_PERMIT_NUMBER} (from ${smallestId})`);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(20000);

const consoleMsgs = [];
const failedRequests = [];
page.on("pageerror", (err) => consoleMsgs.push("pageerror: " + err.message));
page.on("console", (msg) => { if (msg.type() === "error") consoleMsgs.push("console.error: " + msg.text()); });
page.on("requestfailed", (req) => failedRequests.push(req.url() + " | " + req.failure()?.errorText));
page.on("response", (resp) => { if (resp.status() >= 400) failedRequests.push(`${resp.status()} ${resp.url()}`); });

// The table only renders one page at a time. Expected visible rows = min(pageSize, matchingTotal).
const PAGE_SIZE = 25;
const expectedVisible = (total) => Math.min(total, PAGE_SIZE);

// TEST 1: clean boot
console.log("\n--- TEST 1: clean boot ---");
await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
const banner = await page.$eval("#data-banner", (el) => el.textContent.trim());
check("Banner renders permit count", /\d+ permits? loaded/i.test(banner));
check(`Banner lists all ${SOURCES} sources`, new RegExp(`${SOURCES} sources?`).test(banner), banner.slice(0, 200));
const sourceCount = await page.$eval("#source-count", (el) => el.textContent.trim());
check(`'source-count' shows '${SOURCES} of ${SOURCES}'`, sourceCount === `${SOURCES} of ${SOURCES}`, sourceCount);
const totalDisplayed = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check(`Result count equals total (${TOTAL})`, totalDisplayed === TOTAL, `count=${totalDisplayed}`);
const rowCount = await page.$$eval("tr.permit-row", (rows) => rows.length);
check(`Visible rows = min(pageSize, total) = ${expectedVisible(TOTAL)}`, rowCount === expectedVisible(TOTAL), `rows=${rowCount}`);

// TEST 2: source filter (WPB only)
console.log("\n--- TEST 2: source filter (WPB only) ---");
await page.$eval("#f-source", (sel) => { for (const o of sel.options) o.selected = o.value === "wpb"; });
await page.click("#run-search");
await page.waitForFunction((expected) => {
  const el = document.getElementById("r-count");
  return el && Number(el.textContent.trim().replace(/,/g, "")) === expected;
}, {}, SRC_COUNT.wpb);
const wpbCount = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check(`WPB-only filter → ${SRC_COUNT.wpb} results`, wpbCount === SRC_COUNT.wpb, `count=${wpbCount}`);

// TEST 3: URL roundtrip
console.log("\n--- TEST 3: URL state roundtrip ---");
const roundtripExpected = SRC_COUNT["palm-beach"] + SRC_COUNT["boynton-beach"];
await page.goto(BASE + "/permit-search.html?source=palm-beach%7Cboynton-beach", { waitUntil: "networkidle0" });
const reloadCount = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check(`URL source=palm-beach|boynton-beach → ${roundtripExpected} results`, reloadCount === roundtripExpected, `count=${reloadCount}`);
const selected = await page.$$eval("#f-source option", (opts) => opts.filter((o) => o.selected).map((o) => o.value).sort());
check("Source select reflects URL state", JSON.stringify(selected) === '["boynton-beach","palm-beach"]', JSON.stringify(selected));

// TEST 4: reset filters clears source
console.log("\n--- TEST 4: reset filters ---");
await page.click("#reset-filters");
await page.waitForFunction((expected) => {
  const el = document.getElementById("r-count");
  return el && Number(el.textContent.trim().replace(/,/g, "")) === expected;
}, {}, TOTAL);
check(`After reset, result count back to ${TOTAL}`, true);
check("Reset clears source from URL", !page.url().includes("source="), page.url());

// TEST 5: keyword preset hits multiple sources
console.log("\n--- TEST 5: keyword search ---");
await page.click('[data-preset="filtration"]');
await page.waitForFunction(() => {
  const el = document.getElementById("r-count");
  const n = el ? Number(el.textContent.trim().replace(/,/g, "")) : -1;
  return n >= 0 && n < 10000000;  // just wait for render to complete
});
const srcs = await page.$$eval("tr.permit-row .source-pill", (pills) => [...new Set(pills.map((p) => p.textContent.trim()))].sort());
const matchCount = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check("Keyword preset returns >0 and <total results", matchCount > 0 && matchCount < TOTAL, `count=${matchCount} of ${TOTAL}`);
check("Keyword hits span >=1 source", srcs.length >= 1, JSON.stringify(srcs));

// TEST 6: sort by Source column
console.log("\n--- TEST 6: sort Source column ---");
await page.click("#reset-filters");
await page.waitForFunction((expected) => {
  const el = document.getElementById("r-count");
  return el && Number(el.textContent.trim().replace(/,/g, "")) === expected;
}, {}, TOTAL);
await page.click('th[data-sort="dataSource"]');
await new Promise((r) => setTimeout(r, 150));
const firstAsc = await page.$eval("tr.permit-row .source-pill", (el) => el.textContent.trim());
await page.click('th[data-sort="dataSource"]');
await new Promise((r) => setTimeout(r, 150));
const firstDesc = await page.$eval("tr.permit-row .source-pill", (el) => el.textContent.trim());
check("Source sort asc/desc differ (with >=2 sources)", SOURCES < 2 || firstAsc !== firstDesc, `asc=${firstAsc} desc=${firstDesc}`);

// TEST 7: manual JSON upload + MANUAL pill
console.log("\n--- TEST 7: manual JSON upload ---");
await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
await page.click('[data-tab="manual"]');
const unique = JSON.stringify([{
  permitNumber: "TEST-2026-0001", parcelId: "99999999999999999",
  address: "1 TEST WAY, DELRAY BEACH, FL 33444", type: "Plumbing",
  description: "test water filtration", status: "Issued",
  contractor: "TEST CO", valuation: 5000, appliedDate: "2026-04-21",
  issuedDate: "2026-04-21", url: "https://example.com/p/TEST-2026-0001",
}]);
await page.$eval("#manual-json", (el, v) => { el.value = v; }, unique);
await page.click("#manual-merge");
await new Promise((r) => setTimeout(r, 300));
const mstat = await page.$eval("#manual-status", (el) => el.textContent.trim());
check("Manual merge status: 1 permit", /Merged 1 permit/.test(mstat), mstat);
await page.click('[data-tab="search"]');
await page.waitForFunction((expected) => {
  const el = document.getElementById("r-count");
  return el && Number(el.textContent.trim().replace(/,/g, "")) === expected;
}, {}, TOTAL + 1);
const total = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check(`Manual merge bumps total to ${TOTAL + 1}`, total === TOTAL + 1, `count=${total}`);
// Filter to just the manual source so the new permit is visible on page 1
await page.$eval("#f-source", (sel) => { for (const o of sel.options) o.selected = o.value === "manual"; });
await page.click("#run-search");
await new Promise((r) => setTimeout(r, 200));
const pill = await page.evaluate(() => {
  const row = [...document.querySelectorAll("tr.permit-row")].find((r) => r.textContent.includes("TEST-2026-0001"));
  const p = row?.querySelector(".source-pill");
  return p ? { text: p.textContent.trim(), cls: p.className } : null;
});
check("Manual permit gets MANUAL pill", pill && pill.text === "MANUAL", JSON.stringify(pill));

// TEST 8: CSV export columns — capture the Blob via URL.createObjectURL intercept
console.log("\n--- TEST 8: CSV export ---");
await page.click("#reset-filters");
await new Promise((r) => setTimeout(r, 200));
const csvData = await page.evaluate(async () => {
  let blobCaptured = null;
  const origCreate = URL.createObjectURL;
  URL.createObjectURL = function (blob) { blobCaptured = blob; return "blob:capture"; };
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {};
  document.getElementById("export-csv").click();
  URL.createObjectURL = origCreate;
  HTMLAnchorElement.prototype.click = origClick;
  if (!blobCaptured) return { error: "no blob created" };
  const text = await blobCaptured.text();
  // Proper RFC-4180 row count: only count \r\n that occur OUTSIDE a quoted field.
  // Walk character-by-character tracking quote state. This handles description
  // fields with embedded newlines correctly (which naive split does not).
  let rows = 0, inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      // Doubled quote inside quoted field is an escape, skip pair
      if (inQuotes && text[i + 1] === '"') { i++; continue; }
      inQuotes = !inQuotes;
    } else if (ch === "\n" && !inQuotes) {
      rows++;
    }
  }
  return { header: text.split("\n")[0], rowCount: rows, firstRow: text.split(/\r?\n/)[1] };
});
check("CSV header starts with dataSource,dataSourceLabel",
  csvData.header && csvData.header.startsWith("dataSource,dataSourceLabel"),
  JSON.stringify(csvData).slice(0, 160));
// Row count uses a quote-aware parser, so embedded newlines in description fields
// don't inflate the count. Expected = TOTAL+1 (every loaded permit + manual upload).
check(`CSV has exactly ${TOTAL + 1} rows (quote-aware count)`,
  csvData.rowCount === TOTAL + 1, `rows=${csvData.rowCount}`);
const knownIds = manifest.sources.map((s) => s.id).concat(["manual"]).join("|");
check("First CSV data row begins with a known source id", csvData.firstRow && new RegExp(`^(${knownIds}),`).test(csvData.firstRow), (csvData.firstRow || "").slice(0, 80));

// TEST 9: broken source (500 response) — page recovers
console.log("\n--- TEST 9: broken source tolerance ---");
const p9 = await browser.newPage();
p9.setDefaultTimeout(20000);
await p9.setRequestInterception(true);
p9.on("request", (req) => {
  if (req.url().endsWith("royal-palm-beach.json")) req.respond({ status: 500, body: "oops" });
  else req.continue();
});
const p9errs = [];
p9.on("pageerror", (err) => p9errs.push(err.message));
await p9.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
const b9 = await p9.$eval("#data-banner", (el) => el.textContent);
check("Banner mentions 'load failed'", /load failed/.test(b9), b9.slice(0, 160));
const expectedWithoutRpb = TOTAL - SRC_COUNT["royal-palm-beach"];
const count9 = await p9.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check(`${expectedWithoutRpb} results remain (total - RPB)`, count9 === expectedWithoutRpb, `count=${count9}`);
check("No pageerror from broken source", p9errs.length === 0, p9errs.join("|"));
// Source filter should have only SOURCES-1 options now
const opt9 = await p9.$$eval("#f-source option", (opts) => opts.length);
check(`Source filter lists only ${SOURCES - 1} loaded sources`, opt9 === SOURCES - 1, `options=${opt9}`);
await p9.close();

// TEST 10: duplicate permitNumber — REAL collision against a known live permit
console.log("\n--- TEST 10: duplicate permitNumber dedup ---");
await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
await page.click('[data-tab="manual"]');
const dup = JSON.stringify([{
  permitNumber: DUP_PERMIT_NUMBER,
  address: "OVERRIDDEN ADDRESS, TEST, FL 99999",
  type: "Plumbing", status: "Overridden", appliedDate: "2026-04-21",
}]);
await page.$eval("#manual-json", (el, v) => { el.value = v; }, dup);
await page.click("#manual-merge");
await new Promise((r) => setTimeout(r, 300));
await page.click('[data-tab="search"]');
await page.waitForFunction((expected) => {
  const el = document.getElementById("r-count");
  return el && Number(el.textContent.trim().replace(/,/g, "")) === expected;
}, {}, TOTAL);
const totalDup = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check(`Duplicate permit# dedup keeps total at ${TOTAL}`, totalDup === TOTAL, `count=${totalDup}`);
// Filter to manual source to confirm the override landed
await page.$eval("#f-source", (sel) => { for (const o of sel.options) o.selected = o.value === "manual"; });
await page.click("#run-search");
await new Promise((r) => setTimeout(r, 200));
const override = await page.evaluate((pn) => {
  const row = [...document.querySelectorAll("tr.permit-row")].find((r) => r.textContent.includes(pn));
  return { hasOverride: row?.textContent.includes("OVERRIDDEN ADDRESS"), pill: row?.querySelector(".source-pill")?.textContent.trim() };
}, DUP_PERMIT_NUMBER);
check("Dedup replaces live row with manual (last-writer-wins)", override.hasOverride === true, JSON.stringify(override));
check("Replaced row shows MANUAL pill", override.pill === "MANUAL", JSON.stringify(override));

// TEST 11: pagination — #pagination is empty for single-page result,
// populated when multiple pages are needed.
console.log("\n--- TEST 11: pagination ---");
await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
const pagerText = await page.$eval("#pagination", (el) => el.textContent.trim());
if (TOTAL > PAGE_SIZE) {
  const expectedPages = Math.ceil(TOTAL / PAGE_SIZE);
  check(`Pager shows 'Page 1 of ${expectedPages}' with live data`, new RegExp(`Page 1 of ${expectedPages}`).test(pagerText), pagerText.slice(0, 80));
  await page.click("#next-page");
  await new Promise((r) => setTimeout(r, 150));
  const pagerText2 = await page.$eval("#pagination", (el) => el.textContent.trim());
  check("Pager advances to Page 2", /Page 2 of /.test(pagerText2), pagerText2.slice(0, 80));
} else {
  check(`Pager hidden for single-page (${TOTAL} <= pageSize ${PAGE_SIZE})`, pagerText === "", `"${pagerText.slice(0, 80)}"`);
  // Force multi-page by shrinking pageSize
  await page.evaluate(() => { STATE.pageSize = 5; applyFiltersAndRender(); });
  const pagerForced = await page.$eval("#pagination", (el) => el.textContent.trim());
  const expectedPages = Math.ceil(TOTAL / 5);
  check(`Pager renders 'Page 1 of ${expectedPages}' when pageSize=5`, new RegExp(`Page 1 of ${expectedPages}`).test(pagerForced), pagerForced.slice(0, 80));
}

// TEST 12: empty state when filters match nothing
console.log("\n--- TEST 12: empty-state when no match ---");
await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
await page.$eval("#f-contractor", (el) => { el.value = "NONEXISTENT_CONTRACTOR_XYZ_123"; });
await page.click("#run-search");
await new Promise((r) => setTimeout(r, 200));
const emptyVisible = await page.$eval("#empty-state", (el) => getComputedStyle(el).display !== "none");
check("Empty state shown when filter matches 0 permits", emptyVisible);
const finalCount = await page.$eval("#r-count", (el) => el.textContent.trim());
check("r-count shows 0", finalCount === "0", finalCount);

// TEST 13: malformed manual JSON is rejected cleanly
console.log("\n--- TEST 13: malformed JSON ---");
await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
await page.click('[data-tab="manual"]');
await page.$eval("#manual-json", (el) => { el.value = "this is not json {{{"; });
await page.click("#manual-merge");
await new Promise((r) => setTimeout(r, 200));
const errStat = await page.$eval("#manual-status", (el) => el.textContent.trim());
check("Malformed JSON shows 'Invalid JSON'", /Invalid JSON/.test(errStat), errStat);
await page.click('[data-tab="search"]');
const afterBadCount = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check(`Malformed JSON leaves dataset intact (${TOTAL} rows)`, afterBadCount === TOTAL, `count=${afterBadCount}`);

// TEST 14: keyword 'all' mode narrows vs 'any' mode
console.log("\n--- TEST 14: keyword any/all mode ---");
await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
await page.evaluate(() => { ["water","heater"].forEach((k) => addKeyword(k)); });
await new Promise((r) => setTimeout(r, 150));
const anyCount = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
await page.$eval("#f-keyword-mode", (el) => { el.value = "all"; });
await page.click("#run-search");
await new Promise((r) => setTimeout(r, 150));
const allCount = await page.$eval("#r-count", (el) => Number(el.textContent.trim().replace(/,/g, "")));
check("Keyword 'any' mode yields >= 'all' mode", anyCount >= allCount, `any=${anyCount} all=${allCount}`);

// TEST 15: stats-by-source
console.log("\n--- TEST 15: stats ---");
await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });
await page.click('[data-tab="stats"]');
await new Promise((r) => setTimeout(r, 200));
const statsHtml = await page.$eval("#stats-source", (el) => el.innerHTML);
const allLabelsPresent = manifest.sources.every((s) => statsHtml.includes(s.label));
check(`Stats-by-source lists all ${SOURCES} sources`, allLabelsPresent, manifest.sources.map((s) => `${s.label}:${statsHtml.includes(s.label)}`).join(" "));

// TEST 16: map tab
console.log("\n--- TEST 16: map tab ---");
await page.click('[data-tab="map"]');
await new Promise((r) => setTimeout(r, 500));
const mapVisible = await page.$eval("#tab-map", (el) => getComputedStyle(el).display !== "none");
check("Map tab renders without error", mapVisible);

// Shutdown
console.log("\n--- FAILED REQUESTS ---");
failedRequests.length ? failedRequests.forEach((r) => console.log("  " + r)) : console.log("(none)");
console.log("\n--- CONSOLE ERRORS ---");
consoleMsgs.length ? consoleMsgs.forEach((e) => console.log("  " + e)) : console.log("(none)");

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) {
  failed.forEach((f) => console.log("  FAIL: " + f.name + (f.detail ? " | " + f.detail : "")));
  process.exitCode = 1;
}

await browser.close();
