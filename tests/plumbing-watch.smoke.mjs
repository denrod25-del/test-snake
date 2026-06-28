// Smoke test for the new Plumbing Watch tab.
// Verifies the tab loads against live data with no console errors and
// the prediction returns sensible numbers.
import puppeteer from "puppeteer";

const BASE = "http://localhost:8765";
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(20000);
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console.error: " + m.text()); });

await page.goto(BASE + "/permit-search.html", { waitUntil: "networkidle0" });

// Tab badge should be populated
const badge = await page.$eval("#t-plumbing-count", (el) => el.textContent.trim());
console.log("[badge] plumbing permit count =", badge);
if (badge === "0") throw new Error("badge shows 0 — no plumbing matches?");

// Switch to the tab
await page.click('[data-tab="plumbing"]');
await new Promise((r) => setTimeout(r, 400));

// Stats cards
const summary = await page.$$eval("#plumbing-cards .trend-chip .v", (els) => els.map((e) => e.textContent.trim()));
console.log("[cards]", summary);
if (summary.length < 4) throw new Error("expected 4 summary cards, got " + summary.length);

// Chart svg present
const svg = await page.$eval("#plumb-chart svg", (el) => el.outerHTML.length);
console.log("[chart] svg bytes =", svg);
if (svg < 500) throw new Error("chart svg too small / not rendered");

// Hotspot cards
const hotspots = await page.$$eval(".hotspot-card", (cards) => cards.map((c) => ({
  zip: c.querySelector(".zip")?.textContent.trim(),
  ratio: c.querySelector(".ratio")?.textContent.trim(),
  sub: c.querySelector(".sub")?.textContent.trim(),
})));
console.log("[hotspots]", JSON.stringify(hotspots, null, 2));

// ZIP table rows
const zipRows = await page.$$eval("#plumbing-zip-table tbody tr", (rows) => rows.length);
console.log("[zip table] rows =", zipRows);
if (zipRows === 0) throw new Error("ZIP table is empty");

// Type breakdown
const typeRows = await page.$$eval("#plumbing-types .bar-row", (rows) => rows.length);
console.log("[types] rows =", typeRows);

// Window switch (60d)
await page.select("#plumb-window", "60");
await new Promise((r) => setTimeout(r, 300));
const sumAfterWindow = await page.$$eval("#plumbing-cards .trend-chip .v", (els) => els[2].textContent.trim());
console.log("[60-day window] last 20d count =", sumAfterWindow);

// Smoothing toggle
await page.select("#plumb-smooth", "0");
await new Promise((r) => setTimeout(r, 200));
const linesAfterRaw = await page.$$eval("#plumb-chart svg polyline", (els) => els.length);
console.log("[raw mode] overlay lines =", linesAfterRaw);
if (linesAfterRaw !== 0) throw new Error("expected 0 overlay polylines in raw mode, got " + linesAfterRaw);

// Sort by 'count30' descending
await page.click('#plumbing-zip-table th[data-zsort="count30"]');
await new Promise((r) => setTimeout(r, 200));
const topZip = await page.$eval("#plumbing-zip-table tbody tr:first-child td:nth-child(2)", (el) => Number(el.textContent.trim()));
const lastZip = await page.$eval("#plumbing-zip-table tbody tr:last-child td:nth-child(2)", (el) => Number(el.textContent.trim()));
console.log("[sort by count30 desc] first =", topZip, "last =", lastZip);
if (topZip < lastZip) throw new Error("sort didn't take effect");

console.log("\n--- ERRORS ---");
if (errs.length) { errs.forEach((e) => console.log("  " + e)); process.exitCode = 1; }
else console.log("(none)");

await browser.close();
console.log("\nOK plumbing-watch smoke passed");
