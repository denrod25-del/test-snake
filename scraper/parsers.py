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

    # Strategy 1: explicit auction blocks
    for block in soup.select(".auction-item, .upcoming-auction, .auction-card, .auction-row"):
        date_el  = block.select_one(".auction-date, .date, time, .auction-day")
        count_el = block.select_one(".item-count, .auction-count, .parcel-count, .count")
        if not date_el:
            continue
        try:
            d = dateparser.parse(date_el.get_text(strip=True), fuzzy=True)
        except (ValueError, TypeError):
            continue
        if d.date() < datetime.now().date():
            continue
        entry = {"date": d.strftime("%Y-%m-%d")}
        if count_el:
            m = re.search(r"\d+", count_el.get_text())
            if m:
                entry["count"] = int(m.group(0))
        out.append(entry)

    # Strategy 2: text-based fallback for sites with simpler markup
    if not out:
        for el in soup.find_all(string=REALAUCTION_DATE_PATTERN):
            try:
                d = dateparser.parse(REALAUCTION_DATE_PATTERN.search(el).group(0))
            except (ValueError, TypeError):
                continue
            if d.date() < datetime.now().date():
                continue
            iso = d.strftime("%Y-%m-%d")
            if not any(x["date"] == iso for x in out):
                out.append({"date": iso})

    # Strategy 3: inlined JSON blob (the auction calendar widget)
    if not out:
        for script in soup.find_all("script"):
            text = script.string or ""
            for m in re.finditer(r'"(\d{4}-\d{2}-\d{2})"', text):
                iso = m.group(1)
                try:
                    if datetime.strptime(iso, "%Y-%m-%d").date() < datetime.now().date():
                        continue
                except ValueError:
                    continue
                if not any(x["date"] == iso for x in out):
                    out.append({"date": iso})

    if not out:
        raise NoDataError("No upcoming-auction dates found in RealAuction page")

    out.sort(key=lambda x: x["date"])
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
