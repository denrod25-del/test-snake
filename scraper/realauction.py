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


def is_tax_deed_preview_html(html: str) -> bool:
    """
    RealAuction hosts often share calendars between tax deeds and foreclosures.
    Tax-deed cards reference tax certificates; foreclosure cards show plaintiff /
    final judgment. Keep only tax-deed days for DeedScout sale dates.
    """
    if not html:
        return False
    lower = html.lower()
    has_cert = "certificate" in lower
    has_tax = "tax deed" in lower or "taxdeed" in lower
    has_fc = "plaintiff" in lower or "final judgment" in lower
    if has_fc and not has_cert:
        return False
    return has_cert or has_tax


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
    if not is_tax_deed_preview_html(html):
        return 0
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


def _host_candidates(home_url: str) -> list[str]:
    """
    Prefer the configured host, then the sibling RealAuction product host.
    Many tax-deed calendars live on *.realforeclose.com while *.realtaxdeed.com
    redirects to the corporate marketing site (or shows an empty splash).
    """
    base = home_url.rstrip("/")
    out = [base]
    if "realtaxdeed.com" in base:
        out.append(base.replace("realtaxdeed.com", "realforeclose.com"))
    elif "realforeclose.com" in base:
        out.append(base.replace("realforeclose.com", "realtaxdeed.com"))
    # de-dupe, preserve order
    seen = set()
    uniq = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def is_live_realauction_host(session: requests.Session, home_url: str) -> bool:
    """False when the subdomain redirects to www.realauction.com marketing."""
    try:
        r = session.get(home_url, headers=BROWSER_HEADERS, timeout=25, allow_redirects=True)
    except requests.RequestException:
        return False
    final = (r.url or "").lower()
    if "www.realauction.com" in final or final.rstrip("/").endswith("://realauction.com"):
        return False
    title = ""
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(r.text, "lxml")
        title = (soup.title.get_text(strip=True) if soup.title else "").lower()
    except Exception:
        title = ""
    if "online auction software solutions" in title:
        return False
    return r.status_code == 200


def scrape_realauction_county(home_url: str) -> list[dict]:
    """Return [{date, count, source, officialUrl}, ...] for one RealAuction county."""
    session = requests.Session()
    last_empty_reason = "no future preview dates"
    for candidate in _host_candidates(home_url):
        if not is_live_realauction_host(session, candidate):
            last_empty_reason = f"host not live ({candidate})"
            continue
        dates = discover_preview_dates(session, candidate)
        if not dates:
            last_empty_reason = f"no future preview dates on {candidate}"
            continue
        out = []
        for iso in dates:
            # count_parcels_for_date returns 0 for foreclosure-only calendar days
            # (common on *.realforeclose.com hosts that mix sale types).
            count = count_parcels_for_date(session, candidate, iso)
            if not count:
                continue
            out.append(
                {
                    "date": iso,
                    "source": "scraper",
                    "count": count,
                    "officialUrl": (
                        f"{candidate}/index.cfm?zaction=AUCTION&Zmethod=PREVIEW"
                        f"&AuctionDate={_mdy(iso)}"
                    ),
                }
            )
        if out:
            return out
        last_empty_reason = (
            f"preview dates found on {candidate} but no tax-deed parcel days"
        )
    # Signal empty to caller; message is useful for scrape_sales logging.
    scrape_realauction_county.last_error = last_empty_reason  # type: ignore[attr-defined]
    return []
