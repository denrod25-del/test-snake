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

Primary production path: Netlify scheduled function `refresh-surplus`
(uses Netlify env SUPABASE_*). This script remains the fuller multi-county
scraper for GitHub Actions once secrets are configured.

Usage:
  python scrape_surplus.py                   # all counties
  python scrape_surplus.py --only Manatee    # one county
  python scrape_surplus.py --dry-run         # don't write to Supabase
  python scrape_surplus.py --verbose         # detailed logging
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

import requests

from parsers_surplus import PARSERS, NoDataError, discover_pdf_url

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SOURCES_FILE = HERE / "sources_surplus.json"
MANUAL_FILE = HERE / "manual_surplus.json"
SNAPSHOT_FILE = HERE / ".cache" / "last-surplus-scrape.json"

# Browser UA — many Clerk / RealAuction hosts 403 bot UAs (same pattern as scrape_sales).
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
TIMEOUT = 30
SLEEP_BETWEEN = 1.5

log = logging.getLogger("scrape_surplus")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def fetch(url: str) -> str:
    log.debug("GET %s", url)
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    if r.status_code == 403:
        snippet = (r.text or "")[:180].replace("\n", " ")
        raise requests.HTTPError(
            f"403 Forbidden (server={r.headers.get('server')}; body={snippet!r})",
            response=r,
        )
    r.raise_for_status()
    return r.text


def fetch_bytes(url: str) -> bytes:
    log.debug("GET bytes %s", url)
    headers = {**HEADERS, "Accept": "application/pdf,*/*;q=0.8"}
    r = requests.get(url, headers=headers, timeout=max(TIMEOUT, 60))
    if r.status_code == 403:
        snippet = (r.text or "")[:180].replace("\n", " ")
        raise requests.HTTPError(
            f"403 Forbidden (server={r.headers.get('server')}; body={snippet!r})",
            response=r,
        )
    r.raise_for_status()
    return r.content


def scrape_county(county: str, cfg: dict) -> List[Dict[str, Any]]:
    """Fetch + parse one county config into raw surplus records."""
    parser_name = cfg.get("parser")
    parser = PARSERS.get(parser_name)
    if not parser:
        if parser_name != "manual":
            log.warning("[%s] unknown parser '%s'", county, parser_name)
        return []

    source_url = cfg["url"]
    if parser_name in ("clerk_pdf", "clerk_xlsx", "clerk_csv"):
        file_url = source_url
        pattern = cfg.get("pdf_link_pattern") or cfg.get("file_link_pattern")
        needs_discover = bool(pattern) or (
            not re.search(r"\.(pdf|xlsx|csv)(\?|$)", source_url, re.I)
            and "edoc" not in source_url.lower()
            and "export?format=csv" not in source_url.lower()
            and "docs.google.com" not in source_url.lower()
        )
        if needs_discover:
            html = fetch(source_url)
            if pattern:
                found = discover_pdf_url(html, source_url, pattern)
            else:
                found = discover_pdf_url(
                    html,
                    source_url,
                    r"(surplus|excess|overbid).*\.(pdf|xlsx)|\.(pdf|xlsx).*(surplus|excess|overbid)",
                )
            if not found:
                raise NoDataError(
                    f"no surplus file matched on listing page ({pattern or 'default'})"
                )
            file_url = found
        log.info("[%s] downloading %s", county, file_url)
        payload = fetch_bytes(file_url)
        return parser(payload, file_url)

    html = fetch(source_url)
    return parser(html, source_url)


