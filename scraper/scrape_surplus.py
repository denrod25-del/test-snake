#!/usr/bin/env python3
"""
scrape_surplus.py
-----------------
Pulls per-county surplus-funds records from Clerk websites and upserts them
directly into Supabase (`surplus_history` table).

Why direct-to-Supabase instead of a JSON file like sales.json?
  * The data is Pro-only. Serving it as a public JSON file would defeat the
    paywall. Supabase's row-level-security policy on `surplus_history` already
    restricts SELECT to active Pro users, so the data lives there.
  * Volume is larger (potentially thousands of rows) and benefits from
    incremental upserts rather than a full file rewrite.

Required environment variables (set as GitHub Actions secrets, or in `.env`):
  SUPABASE_URL          https://YOUR-PROJECT.supabase.co
  SUPABASE_SERVICE_KEY  service_role key (NOT the anon key)

Usage:
  python scrape_surplus.py                   # all counties
  python scrape_surplus.py --only Orange     # one county
  python scrape_surplus.py --dry-run         # don't write to Supabase
  python scrape_surplus.py --verbose         # detailed logging
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, List

import requests

from parsers_surplus import PARSERS, NoDataError

HERE = Path(__file__).resolve().parent
SOURCES_FILE = HERE / "sources_surplus.json"
MANUAL_FILE  = HERE / "manual_surplus.json"

UA = "FloridaTaxDeedRegistry/1.0 (+contact@example.com)"
TIMEOUT = 30
SLEEP_BETWEEN = 1.5  # be polite

log = logging.getLogger("scrape_surplus")


# --------------------------------------------------------------------------
def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def fetch(url: str) -> str:
    log.debug("GET %s", url)
    r = requests.get(url, headers={"User-Agent": UA}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.text


def supabase_upsert(rows: List[Dict[str, Any]]) -> int:
    """
    Upsert a batch of records into the surplus_history table.
    Returns the number of rows actually sent.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

    endpoint = f"{url.rstrip('/')}/rest/v1/surplus_history"
    headers = {
        "apikey":        key,
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
        # natural key avoids duplicates: (county, sale_date, parcel_id)
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    }
    # send in chunks of 100 to stay well under PostgREST limits
    sent = 0
    for i in range(0, len(rows), 100):
        chunk = rows[i:i + 100]
        r = requests.post(endpoint, headers=headers, data=json.dumps(chunk), timeout=TIMEOUT)
        if r.status_code >= 300:
            log.error("Supabase upsert failed (%s): %s", r.status_code, r.text[:300])
            r.raise_for_status()
        sent += len(chunk)
    return sent


def normalize(rec: Dict[str, Any], county: str) -> Dict[str, Any]:
    """Tidy a single record before upsert. Drops obviously-empty rows."""
    if not rec.get("surplus_amount"):
        return None
    return {
        "county":          county,
        "sale_date":       rec.get("sale_date"),
        "parcel_id":       rec.get("parcel_id"),
        "property_addr":   rec.get("property_addr"),
        "prior_owner":     rec.get("prior_owner"),
        "surplus_amount": float(rec["surplus_amount"]),
        "status":          rec.get("status") or "unclaimed",
        "claim_deadline":  rec.get("claim_deadline"),
        "source_url":      rec.get("source_url"),
    }


# --------------------------------------------------------------------------
def collect(only: str | None) -> Dict[str, List[Dict[str, Any]]]:
    sources = load_json(SOURCES_FILE)
    manual  = load_json(MANUAL_FILE)
    results: Dict[str, List[Dict[str, Any]]] = {}

    counties = [only] if only else sorted({*sources.keys(), *manual.keys()} - {"_comment", "_template"})

    for county in counties:
        if county.startswith("_"):
            continue
        rows: List[Dict[str, Any]] = []

        # 1. Manual entries always win
        for rec in manual.get(county, []) or []:
            n = normalize(rec, county)
            if n: rows.append(n)

        # 2. Scrape if a source is configured
        cfg = sources.get(county)
        if cfg:
            parser_name = cfg.get("parser")
            parser = PARSERS.get(parser_name)
            if not parser:
                if parser_name != "manual":
                    log.warning("[%s] unknown parser '%s'", county, parser_name)
            else:
                try:
                    html = fetch(cfg["url"])
                    parsed = parser(html, cfg["url"])
                    for rec in parsed:
                        n = normalize(rec, county)
                        if not n:
                            continue
                        # de-dupe against manual entries on (sale_date, parcel_id)
                        key = (n["sale_date"], n["parcel_id"])
                        if any((r["sale_date"], r["parcel_id"]) == key for r in rows):
                            continue
                        rows.append(n)
                    log.info("[%s] scraped %d records", county, len(parsed))
                except NoDataError as e:
                    log.info("[%s] no data: %s", county, e)
                except requests.RequestException as e:
                    log.warning("[%s] fetch failed: %s", county, e)
                except Exception as e:    # noqa: BLE001
                    log.exception("[%s] parser crashed: %s", county, e)
                time.sleep(SLEEP_BETWEEN)

        if rows:
            results[county] = rows

    return results


# --------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only",     help="scrape only this county")
    ap.add_argument("--dry-run",  action="store_true", help="don't write to Supabase, just print")
    ap.add_argument("--verbose",  action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
    )

    results = collect(args.only)
    flat: List[Dict[str, Any]] = [r for rows in results.values() for r in rows]
    log.info("collected %d records across %d counties", len(flat), len(results))

    if args.dry_run:
        print(json.dumps(results, indent=2, default=str))
        return 0

    if not flat:
        log.info("nothing to upsert")
        return 0

    sent = supabase_upsert(flat)
    log.info("upserted %d records to Supabase", sent)
    return 0


if __name__ == "__main__":
    sys.exit(main())
