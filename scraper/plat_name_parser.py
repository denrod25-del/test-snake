"""
Parse subdivision / plat names from OCR text lines on PBC plat PDFs.

Plat sheets are scanned images; OCR output is noisy. Heuristics target:
  - Jurisdiction lines (VILLAGE/CITY/TOWN OF …, PALM BEACH COUNTY)
  - REPLAT OF / PLAT OF phrases
  - Quoted development names
  - Early title-block ALL CAPS names (e.g. PELICAN + SQUARE on consecutive lines)
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Lines that look like labels, bearings, coordinates, or boilerplate — not names.
SKIP_LINE_RE = re.compile(
    r"^(?:"
    r"PAGE\s+\d+|SHEET\s+\d+|"
    r"N\d|N\s*\d|E\s*\d|S\s*\d|W\s*\d|"
    r"\d{2,}\s*['\"]|"
    r"FOUND\s|CERTIFIED|MONUMENT|EASEMENT|DEDICATION|"
    r"SURVEYOR|ENGINEER|TELEPHONE|FAX|E-?MAIL|WWW\.|HTTP|"
    r"P\.?B\.?\s*\d|PLAT\s+BOOK|"
    r"NOT\s+TO\s+SCALE|VICINITY|KEY\s+MAP|"
    r"SECTION\s*\d|TOWNSHIP|RANGE\s+\d|"
    r"THIS\s+INSTRUMENT|PREPARED\s+BY|"
    r"^\d+$|"
    r"^[A-Z0-9]{6,}$"  # plat control numbers
    r")",
    re.I,
)

JURISDICTION_RE = re.compile(
    r"^(?:VILLAGE|CITY|TOWN)\s+OF\s+(.+?),\s*PALM\s+BEACH\s+COUNTY",
    re.I,
)

REPLAT_RE = re.compile(
    r"(?:BEING\s+)?(?:A\s+)?REPLAT\s+OF\s+(?:A\s+(?:PORTION\s+OF\s+)?)?(.+?)(?:\.|,|$|AS\s+RECORDED|IN\s+PLAT)",
    re.I,
)

PLAT_OF_RE = re.compile(
    r"(?:THE\s+)?PLAT\s+OF\s+(.+?)(?:\.|,|$|AS\s+RECORDED|IN\s+PLAT|PUBLIC)",
    re.I,
)

QUOTED_RE = re.compile(r"""['"]([^'"]{3,60})['"]|['']([^'']{3,60})['']""")

PUD_NAME_RE = re.compile(
    r"^([A-Z0-9][A-Z0-9\s\-]{2,40}\bPUD\b(?:\s+[A-Z0-9\-]+)?)\s*$",
    re.I,
)

SUBDIVISION_LINE_RE = re.compile(
    r"(?:PLAT\s+NO\.?\s*\d+\s+)?(.{5,80}\bSUBDIVISION\b.{0,40})$",
    re.I,
)

MONTH_YEAR_RE = re.compile(
    r"^(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{4}$",
    re.I,
)

GARBAGE_TITLE_RE = re.compile(
    r"\b(?:BOARD|DIRECTORS|SURVEYOR|ENGINEER|AFFIXED|AUTHORIZATION|MONUMENT|EASEMENT|"
    r"PROPERTY|DETAIL|CORNER|SCALE|CERTIFICATE|PREPARED|INSTRUMENT|TELEPHONE|FAX)\b",
    re.I,
)

BOILERPLATE_WORDS = {
    "PALM", "BEACH", "COUNTY", "FLORIDA", "PUBLIC", "RECORDS", "SECTION",
    "TOWNSHIP", "RANGE", "EAST", "WEST", "NORTH", "SOUTH", "LOT", "BLOCK",
    "ROAD", "DRIVE", "STREET", "AVENUE", "HIGHWAY", "COURT", "LANE", "WAY",
    "PROJECT", "LOCATION", "U.S.", "CANAL", "INLET", "LINE", "MARTIN",
    "RECORDED", "BOOK", "PAGE", "PAGES", "THROUGH", "SHOWN", "BEING",
    "PLAT", "REPLAT", "PORTION", "HALF", "QUARTER", "CORNER", "DETAIL",
    "SCALE", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST",
    "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER", "JANUARY", "CERTIFICATE",
    "AUTHORIZATION", "NUMBER", "COMPANY", "LIMITED", "LIABILITY", "LLC",
    "INC", "CORP", "SURVEY", "ENGINEERING", "PREPARED", "INSTRUMENT",
}


@dataclass
class ParsedName:
    name: str
    source: str
    confidence: str  # high | medium | low

    def as_dict(self) -> dict:
        return {"name": self.name, "source": self.source, "confidence": self.confidence}


def _clean(raw: str) -> str:
    s = re.sub(r"\s+", " ", raw.upper().strip())
    s = s.replace(".", " ").replace("|", " ").replace("�", "")
    s = re.sub(r"\s+", " ", s).strip(" ,.;:-")
    return s


def _is_boilerplate_line(line: str) -> bool:
    if not line or len(line) < 3:
        return True
    if SKIP_LINE_RE.search(line):
        return True
    alpha = re.sub(r"[^A-Z]", "", line.upper())
    if len(alpha) < 3:
        return True
    words = line.upper().split()
    if len(words) == 1 and words[0] in BOILERPLATE_WORDS:
        return True
    if all(w in BOILERPLATE_WORDS for w in words if len(w) <= 4):
        return True
    return False


def _merge_consecutive_caps(lines: list[str], start: int, max_join: int = 4) -> str | None:
    parts: list[str] = []
    for i in range(start, min(start + max_join, len(lines))):
        ln = _clean(lines[i])
        if not ln or _is_boilerplate_line(ln):
            break
        if not re.match(r"^[A-Z0-9][A-Z0-9\s'\-&\.]{1,40}$", ln):
            break
        if len(ln.split()) > 6:
            break
        parts.append(ln)
    if not parts:
        return None
    merged = _clean(" ".join(parts))
    if len(merged) < 4 or merged in BOILERPLATE_WORDS:
        return None
    word_count = len(merged.split())
    if word_count == 1 and merged in BOILERPLATE_WORDS:
        return None
    return merged


def _is_valid_name(name: str) -> bool:
    if not name or len(name) < 4:
        return False
    if MONTH_YEAR_RE.match(name):
        return False
    if GARBAGE_TITLE_RE.search(name):
        return False
    if name.startswith("THE PLAT "):
        return False
    if re.search(r"\bCONTROL\s+S[\-\s]?\d", name, re.I):
        return False
    if re.search(r"\bSECT(?:ION|ON)\s+\d", name, re.I):
        return False
    if re.search(r"\bLOT\s+\d|\bBLOCK\s+\d", name) and "SUBDIVISION" not in name:
        return False
    # Survey dimensions / bearings mis-read as quoted text.
    if re.search(r"\d\s*['\"]|['\"]\s*\d|\d+\.\d+\s*['\"]", name):
        return False
    if re.search(r"^\d|^\W+\d", name):
        return False
    letters = re.findall(r"[A-Z]", name)
    if len(letters) < 4:
        return False
    words = name.split()
    if len(words) == 1 and words[0] in BOILERPLATE_WORDS:
        return False
    if len(words) == 1 and len(words[0]) <= 3:
        return False
    return True


def _add(found: dict[str, ParsedName], item: ParsedName) -> None:
    key = item.name.upper()
    if not _is_valid_name(key):
        return
    if key in BOILERPLATE_WORDS:
        return
    existing = found.get(key)
    rank = {"high": 3, "medium": 2, "low": 1}
    if existing is None or rank[item.confidence] > rank[existing.confidence]:
        found[key] = item


def parse_subdivision_names(lines: list[str]) -> list[dict]:
    """Return deduplicated name dicts sorted by confidence then name."""
    found: dict[str, ParsedName] = {}
    joined = " ".join(_clean(ln) for ln in lines if ln)

    for ln in lines:
        clean = _clean(ln)
        if not clean:
            continue

        m = JURISDICTION_RE.search(clean)
        if m:
            place = _clean(f"{m.group(0).split(',')[0]}")
            _add(found, ParsedName(place, "jurisdiction", "high"))

        for m in REPLAT_RE.finditer(clean):
            name = _clean(m.group(1))
            name = re.sub(r"\s+AS\s+RECORDED.*$", "", name, flags=re.I)
            name = re.sub(r"^THE\s+PLAT\s+", "", name)
            if _is_valid_name(name):
                _add(found, ParsedName(name, "replat_of", "high"))

        for m in PLAT_OF_RE.finditer(clean):
            name = _clean(m.group(1))
            if len(name) >= 4 and "SHOWN ON" not in name:
                _add(found, ParsedName(name, "plat_of", "medium"))

        for m in QUOTED_RE.finditer(ln):
            raw = m.group(1) or m.group(2)
            if not raw:
                continue
            name = _clean(raw)
            if len(name) >= 6 and _is_valid_name(name):
                _add(found, ParsedName(name, "quoted", "high"))

        m = PUD_NAME_RE.match(clean)
        if m:
            _add(found, ParsedName(_clean(m.group(1)), "pud", "high"))

        m = SUBDIVISION_LINE_RE.search(clean)
        if m:
            name = _clean(m.group(1))
            if len(name) >= 8:
                _add(found, ParsedName(name, "subdivision_line", "medium"))

    # Title block: first ~25 lines, merge consecutive ALL CAPS fragments.
    scan_limit = min(30, len(lines))
    i = 0
    while i < scan_limit:
        merged = _merge_consecutive_caps(lines, i)
        if merged:
            words = merged.split()
            if (
                1 <= len(words) <= 5
                and not all(w in BOILERPLATE_WORDS for w in words)
                and _is_valid_name(merged)
            ):
                _add(found, ParsedName(merged, "title_block", "medium"))
            i += max(1, len(merged.split()) // 2)
        else:
            i += 1

    # Whole-text jurisdiction fallback (OCR may split across lines).
    for m in re.finditer(
        r"(VILLAGE|CITY|TOWN)\s+OF\s+([A-Z][A-Z\s'\-]{4,30})(?:,\s*PALM\s+BEACH\s+COUNTY)",
        joined,
        re.I,
    ):
        place = _clean(f"{m.group(1)} OF {m.group(2)}")
        if _is_valid_name(place):
            _add(found, ParsedName(place, "jurisdiction_joined", "high"))

    rank = {"high": 0, "medium": 1, "low": 2}
    items = sorted(found.values(), key=lambda x: (rank[x.confidence], x.name))
    return [x.as_dict() for x in items]


def pick_primary_name(names: list[dict]) -> str | None:
    if not names:
        return None
    priority = ("pud", "quoted", "subdivision_line", "title_block", "replat_of", "plat_of")
    for source in priority:
        for n in names:
            if n["source"] == source:
                return n["name"]
    for n in names:
        if n["source"] not in ("jurisdiction", "jurisdiction_joined"):
            return n["name"]
    return names[0]["name"]
