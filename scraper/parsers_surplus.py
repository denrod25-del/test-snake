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
_DATE_RE = re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b")
_FEE_NOISE = re.compile(
    r"application fee|sheriff fee|postage|photocopy|advertising fee|"
    r"holiday schedule|contact us|opening\b",
    re.I,
)

_STATUS_KEYWORDS = {
    "claim_filed": ("claim filed", "claim received", "pending"),
    "paid": ("paid", "disbursed", "released"),
    "escheated": ("escheated", "forfeited"),
}

# Reject fee-schedule tables that mention tiny statutory amounts.
_MIN_SURPLUS_AMOUNT = 25.0


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


def _header_looks_like_surplus(headers: List[str]) -> bool:
    joined = " ".join(headers)
    return any(
        token in joined
        for token in ("surplus", "unclaimed", "excess", "overbid", "proceeds")
    )


# --------------------------------------------------------------------------
# parsers
# --------------------------------------------------------------------------
def parse_clerk_html_table(html: str, source_url: str) -> List[Dict[str, Any]]:
    """
    Generic parser for Clerk pages that publish surplus as an HTML table.
    Prefers tables whose headers mention surplus / unclaimed / excess funds.
    """
    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")
    if not tables:
        raise NoDataError("no <table> elements found")

    candidates = []
    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue
        headers = [_normalize(th.get_text()) for th in rows[0].find_all(["th", "td"])]
        if not headers:
            continue
        score = len(rows)
        if _header_looks_like_surplus(headers):
            score += 1000
        candidates.append((score, headers, rows))

    if not candidates:
        raise NoDataError("table has no data rows")

    candidates.sort(key=lambda x: x[0], reverse=True)
    _score, headers, rows = candidates[0]
    if not _header_looks_like_surplus(headers):
        raise NoDataError("largest table is not a surplus list (missing surplus headers)")

    col_map = {
        "sale_date": _find_col(headers, "sale date", "sale", "date"),
        "parcel_id": _find_col(headers, "parcel", "folio", "tax id", "case", "file"),
        "property_addr": _find_col(headers, "property", "address", "situs", "location"),
        "prior_owner": _find_col(headers, "owner", "name", "prior", "defendant"),
        "surplus_amount": _find_col(headers, "surplus", "amount", "balance", "funds", "excess"),
        "status": _find_col(headers, "status", "claim"),
        "claim_deadline": _find_col(headers, "deadline", "1 year", "expire", "claim by"),
    }

    out: List[Dict[str, Any]] = []
    for tr in rows[1:]:
        cells = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
        # Drop empty spacer cells some CMS tables insert
        cells_compact = [c for c in cells if c]
        if len(cells_compact) < 2:
            continue
        row_text = " ".join(cells_compact)
        if _FEE_NOISE.search(row_text) and "surplus" not in row_text.lower():
            continue

        sale_iso = _parse_date(_get(cells, col_map["sale_date"]) or _get(cells_compact, col_map["sale_date"]) or row_text)
        amount = _parse_money(
            _get(cells, col_map["surplus_amount"])
            or _get(cells_compact, col_map["surplus_amount"])
            or row_text
        )

        if amount is None or amount < _MIN_SURPLUS_AMOUNT:
            continue
        if not sale_iso:
            continue

        deadline = _parse_date(_get(cells, col_map["claim_deadline"]) or "")
        if not deadline:
            deadline = _claim_deadline_from_sale(sale_iso)

        parcel = _clean(
            _get(cells, col_map["parcel_id"]) or _get(cells_compact, col_map["parcel_id"])
        )
        owner = _clean(
            _get(cells, col_map["prior_owner"]) or _get(cells_compact, col_map["prior_owner"])
        )
        addr = _clean(
            _get(cells, col_map["property_addr"]) or _get(cells_compact, col_map["property_addr"])
        )
        # Avoid treating owner name as address when columns collapse
        if addr and owner and addr == owner:
            addr = None

        out.append({
            "sale_date": sale_iso,
            "parcel_id": parcel,
            "property_addr": addr,
            "prior_owner": owner,
            "surplus_amount": amount,
            "status": _detect_status(_get(cells, col_map["status"]) or row_text),
            "claim_deadline": deadline,
            "source_url": source_url,
        })

    if not out:
        raise NoDataError("table parsed but no usable surplus rows")
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
        if "$" not in line:
            continue
        if _FEE_NOISE.search(line):
            continue
        sale_iso = _parse_date(line)
        amount = _parse_money(line)
        if amount is None or amount < _MIN_SURPLUS_AMOUNT or not sale_iso:
            continue
        parcel = next((c for c in cells if re.search(r"\d{2,}-\d{2,}", c)), None)
        out.append({
            "sale_date": sale_iso,
            "parcel_id": parcel,
            "property_addr": _longest(cells),
            "prior_owner": None,
            "surplus_amount": amount,
            "status": _detect_status(line),
            "claim_deadline": _claim_deadline_from_sale(sale_iso),
            "source_url": source_url,
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
    # Prefer longer / more specific needles first via exact-ish match order
    for n in needles:
        for i, h in enumerate(headers):
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
    "clerk_html_table": parse_clerk_html_table,
    "realauction_surplus": parse_realauction_surplus,
}
