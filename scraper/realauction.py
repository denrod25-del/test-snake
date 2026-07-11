"""
scraper/realauction.py
----------------------
Recover RealAuction (*.realtaxdeed.com) sale dates + parcel counts.

Plain homepage fetches used to 403 under a bot User-Agent. With a browser UA,
the PREVIEW navigator exposes upcoming AuctionDate links, and the AJAX
UPDATE?FNC=LOAD&AREA=W endpoint returns the parcel cards for that day.
"""

from __future__ import annotations

import re
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
}


def _iso_from_text(text: str) -> str | None:
    try:
        d = dateparser.parse(text, fuzzy=True)
        return d.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _iso_from_auction_date_param(href: str) -> str | None:
    m = re.search(r"AuctionDate=(\d{1,2})/(\d{1,2})/(\d{4})", href or "")
    if not m:
        return None
    mm, dd, yyyy = m.groups()
    return f"{yyyy}-{int(mm):02d}-{int(dd):02d}"


def _mdy(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{int(m):02d}/{int(d):02d}/{y}"


def discover_preview_dates(session: requests.Session, home_url: str, max_dates: int = 8) -> list[str]:
    base = home_url.rstrip("/")
    start = f"{base}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW"
    r = session.get(start, headers=BROWSER_HEADERS, timeout=25)
    r.raise_for_status()
    dates: list[str] = []
    seen_href = set()
    html = r.text
    for _ in range(max_dates):
        soup = BeautifulSoup(html, "lxml")
        date_el = soup.select_one(".BLHeaderDateDisplay")
        if date_el:
            iso = _iso_from_text(date_el.get_text(strip=True))
            if iso and iso not in dates:
                dates.append(iso)
        for a in soup.select(".BLHeaderPrev a, .BLHeaderNext a, .BLHeaderToday a"):
            iso = _iso_from_auction_date_param(a.get("href") or "")
            if iso and iso not in dates:
                dates.append(iso)
        next_a = soup.select_one(".BLHeaderNext a")
        href = next_a.get("href") if next_a else None
        if not href or href in seen_href:
            break
        seen_href.add(href)
        r = session.get(urljoin(base + "/", href), headers={**BROWSER_HEADERS, "Referer": start}, timeout=25)
        r.raise_for_status()
        html = r.text
    today = datetime.now().strftime("%Y-%m-%d")
    return sorted({d for d in dates if d >= today})


def count_parcels_for_date(session: requests.Session, home_url: str, iso_date: str) -> int | None:
    """Return parcel card count for a sale day via AREA=W AJAX load."""
    base = home_url.rstrip("/")
    preview = f"{base}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AuctionDate={_mdy(iso_date)}"
    session.get(preview, headers=BROWSER_HEADERS, timeout=25)
    ajax_headers = {
        **BROWSER_HEADERS,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": preview,
    }
    ids: set[str] = set()
    # First page
    r = session.get(
        f"{base}/index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=W&PageDir=0&doR=1&tx=1",
        headers=ajax_headers,
        timeout=25,
    )
    r.raise_for_status()
    try:
        data = r.json()
    except ValueError:
        return None
    html = data.get("retHTML") or ""
    ids |= set(re.findall(r"AITEM_(\d+)", html))
    # Walk "next page" if the platform paginates (PageDir=1)
    for step in range(1, 25):
        r = session.get(
            f"{base}/index.cfm?zaction=AUCTION&Zmethod=UPDATE&FNC=LOAD&AREA=W&PageDir=1&doR=0&tx={step + 1}",
            headers=ajax_headers,
            timeout=25,
        )
        if r.status_code != 200:
            break
        try:
            data = r.json()
        except ValueError:
            break
        html = data.get("retHTML") or ""
        page_ids = set(re.findall(r"AITEM_(\d+)", html))
        if not page_ids or page_ids <= ids:
            break
        ids |= page_ids
    return len(ids) if ids else 0


def scrape_realauction_county(home_url: str) -> list[dict]:
    """Return [{date, count, source, officialUrl}, ...] for one RealAuction county."""
    session = requests.Session()
    dates = discover_preview_dates(session, home_url)
    out = []
    for iso in dates:
        count = count_parcels_for_date(session, home_url, iso)
        entry = {
            "date": iso,
            "source": "scraper",
            "officialUrl": f"{home_url.rstrip('/')}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW&AuctionDate={_mdy(iso)}",
        }
        if count is not None:
            entry["count"] = count
        out.append(entry)
    return out
