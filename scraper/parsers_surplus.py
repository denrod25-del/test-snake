"""
parsers_surplus.py
------------------
HTML parsers for county Clerk surplus-funds pages.

Each parser takes raw HTML and the source URL, and returns a list of dicts
with this shape:

    {
        "sale_date":      "YYYY-MM-DD" or None,
        "parcel_id":      "..." or None,
        "property_addr":  "..." or None,
        "prior_owner":    "..." or None,
        "surplus_amount": float or None,
        "status":         "unclaimed" | "claim_filed" | "paid" | "escheated",
        "claim_deadline": "YYYY-MM-DD" or None,
        "source_url":     str
    }

Surplus pages vary wildly across the 67 counties. The parsers here cover the
most common platforms; counties with PDF-only or unique formats fall back to
`manual_surplus.json`.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from bs4 import BeautifulSoup
from dateutil import parser as dateparser


class NoDataError(Exception):
    """Raised when a parser ran but found no records on the page."""


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
_MONEY_RE = re.compile(r"\$?\s*([\d,]+(?:\.\d{1,2})?)")
_DATE_RE  = re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b")
_TEMPLATE_RE = re.compile(r"\{\{|\}\}|getFeeCodeData", re.I)

_STATUS_KEYWORDS = {
    "claim_filed": ("claim filed", "claim received", "pending"),
    "paid":        ("paid", "disbursed", "released"),
    "escheated":   ("escheated", "forfeited"),
}


def _parse_money(text: str) -> Optional[float]:
    if not text:
        return None
    m = _MONEY_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _parse_date(text: str) -> Optional[str]:
    if not text:
        return None
    m = _DATE_RE.search(text)
    if not m:
        return None
    try:
        return dateparser.parse(m.group(1)).date().isoformat()
    except (ValueError, OverflowError):
        return None


def _detect_status(row_text: str) -> str:
    txt = row_text.lower()
    for status, keywords in _STATUS_KEYWORDS.items():
        if any(kw in txt for kw in keywords):
            return status
    return "unclaimed"


def _claim_deadline_from_sale(sale_iso: Optional[str]) -> Optional[str]:
    """Per FS 197.582, surplus claims must be made within 120 days of sale."""
    if not sale_iso:
        return None
    try:
        sale = datetime.strptime(sale_iso, "%Y-%m-%d").date()
        return (sale + timedelta(days=120)).isoformat()
    except ValueError:
        return None


# --------------------------------------------------------------------------
# parsers
# --------------------------------------------------------------------------
def parse_clerk_html_table(html: str, source_url: str) -> List[Dict[str, Any]]:
    """
    Generic parser for Clerk pages that publish surplus as an HTML table.
    Looks at the largest <table> on the page and tries to detect columns
    by header keywords.
    """
    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")
    if not tables:
        raise NoDataError("no <table> elements found")

    table = max(tables, key=lambda t: len(t.find_all("tr")))
    rows = table.find_all("tr")
    if len(rows) < 2:
        raise NoDataError("table has no data rows")

    headers = [_normalize(th.get_text()) for th in rows[0].find_all(["th", "td"])]
    if not headers:
        raise NoDataError("could not read header row")

    col_map = {
        "sale_date":      _find_col(headers, "sale", "date"),
        "parcel_id":      _find_col(headers, "parcel", "folio", "tax id"),
        "property_addr":  _find_col(headers, "property", "address", "situs"),
        "prior_owner":    _find_col(headers, "owner", "name", "prior"),
        "surplus_amount": _find_col(headers, "surplus", "amount", "balance"),
        "status":         _find_col(headers, "status", "claim"),
    }

    out: List[Dict[str, Any]] = []
    for tr in rows[1:]:
        cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
        if len(cells) < 2:
            continue
        row_text = " ".join(cells)
        if _TEMPLATE_RE.search(row_text):
            continue
        sale_iso = _parse_date(_get(cells, col_map["sale_date"]) or row_text)
        amount_col = col_map["surplus_amount"]
        amount = _parse_money(_get(cells, amount_col) if amount_col is not None else None)
        if amount is None and amount_col is None:
            amount = _parse_money(row_text) if "$" in row_text else None

        if amount is None and sale_iso is None:
            continue

        status_val = _detect_status(_get(cells, col_map["status"]) or row_text)

        out.append({
            "sale_date":      sale_iso,
            "parcel_id":      _clean(_get(cells, col_map["parcel_id"])),
            "property_addr":  _clean(_get(cells, col_map["property_addr"])),
            "prior_owner":    _clean(_get(cells, col_map["prior_owner"])),
            "surplus_amount": amount,
            "status":         status_val,
            "claim_deadline": _claim_deadline_from_sale(sale_iso),
            "source_url":     source_url,
        })

    if not out:
        raise NoDataError("table parsed but no usable rows")
    return out


def parse_realauction_surplus(html: str, source_url: str) -> List[Dict[str, Any]]:
    """
    Realauction (realtaxdeed.com) renders surplus through a paginated table
    or a 'Surplus Funds' tab. The structure is reasonably consistent across
    counties — look for rows whose cells contain a sale date and a $ amount.
    """
    soup = BeautifulSoup(html, "lxml")
    out: List[Dict[str, Any]] = []
    for tr in soup.find_all("tr"):
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if len(cells) < 3:
            continue
        line = " | ".join(cells)
        if "$" not in line or _TEMPLATE_RE.search(line):
            continue
        sale_iso = _parse_date(line)
        amount   = _parse_money(line)
        if amount is None:
            continue
        parcel = next((c for c in cells if re.search(r"\d{2,}-\d{2,}", c)), None)
        out.append({
            "sale_date":      sale_iso,
            "parcel_id":      parcel,
            "property_addr":  _longest(cells),
            "prior_owner":    None,
            "surplus_amount": amount,
            "status":         _detect_status(line),
            "claim_deadline": _claim_deadline_from_sale(sale_iso),
            "source_url":     source_url,
        })
    if not out:
        raise NoDataError("no surplus rows found on realauction page")
    return out


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------
def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).lower()


def _find_col(headers: List[str], *needles: str) -> Optional[int]:
    for i, h in enumerate(headers):
        for n in needles:
            if n in h:
                return i
    return None


def _get(cells: List[str], i: Optional[int]) -> Optional[str]:
    if i is None or i >= len(cells):
        return None
    return cells[i]


def _clean(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    return re.sub(r"\s+", " ", s).strip() or None


def _longest(cells: List[str]) -> Optional[str]:
    if not cells:
        return None
    return max(cells, key=len)


PARSERS = {
    "clerk_html_table":     parse_clerk_html_table,
    "realauction_surplus":  parse_realauction_surplus,
}