def supabase_upsert(rows: List[Dict[str, Any]]) -> int:
    """
    Replace-per-county then insert. Avoids PostgREST on_conflict issues with
    the expression unique index on surplus_history.
    """
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set "
            "(GitHub Actions secrets, or export locally). "
            "Production refresh also runs via Netlify function refresh-surplus."
        )

    endpoint = f"{url.rstrip('/')}/rest/v1/surplus_history"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    by_county: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        by_county.setdefault(row["county"], []).append(row)

    sent = 0
    for county, county_rows in by_county.items():
        del_r = requests.delete(
            endpoint,
            headers=headers,
            params={"county": f"eq.{county}"},
            timeout=TIMEOUT,
        )
        if del_r.status_code >= 300:
            log.error("Supabase delete failed (%s): %s", del_r.status_code, del_r.text[:300])
            del_r.raise_for_status()

        for i in range(0, len(county_rows), 100):
            chunk = county_rows[i:i + 100]
            r = requests.post(endpoint, headers=headers, data=json.dumps(chunk), timeout=TIMEOUT)
            if r.status_code >= 300:
                log.error("Supabase insert failed (%s): %s", r.status_code, r.text[:300])
                r.raise_for_status()
            sent += len(chunk)
        log.info("[%s] replaced with %d rows", county, len(county_rows))
    return sent


def normalize(rec: Dict[str, Any], county: str) -> Optional[Dict[str, Any]]:
    """Tidy a single record before upsert. Requires sale_date + surplus_amount."""
    if not rec.get("surplus_amount"):
        return None
    if not rec.get("sale_date"):
        return None
    parcel = rec.get("parcel_id") or ""
    return {
        "county": county,
        "sale_date": rec.get("sale_date"),
        "parcel_id": parcel,
        "property_addr": rec.get("property_addr"),
        "prior_owner": rec.get("prior_owner"),
        "surplus_amount": float(rec["surplus_amount"]),
        "status": rec.get("status") or "unclaimed",
        "claim_deadline": rec.get("claim_deadline"),
        "source_url": rec.get("source_url"),
    }


def collect(only: str | None) -> Dict[str, List[Dict[str, Any]]]:
    sources = load_json(SOURCES_FILE)
    manual = load_json(MANUAL_FILE)
    results: Dict[str, List[Dict[str, Any]]] = {}

    counties = [only] if only else sorted({*sources.keys(), *manual.keys()} - {"_comment", "_template"})

    for county in counties:
        if county.startswith("_"):
            continue
        rows: List[Dict[str, Any]] = []

        for rec in manual.get(county, []) or []:
            n = normalize(rec, county)
            if n:
                rows.append(n)

        cfg = sources.get(county)
        if cfg and cfg.get("enabled", True):
            try:
                parsed = scrape_county(county, cfg)
                for rec in parsed:
                    n = normalize(rec, county)
                    if not n:
                        continue
                    key = (n["sale_date"], n["parcel_id"])
                    if any((r["sale_date"], r["parcel_id"]) == key for r in rows):
                        continue
                    rows.append(n)
                log.info("[%s] scraped %d usable records", county, len(parsed))
            except NoDataError as e:
                log.info("[%s] no data: %s", county, e)
            except requests.RequestException as e:
                log.warning("[%s] fetch failed: %s", county, e)
            except Exception as e:  # noqa: BLE001
                log.exception("[%s] parser crashed: %s", county, e)
            time.sleep(SLEEP_BETWEEN)

        if rows:
            results[county] = rows

    return results


def write_snapshot(results: Dict[str, List[Dict[str, Any]]], flat: List[Dict[str, Any]]) -> None:
    SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "counties": len(results),
        "records": len(flat),
        "by_county": {k: len(v) for k, v in results.items()},
        "rows": flat,
    }
    SNAPSHOT_FILE.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    log.info("wrote snapshot %s (%d rows)", SNAPSHOT_FILE, len(flat))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="scrape only this county")
    ap.add_argument("--dry-run", action="store_true", help="don't write to Supabase, just print")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
    )

    results = collect(args.only)
    flat: List[Dict[str, Any]] = [r for rows in results.values() for r in rows]
    log.info("collected %d records across %d counties", len(flat), len(results))
    write_snapshot(results, flat)

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
