"""
scrape_sales.py
---------------
Fetches each county's auction-platform homepage, extracts upcoming sale
dates, merges with manually-entered fallback data, and writes sales.json
to the site root for tax-deeds.html to consume.

Run:
    cd scraper
    pip install -r requirements.txt
    python scrape_sales.py

Output: ../sales.json
{
  "generated": "2026-04-18T18:55:00Z",
  "stats":     { "scraped": 42, "manual": 4, "failed": 5 },
  "sales":     { "Orange": [{...}], "Miami-Dade": [...], ... }
}

Designed to be run by GitHub Actions on a weekly cron.
"""

import json
import sys
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path

import requests

from parsers import PARSERS, NoDataError


HERE = Path(__file__).parent
ROOT = HERE.parent
SOURCES_PATH    = HERE / "sources.json"
MANUAL_PATH     = HERE / "manual_sales.json"
OUTPUT_PATH     = ROOT / "sales.json"
HEADERS = {
    "User-Agent": "FloridaTaxDeedRegistry/1.0 (+contact: hello@example.com)",
    "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
REQUEST_TIMEOUT = 15
DELAY_BETWEEN_REQUESTS = 1.5  # seconds, polite scraping


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.text


def scrape_county(county_name, cfg):
    parser_name = cfg.get("parser")
    url = cfg.get("url")
    if not parser_name or not url:
        return None, "missing parser/url"
    if parser_name == "manual":
        return None, "manual-only county"
    parser = PARSERS.get(parser_name)
    if not parser:
        return None, f"unknown parser '{parser_name}'"

    try:
        html = fetch(url)
    except requests.RequestException as e:
        return None, f"fetch failed: {e}"

    try:
        sales = parser(html)
        return sales, None
    except NoDataError as e:
        return None, str(e)
    except Exception as e:  # pylint: disable=broad-except
        return None, f"parse error: {type(e).__name__}: {e}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="Comma-separated list of counties to scrape (debug)")
    ap.add_argument("--dry-run", action="store_true", help="Don't write sales.json")
    ap.add_argument("--verbose", "-v", action="store_true")
    args = ap.parse_args()

    sources = {k: v for k, v in load_json(SOURCES_PATH).items() if not k.startswith("_")}
    manual  = {k: v for k, v in load_json(MANUAL_PATH).items()  if not k.startswith("_")}

    only = set(args.only.split(",")) if args.only else None
    if only:
        sources = {k: v for k, v in sources.items() if k in only}

    out_sales = {}
    stats = {"scraped": 0, "manual": 0, "failed": 0, "skipped": 0}

    for i, (county, cfg) in enumerate(sources.items()):
        if i > 0:
            time.sleep(DELAY_BETWEEN_REQUESTS)
        print(f"[{i+1}/{len(sources)}] {county:<14}  ", end="", flush=True)
        sales, err = scrape_county(county, cfg)
        if sales:
            out_sales[county] = sales
            stats["scraped"] += 1
            print(f"OK   {len(sales)} dates  -> {', '.join(s['date'] for s in sales[:3])}{'...' if len(sales) > 3 else ''}")
        else:
            stats["failed"] += 1
            print(f"FAIL {err}")

    # Layer manual entries on top — they win conflicts and can fill gaps
    for county, entries in manual.items():
        if not entries:
            continue
        # Filter past entries
        future = [e for e in entries if e.get("date", "") >= datetime.now().strftime("%Y-%m-%d")]
        if not future:
            continue
        if county in out_sales:
            # Merge by date, manual entries overwrite
            existing = {e["date"]: e for e in out_sales[county]}
            for e in future:
                existing[e["date"]] = e
            out_sales[county] = sorted(existing.values(), key=lambda x: x["date"])
        else:
            out_sales[county] = future
        stats["manual"] += 1

    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stats":     stats,
        "sales":     out_sales,
    }

    print()
    print("=" * 60)
    print(f"Scraped:  {stats['scraped']}")
    print(f"Manual:   {stats['manual']}")
    print(f"Failed:   {stats['failed']}")
    print(f"Counties with sales: {len(out_sales)}")
    print(f"Total sale dates:    {sum(len(v) for v in out_sales.values())}")

    if args.dry_run:
        print("\n[dry-run] not writing sales.json")
        if args.verbose:
            print(json.dumps(payload, indent=2))
        return 0

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"\nWrote {OUTPUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
