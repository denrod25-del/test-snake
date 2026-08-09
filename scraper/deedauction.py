"""
scraper/deedauction.py
----------------------
Recover upcoming tax-deed sales from Grant Street / DeedAuction hosts
(e.g. broward.deedauction.net).

The public /auctions page loads a DataTable via POST /auctions/upcoming.
"""

from __future__ import annotations

import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def scrape_deedauction_county(home_url: str) -> list[dict]:
    """Return [{date, count, source, officialUrl}, ...] for one DeedAuction host."""
    base = home_url.rstrip("/")
    session = requests.Session()
    landing = session.get(f"{base}/auctions", headers=BROWSER_HEADERS, timeout=25)
    landing.raise_for_status()
    soup = BeautifulSoup(landing.text, "lxml")
    csrf_el = soup.find("meta", attrs={"name": "csrf_token"})
    csrf = csrf_el.get("content") if csrf_el else None

    headers = {
        **BROWSER_HEADERS,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{base}/auctions",
        "Origin": base,
    }
    if csrf:
        headers["X-CSRF-Token"] = csrf

    r = session.post(
        f"{base}/auctions/upcoming",
        headers=headers,
        data={"draw": 1, "start": 0, "length": 100},
        timeout=25,
    )
    r.raise_for_status()
    try:
        payload = r.json()
    except ValueError as e:
        raise RuntimeError(f"DeedAuction upcoming response was not JSON: {e}") from e

    today = datetime.now().strftime("%Y-%m-%d")
    out: list[dict] = []
    for row in payload.get("data") or []:
        if (row.get("type") or "").lower() not in ("", "tax_deed", "taxdeed"):
            # Keep rows that look like tax deeds even if type missing.
            desc = str(row.get("description") or "")
            if "tax deed" not in desc.lower():
                continue
        iso = None
        bidding_start = row.get("bidding_start") or ""
        m = re.match(r"(\d{4}-\d{2}-\d{2})", str(bidding_start))
        if m:
            iso = m.group(1)
        if not iso:
            desc = str(row.get("description") or "")
            m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", desc)
            if m:
                mm, dd, yyyy = m.groups()
                iso = f"{yyyy}-{int(mm):02d}-{int(dd):02d}"
        if not iso or iso < today:
            continue
        entry = {
            "date": iso,
            "source": "scraper",
            "officialUrl": f"{base}/auctions",
        }
        count = row.get("item_count")
        if count is not None:
            try:
                entry["count"] = int(count)
            except (TypeError, ValueError):
                pass
        href = None
        bce = row.get("batch_closing_end")
        if isinstance(bce, dict):
            href = bce.get("href")
        if href:
            entry["officialUrl"] = href if str(href).startswith("http") else f"{base}{href}"
        out.append(entry)

    # de-dupe by date, prefer higher count
    by_date: dict[str, dict] = {}
    for e in out:
        prev = by_date.get(e["date"])
        if not prev or (e.get("count") or 0) >= (prev.get("count") or 0):
            by_date[e["date"]] = e
    return [by_date[k] for k in sorted(by_date)]
