"""
Per-platform HTML parsers.

Each parser receives raw HTML and returns a list of:
    [{ "date": "YYYY-MM-DD", "count": int|None, "opening": str|None }, ...]

These platforms publish upcoming auctions on their landing or calendar pages.
The HTML structure of each platform has been reverse-engineered from public
pages, but vendors do redesign occasionally — when a parser breaks, the right
fix is usually a small selector update here.

If a page can't be parsed, raise NoDataError so the caller can fall back to
manual data without polluting the output with empty arrays.
"""

import re
from datetime import datetime
from bs4 import BeautifulSoup
from dateutil import parser as dateparser


class NoDataError(Exception):
    """Raised when a page contains no parseable upcoming-sale data."""


# ----------------------------------------------------------------------------
# RealAuction (*.realtaxdeed.com)
# ----------------------------------------------------------------------------
# RealAuction sites render an "Upcoming Auctions" section on the homepage with
# date headers in the form "Wednesday, May 6, 2026" and a parcel count beside.
# When the markup is JS-rendered, we additionally check the `auctionDates` JSON
# blob that the platform inlines into a <script> tag for the calendar widget.

REALAUCTION_DATE_PATTERN = re.compile(
    r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}'
)


def parse_realauction(html: str):
    soup = BeautifulSoup(html, "lxml")
    out = []
    by_date = {}

    def add_entry(iso, count=None, opening=None):
        if not iso:
            return
        try:
            if datetime.strptime(iso, "%Y-%m-%d").date() < datetime.now().date():
                return
        except ValueError:
            return
        entry = by_date.get(iso) or {"date": iso}
        if count is not None:
            entry["count"] = count
        if opening:
            entry["opening"] = opening
        by_date[iso] = entry

    # Strategy 0: RealAuction PREVIEW navigator (.BLHeaderDateDisplay + prev/next)
    date_el = soup.select_one(".BLHeaderDateDisplay")
    if date_el:
        try:
            d = dateparser.parse(date_el.get_text(strip=True), fuzzy=True)
            add_entry(d.strftime("%Y-%m-%d"))
        except (ValueError, TypeError):
            pass
        for a in soup.select(".BLHeaderPrev a, .BLHeaderNext a, .BLHeaderToday a"):
            href = a.get("href") or ""
            m = re.search(r"AuctionDate=(\d{1,2})/(\d{1,2})/(\d{4})", href)
            if m:
                mm, dd, yyyy = m.groups()
                add_entry(f"{yyyy}-{int(mm):02d}-{int(dd):02d}")

    # Strategy 1: explicit auction blocks
    for block in soup.select(".auction-item, .upcoming-auction, .auction-card, .auction-row, .AUCTION_ITEM"):
        date_el = block.select_one(".auction-date, .date, time, .auction-day, .BLHeaderDateDisplay")
        count_el = block.select_one(".item-count, .auction-count, .parcel-count, .count, .ASTAT_MSGB")
        if not date_el:
            continue
        try:
            d = dateparser.parse(date_el.get_text(strip=True), fuzzy=True)
        except (ValueError, TypeError):
            continue
        count = None
        if count_el:
            m = re.search(r"\d+", count_el.get_text())
            if m:
                count = int(m.group(0))
        add_entry(d.strftime("%Y-%m-%d"), count=count)

    # Strategy 2: text-based fallback for sites with simpler markup
    if not by_date:
        for el in soup.find_all(string=REALAUCTION_DATE_PATTERN):
            try:
                d = dateparser.parse(REALAUCTION_DATE_PATTERN.search(el).group(0))
            except (ValueError, TypeError):
                continue
            add_entry(d.strftime("%Y-%m-%d"))

    # Strategy 3: inlined JSON / auctionDates blobs (calendar widget)
    if not by_date:
        for script in soup.find_all("script"):
            text = script.string or ""
            # Structured objects with date + count
            for m in re.finditer(
                r'\{\s*["\']?(?:date|AuctionDate|auctionDate)["\']?\s*[:=]\s*["\']([^"\']+)["\'].{0,120}?["\']?(?:count|Count|items|Items|parcels)["\']?\s*[:=]\s*(\d+)',
                text,
                re.I | re.S,
            ):
                try:
                    d = dateparser.parse(m.group(1), fuzzy=True)
                    add_entry(d.strftime("%Y-%m-%d"), count=int(m.group(2)))
                except (ValueError, TypeError):
                    continue
            for m in re.finditer(r'"(\d{4}-\d{2}-\d{2})"', text):
                add_entry(m.group(1))

    # Strategy 4: count hints near a known date on PREVIEW pages
    page_text = soup.get_text(" ", strip=True)
    for iso, entry in list(by_date.items()):
        if entry.get("count") is not None:
            continue
        # "N Items" / "N Parcels" anywhere on a single-day preview page
        m = re.search(r"(\d+)\s+(?:Items?|Parcels?|Properties)\b", page_text, re.I)
        if m and len(by_date) == 1:
            entry["count"] = int(m.group(1))

    out = sorted(by_date.values(), key=lambda x: x["date"])
    if not out:
        raise NoDataError("No upcoming-auction dates found in RealAuction page")
    return out


# ----------------------------------------------------------------------------
# LienHub
# ----------------------------------------------------------------------------
def parse_lienhub(html: str):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for row in soup.select("table.calendar tr, .auction-row, .sale-item"):
        date_text = row.get_text(" ", strip=True)
        m = REALAUCTION_DATE_PATTERN.search(date_text) or re.search(r"\d{1,2}/\d{1,2}/\d{4}", date_text)
        if not m:
            continue
        try:
            d = dateparser.parse(m.group(0))
        except (ValueError, TypeError):
            continue
        if d.date() < datetime.now().date():
            continue
        iso = d.strftime("%Y-%m-%d")
        if not any(x["date"] == iso for x in out):
            out.append({"date": iso})
    if not out:
        raise NoDataError("No upcoming sales found in LienHub page")
    out.sort(key=lambda x: x["date"])
    return out


# ----------------------------------------------------------------------------
# DeedAuction (broward.deedauction.net and similar)
# ----------------------------------------------------------------------------
def parse_deedauction(html: str):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for block in soup.select(".auction, .auction-block, .upcoming"):
        date_el = block.find(string=REALAUCTION_DATE_PATTERN)
        if not date_el:
            continue
        try:
            d = dateparser.parse(REALAUCTION_DATE_PATTERN.search(date_el).group(0))
        except (ValueError, TypeError):
            continue
        if d.date() < datetime.now().date():
            continue
        iso = d.strftime("%Y-%m-%d")
        count_el = block.select_one(".count, .item-count")
        entry = {"date": iso}
        if count_el:
            m = re.search(r"\d+", count_el.get_text())
            if m:
                entry["count"] = int(m.group(0))
        if not any(x["date"] == iso for x in out):
            out.append(entry)
    if not out:
        raise NoDataError("No upcoming sales found in DeedAuction page")
    out.sort(key=lambda x: x["date"])
    return out


PARSERS = {
    "realauction": parse_realauction,
    "lienhub":     parse_lienhub,
    "deedauction": parse_deedauction,
}
