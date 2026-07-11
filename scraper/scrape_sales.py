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
from realauction import scrape_realauction_county


HERE = Path(__file__).parent
ROOT = HERE.parent
SOURCES_PATH    = HERE / "sources.json"
MANUAL_PATH     = HERE / "manual_sales.json"
CURATED_PATH    = HERE / "curated_sales.json"
OUTPUT_PATH     = ROOT / "sales.json"
# RealAuction/RealForeclose AWS ELB returns 403 to non-browser User-Agents.
# Use a normal browser UA + navigation headers (verified 2026-07-11).
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}
REQUEST_TIMEOUT = 25
DELAY_BETWEEN_REQUESTS = 1.5  # seconds, polite scraping


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def fetch(url, referer=None):
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
        headers["Sec-Fetch-Site"] = "same-origin"
    r = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    if r.status_code == 403:
        snippet = (r.text or "")[:180].replace("\n", " ")
        raise requests.HTTPError(
            f"403 Forbidden (server={r.headers.get('server')}; body={snippet!r})",
            response=r,
        )
    r.raise_for_status()
    return r.text


def realauction_candidate_urls(home_url):
    """Homepage often has no sale list; PREVIEW/calendar pages do."""
    base = home_url.rstrip("/")
    return [
        f"{base}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW",
        f"{base}/index.cfm?zaction=AUCTION&Zmethod=CALENDAR",
        f"{base}/index.cfm?zaction=USER&zmethod=CALENDAR",
        f"{base}/index.cfm?ZACTION=HOME&ZMETHOD=TAXDEED",
        home_url,
    ]


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

    # RealAuction: dedicated session scraper recovers dates + parcel counts
    if parser_name == "realauction":
        try:
            sales = scrape_realauction_county(url)
            if sales:
                return sales, None
            return None, "RealAuction preview returned no future dates"
        except requests.RequestException as e:
            return None, f"RealAuction fetch failed: {e}"
        except Exception as e:  # pylint: disable=broad-except
            return None, f"RealAuction error: {type(e).__name__}: {e}"

    urls = [url]
    last_err = None
    for candidate in urls:
        try:
            html = fetch(candidate, referer=url)
        except requests.RequestException as e:
            last_err = f"fetch failed: {e}"
            continue
        try:
            sales = parser(html)
            if sales:
                for s in sales:
                    s.setdefault("source", "scraper")
                    s.setdefault("officialUrl", candidate)
                return sales, None
        except NoDataError as e:
            last_err = str(e)
            continue
        except Exception as e:  # pylint: disable=broad-except
            last_err = f"parse error: {type(e).__name__}: {e}"
            continue
    return None, last_err or "no parseable sale dates"


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
    stats = {"scraped": 0, "manual": 0, "curated": 0, "failed": 0, "skipped": 0}

    for i, (county, cfg) in enumerate(sources.items()):
        if i > 0:
            time.sleep(DELAY_BETWEEN_REQUESTS)
        print(f"[{i+1}/{len(sources)}] {county:<14}  ", end="", flush=True)
        sales, err = scrape_county(county, cfg)
        if sales:
            for s in sales:
                s.setdefault("source", "scraper")
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
        future = [e for e in entries if e.get("date", "") >= datetime.now().strftime("%Y-%m-%d")]
        if not future:
            continue
        for e in future:
            e.setdefault("source", "manual")
        if county in out_sales:
            existing = {e["date"]: e for e in out_sales[county]}
            for e in future:
                existing[e["date"]] = e
            out_sales[county] = sorted(existing.values(), key=lambda x: x["date"])
        else:
            out_sales[county] = future
        stats["manual"] += 1

    # Curated cadence / manually verified top metros (scraper offline fallback)
    if CURATED_PATH.exists():
        curated_doc = load_json(CURATED_PATH)
        for county, entries in (curated_doc.get("counties") or {}).items():
            if not entries:
                continue
            # If we already scraped this county, keep scraper dates only —
            # cadence must not invent extra sale days alongside live lists.
            existing_list = out_sales.get(county) or []
            if any(e.get("source") == "scraper" for e in existing_list):
                continue
            future = [e for e in entries if e.get("date", "") >= datetime.now().strftime("%Y-%m-%d")]
            if not future:
                continue
            for e in future:
                e.setdefault("source", "cadence")
            out_sales[county] = future
            stats["curated"] += 1

    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stats":     stats,
        "sales":     out_sales,
    }

    print()
    print("=" * 60)
    print(f"Scraped:  {stats['scraped']}")
    print(f"Manual:   {stats['manual']}")
    print(f"Curated:  {stats['curated']}")
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
