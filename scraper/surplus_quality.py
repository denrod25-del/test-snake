"""
surplus_quality.py
------------------
Reject scraped surplus rows that look like SPA template junk, fee tables,
or other non-surplus HTML before they reach Supabase.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

# Scraped rows below this are almost always parser noise (fee codes, row numbers).
MIN_SCRAPED_SURPLUS = 500.0
BYPASS_QUALITY = False

_TEMPLATE_RE = re.compile(r"\{\{|\}\}|getFeeCodeData|ng-[a-z-]+", re.I)
_JUNK_PARCEL_RE = re.compile(r"^\d+\.\s*\{\{", re.I)
_LIST_MARKER_RE = re.compile(r"^\d+\.\s+[A-Z{]")


def _text(*parts: Optional[str]) -> str:
    return " ".join(p.strip() for p in parts if p and str(p).strip())


def validate_surplus_record(rec: Dict[str, Any], *, scraped: bool = True) -> Tuple[bool, str]:
    """
    Return (ok, reason). Manual rows use scraped=False and only get light checks.
    """
    if BYPASS_QUALITY:
        amount = rec.get("surplus_amount")
        if amount is None or float(amount) <= 0:
            return False, "zero_amount"
        return True, "ok"

    amount = rec.get("surplus_amount")
    if amount is None:
        return False, "missing_amount"
    try:
        amount_f = float(amount)
    except (TypeError, ValueError):
        return False, "bad_amount"
    if amount_f <= 0:
        return False, "zero_amount"

    blob = _text(
        rec.get("parcel_id"),
        rec.get("property_addr"),
        rec.get("prior_owner"),
        rec.get("sale_date"),
        str(rec.get("surplus_amount")),
    )
    if _TEMPLATE_RE.search(blob):
        return False, "template_tokens"
    if rec.get("parcel_id") and _JUNK_PARCEL_RE.search(str(rec["parcel_id"])):
        return False, "junk_parcel_id"
    if rec.get("parcel_id") and _LIST_MARKER_RE.search(str(rec["parcel_id"])):
        return False, "numbered_list_marker"

    if not scraped:
        return True, "ok"

    if amount_f < MIN_SCRAPED_SURPLUS:
        return False, "amount_below_floor"

    if not rec.get("sale_date"):
        return False, "missing_sale_date"

    identity = _text(rec.get("parcel_id"), rec.get("prior_owner"), rec.get("property_addr"))
    if len(identity) < 3:
        return False, "missing_identity"

    return True, "ok"
