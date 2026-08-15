"""Consumer Confidence Report ingestion.

Every community water system must publish an annual CCR. They are the only
public source for a lot of what people actually want to know — the hardness
number, the specific THM level at their end of the distribution system, the
utility's own PFAS testing done outside UCMR — and they are published as PDFs
and web pages built by hand, in no fixed layout.

This module splits that problem in two:

* `parse_measurement` and `row_to_result` are **pure functions** over already
  extracted table cells. They hold all the interesting logic (non-detects,
  ranges, censoring, unit attachment) and are fully unit-testable with no PDF,
  no network, and no optional dependency.
* `extract_tables_from_pdf` / `extract_tables_from_html` are thin, replaceable
  adapters that turn a document into rows of strings.

The parser refuses to guess. A cell it cannot interpret produces a
`ParseIssue`, and the surrounding `CCRDocument` reports `unmapped_analytes`, so
a layout this code has not seen shows up as a visible gap rather than as
missing rows.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Iterable, Sequence

from .. import analytes as analyte_registry
from .. import units
from ..schema import Censoring, Provenance, Result, Source

log = logging.getLogger(__name__)

#: Strings a CCR uses to mean "we looked and found nothing above the reporting
#: limit". Compared against `_token(cell)`, so entries here are written in the
#: space-normalized form: "N/D", "n.d.", and "ND" all arrive as "n d" or "nd".
NON_DETECT_TOKENS: frozenset[str] = frozenset({
    "nd", "n d", "non detect", "nondetect", "non detected", "not detected",
    "none detected", "bdl", "below detection limit", "below reporting limit",
    "u", "nd u", "mrl", "less than mrl",
})

#: Strings meaning "not applicable / not measured", which is NOT a non-detect.
#: Also space-normalized: "N/A" arrives as "n a", "--" as the empty string.
NOT_MEASURED_TOKENS: frozenset[str] = frozenset({
    "na", "n a", "not applicable", "not monitored", "not sampled", "no data",
    "", "n r", "nr", "tbd", "not required",
})

_NUM = r"[-+]?\d[\d,]*\.?\d*(?:[eE][-+]?\d+)?"
_RANGE_RE = re.compile(rf"({_NUM})\s*(?:-|–|—|to)\s*({_NUM})")
_PAREN_RANGE_RE = re.compile(rf"({_NUM})\s*\(\s*({_NUM})\s*(?:-|–|—|to)\s*({_NUM})\s*\)")
_CENSORED_RE = re.compile(rf"([<>≤≥])\s*({_NUM})")
_BARE_NUM_RE = re.compile(rf"^\s*({_NUM})\s*$")


@dataclass
class ParseIssue:
    """Something the parser could not interpret, kept for reporting."""

    kind: str
    detail: str
    raw: str

    def to_dict(self) -> dict[str, str]:
        return {"kind": self.kind, "detail": self.detail, "raw": self.raw}


@dataclass
class ParsedValue:
    """The outcome of reading one measurement cell."""

    #: Representative value. For a range this is the average when no explicit
    #: average was given, otherwise the stated average.
    value: float | None
    detected: bool
    censoring: Censoring = Censoring.NONE
    range_low: float | None = None
    range_high: float | None = None
    #: True when the cell said "not measured" rather than "not detected".
    not_measured: bool = False
    raw: str = ""

    @property
    def is_usable(self) -> bool:
        return self.value is not None or self.detected or self.censoring is not Censoring.NONE


def _clean(cell: str | None) -> str:
    return re.sub(r"\s+", " ", str(cell or "")).strip()


def _to_float(token: str) -> float | None:
    try:
        return float(token.replace(",", ""))
    except (TypeError, ValueError):
        return None


def _token(cell: str) -> str:
    """Reduce a cell to a comparison token for the non-detect vocabularies.

    Collapses every run of non-alphanumeric characters to a single space, so
    "N/A", "N.A.", and "n / a" all become "n a", and "--" becomes "". Cells
    containing digits fall through these sets and reach the numeric parsers.
    """
    return re.sub(r"[^a-z0-9]+", " ", str(cell).casefold()).strip()


def parse_measurement(cell: str | None) -> ParsedValue:
    """Interpret one CCR measurement cell.

    Handles, in order of specificity:

    ``2.1 (1.0-3.5)``  an average with a range in parentheses
    ``1.0 - 3.5``      a bare range; the midpoint becomes the value
    ``< 0.5`` / ``ND`` a non-detect, with the reporting limit kept if given
    ``0.0062``         a plain measured value
    ``NA``             not measured at all — distinct from a non-detect

    The distinction that matters most: a non-detect returns
    `detected=False` with `censoring=BELOW`, while "not measured" returns
    `not_measured=True`. Collapsing those two into "0" is the single most
    common way this kind of data gets misrepresented.
    """
    raw = _clean(cell)
    token = _token(raw)

    if token in NOT_MEASURED_TOKENS:
        return ParsedValue(value=None, detected=False, not_measured=True, raw=raw)
    if token in NON_DETECT_TOKENS:
        return ParsedValue(
            value=None, detected=False, censoring=Censoring.BELOW, raw=raw
        )

    m = _PAREN_RANGE_RE.search(raw)
    if m:
        avg, lo, hi = (_to_float(g) for g in m.groups())
        return ParsedValue(
            value=avg, detected=True, range_low=lo, range_high=hi, raw=raw
        )

    m = _CENSORED_RE.search(raw)
    if m and not _RANGE_RE.search(raw):
        symbol, num = m.group(1), _to_float(m.group(2))
        below = symbol in "<≤"
        return ParsedValue(
            value=None if below else num,
            detected=not below,
            censoring=Censoring.BELOW if below else Censoring.ABOVE,
            range_low=num if below else None,
            raw=raw,
        )

    m = _RANGE_RE.search(raw)
    if m:
        lo, hi = _to_float(m.group(1)), _to_float(m.group(2))
        midpoint = None if lo is None or hi is None else (lo + hi) / 2
        return ParsedValue(
            value=midpoint, detected=True, range_low=lo, range_high=hi, raw=raw
        )

    m = _BARE_NUM_RE.match(raw)
    if m:
        value = _to_float(m.group(1))
        # A reported 0 in a CCR means "not detected", not "exactly zero".
        if value == 0:
            return ParsedValue(
                value=None, detected=False, censoring=Censoring.BELOW, raw=raw
            )
        return ParsedValue(value=value, detected=value is not None, raw=raw)

    # A trailing unit on the number ("0.5 ppb") is common in narrative rows.
    m = re.match(rf"^\s*({_NUM})\s+(\S+)\s*$", raw)
    if m and units.is_known_unit(m.group(2)):
        value = _to_float(m.group(1))
        return ParsedValue(value=value, detected=bool(value), raw=raw)

    return ParsedValue(value=None, detected=False, raw=raw)


@dataclass
class CCRRow:
    """One already-extracted CCR table row, before interpretation."""

    contaminant: str
    detected: str | None = None
    unit: str | None = None
    range_text: str | None = None
    mcl: str | None = None
    mclg: str | None = None
    year: int | None = None
    violation: str | None = None
    sampling_point: str | None = None


def row_to_result(
    row: CCRRow,
    pwsid: str,
    provenance: Provenance,
    *,
    issues: list[ParseIssue] | None = None,
) -> Result | None:
    """Turn one CCR row into a canonical `Result`, or `None` if unusable.

    Unit handling: a CCR row's unit column governs, and the value is converted
    into the analyte's canonical display unit. When the row carries no unit, the
    analyte's display unit is assumed and the assumption is recorded in the
    provenance note — never silently.
    """
    issues = issues if issues is not None else []
    analyte = analyte_registry.resolve(name=row.contaminant)
    if analyte is None:
        issues.append(
            ParseIssue("unmapped_analyte", "no analyte matches this name", row.contaminant)
        )
        return None

    parsed = parse_measurement(row.detected)
    if parsed.not_measured:
        return None
    if not parsed.is_usable and not parsed.detected:
        # Some layouts put the value only in the range column.
        parsed = parse_measurement(row.range_text)
        if parsed.not_measured or not parsed.is_usable:
            issues.append(
                ParseIssue("unparsed_value", "no readable value", _clean(row.detected))
            )
            return None
    elif parsed.range_low is None and row.range_text:
        # The common "Level Detected | Range" layout splits the average and the
        # spread across two columns. The average alone parses fine, so without
        # this the range would be silently discarded — and for disinfection
        # byproducts the high end of the range is often the number that matters,
        # since compliance is assessed per location.
        span = parse_measurement(row.range_text)
        if span.range_low is not None and span.range_high is not None:
            parsed = ParsedValue(
                value=parsed.value,
                detected=parsed.detected,
                censoring=parsed.censoring,
                range_low=span.range_low,
                range_high=span.range_high,
                raw=f"{parsed.raw} (range: {span.raw})",
            )

    assumed_unit = False
    reported_unit = _clean(row.unit) or None
    if reported_unit and units.is_known_unit(reported_unit):
        source_unit = units.canonical_unit_for(reported_unit)
    else:
        if reported_unit:
            issues.append(
                ParseIssue("unknown_unit", "unit not in registry", reported_unit)
            )
            return None
        source_unit = analyte.display_unit
        assumed_unit = True

    def _convert(v: float | None) -> float | None:
        if v is None:
            return None
        try:
            return units.convert(v, source_unit, analyte.display_unit)
        except (units.ConversionError, units.UnknownUnitError) as exc:
            issues.append(ParseIssue("unit_mismatch", str(exc), source_unit))
            return None

    value = _convert(parsed.value)
    if parsed.value is not None and value is None:
        return None

    note_parts: list[str] = []
    if assumed_unit:
        note_parts.append(
            f"CCR row carried no unit; assumed the analyte's standard reporting "
            f"unit ({analyte.display_unit})"
        )
    if parsed.range_low is not None and parsed.range_high is not None:
        lo, hi = _convert(parsed.range_low), _convert(parsed.range_high)
        if lo is not None and hi is not None:
            note_parts.append(
                f"reported range {units.format_quantity(lo, analyte.display_unit)} "
                f"to {units.format_quantity(hi, analyte.display_unit)}"
            )
    if provenance.note:
        note_parts.insert(0, provenance.note)

    enriched = Provenance(
        source=provenance.source,
        retrieved_at=provenance.retrieved_at,
        source_url=provenance.source_url,
        source_row_id=provenance.source_row_id,
        note="; ".join(note_parts) or None,
    )

    sample_date: date | None = None
    if row.year:
        # CCRs report by monitoring year, not by sample date. Anchoring to
        # Dec 31 keeps ordering correct without implying a precise sample day.
        sample_date = date(int(row.year), 12, 31)

    detection_limit = None
    if parsed.censoring is Censoring.BELOW and parsed.range_low is not None:
        detection_limit = _convert(parsed.range_low)

    return Result(
        pwsid=pwsid,
        analyte_id=analyte.id,
        provenance=enriched,
        value=value,
        unit=analyte.display_unit,
        detected=parsed.detected,
        censoring=parsed.censoring,
        detection_limit=detection_limit,
        sample_date=sample_date,
        reported_value=parsed.value,
        reported_unit=reported_unit,
        sampling_point=_clean(row.sampling_point) or None,
    )


# --- header mapping ---------------------------------------------------------

#: Column-header keywords -> `CCRRow` field. Ordered longest-first at match time
#: so "detected level" wins over "level".
HEADER_PATTERNS: tuple[tuple[str, str], ...] = (
    ("contaminant", "contaminant"),
    ("parameter", "contaminant"),
    ("substance", "contaminant"),
    ("analyte", "contaminant"),
    ("detected level", "detected"),
    ("level detected", "detected"),
    ("highest level detected", "detected"),
    ("average", "detected"),
    ("result", "detected"),
    ("your water", "detected"),
    ("amount detected", "detected"),
    ("range", "range_text"),
    ("unit", "unit"),
    ("units", "unit"),
    ("measurement", "unit"),
    ("mclg", "mclg"),
    ("mcl", "mcl"),
    ("violation", "violation"),
    ("year", "year"),
    ("date", "year"),
    ("sample point", "sampling_point"),
    ("sampling point", "sampling_point"),
    ("location", "sampling_point"),
)


def map_headers(headers: Sequence[str]) -> dict[int, str]:
    """Map column indices to `CCRRow` fields from a header row."""
    mapping: dict[int, str] = {}
    ordered = sorted(HEADER_PATTERNS, key=lambda p: len(p[0]), reverse=True)
    for idx, header in enumerate(headers):
        text = _clean(header).casefold()
        if not text:
            continue
        for needle, field_name in ordered:
            if needle in text:
                mapping.setdefault(idx, field_name)
                break
    return mapping


def rows_from_table(
    table: Sequence[Sequence[str]], *, default_year: int | None = None
) -> list[CCRRow]:
    """Turn a raw table (first row = header) into `CCRRow`s."""
    if not table:
        return []
    mapping = map_headers(table[0])
    if "contaminant" not in mapping.values():
        return []
    out: list[CCRRow] = []
    for raw_row in table[1:]:
        fields: dict[str, Any] = {}
        for idx, value in enumerate(raw_row):
            field_name = mapping.get(idx)
            if field_name and not fields.get(field_name):
                fields[field_name] = _clean(value)
        name = fields.get("contaminant")
        if not name:
            continue
        year_text = fields.pop("year", None)
        year = default_year
        if year_text:
            m = re.search(r"(19|20)\d{2}", str(year_text))
            if m:
                year = int(m.group(0))
        out.append(CCRRow(year=year, **fields))
    return out


# --- document adapters ------------------------------------------------------


def extract_tables_from_pdf(data: bytes) -> list[list[list[str]]]:
    """Extract tables from a CCR PDF using PyMuPDF.

    PyMuPDF is an optional dependency; a missing install degrades CCR parsing
    to "document registered but not parsed" rather than failing the ingest.
    """
    try:
        import fitz  # type: ignore[import-untyped]
    except ImportError:
        log.warning("PyMuPDF not installed; CCR PDFs will be registered but not parsed")
        return []

    tables: list[list[list[str]]] = []
    with fitz.open(stream=data, filetype="pdf") as doc:
        for page in doc:
            try:
                found = page.find_tables()
            except Exception as exc:  # noqa: BLE001 - malformed PDFs are common
                log.debug("table extraction failed on a page: %s", exc)
                continue
            for table in found:
                extracted = [
                    [_clean(cell) for cell in row] for row in table.extract() if any(row)
                ]
                if len(extracted) >= 2:
                    tables.append(extracted)
    return tables


def extract_tables_from_html(html: str) -> list[list[list[str]]]:
    """Extract `<table>` contents from an HTML CCR."""
    try:
        from bs4 import BeautifulSoup  # type: ignore[import-untyped]
    except ImportError:
        log.warning("beautifulsoup4 not installed; HTML CCRs will not be parsed")
        return []

    soup = BeautifulSoup(html, "html.parser")
    tables: list[list[list[str]]] = []
    for table in soup.find_all("table"):
        rows: list[list[str]] = []
        for tr in table.find_all("tr"):
            cells = [_clean(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
            if any(cells):
                rows.append(cells)
        if len(rows) >= 2:
            tables.append(rows)
    return tables


def parse_document(
    content: bytes,
    *,
    pwsid: str,
    provenance: Provenance,
    content_type: str = "pdf",
    default_year: int | None = None,
) -> tuple[list[Result], list[ParseIssue]]:
    """Parse a whole CCR document into results plus a list of what went wrong."""
    if content_type == "html":
        tables = extract_tables_from_html(content.decode("utf-8", errors="replace"))
    else:
        tables = extract_tables_from_pdf(content)

    results: list[Result] = []
    issues: list[ParseIssue] = []
    for table in tables:
        for row in rows_from_table(table, default_year=default_year):
            result = row_to_result(row, pwsid, provenance, issues=issues)
            if result is not None:
                results.append(result)
    return results, issues
