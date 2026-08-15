"""Turn raw upstream rows into canonical records.

This is where the API earns the word "standardized". Each function takes a dict
straight out of a source client and returns a `fwq.schema` record, or `None`
plus an entry in a `NormalizationReport` explaining the drop.

Two rules run through all of it:

**Nothing disappears silently.** Every skipped row lands in the report with a
reason. A quietly shorter output is indistinguishable from clean data, which is
the failure mode that makes an aggregated dataset untrustworthy.

**Upstream field names are treated as unstable.** Envirofacts has renamed
columns and flipped their casing between releases, and UCMR file layouts differ
by cycle. `_pick` looks up several candidate names rather than hard-binding to
one spelling, so a rename degrades one field instead of the whole ingest.
"""
from __future__ import annotations

import logging
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Iterable, Sequence

from . import analytes as analyte_registry
from . import units
from .schema import (
    Censoring,
    Provenance,
    Result,
    ServiceArea,
    Source,
    ValidationError,
    Violation,
    WaterSystem,
    validate_pwsid,
)

log = logging.getLogger(__name__)


# --- reporting --------------------------------------------------------------


@dataclass
class NormalizationReport:
    """What happened during a normalization pass."""

    skipped: Counter = field(default_factory=Counter)
    unmapped_analytes: Counter = field(default_factory=Counter)
    unknown_units: Counter = field(default_factory=Counter)
    warnings: list[str] = field(default_factory=list)
    counts: Counter = field(default_factory=Counter)

    def skip(self, reason: str, detail: str = "") -> None:
        self.skipped[reason] += 1
        if detail and len(self.warnings) < 200:
            self.warnings.append(f"{reason}: {detail}")

    def to_dict(self) -> dict[str, Any]:
        return {
            "counts": dict(self.counts),
            "skipped": dict(self.skipped),
            "unmappedAnalytes": dict(self.unmapped_analytes.most_common(50)),
            "unknownUnits": dict(self.unknown_units.most_common(25)),
            "warnings": self.warnings[:50],
        }

    @property
    def is_clean(self) -> bool:
        return not self.skipped and not self.unmapped_analytes


# --- field access -----------------------------------------------------------


def _pick(row: dict[str, Any], *names: str) -> Any:
    """First non-empty value among several candidate column names.

    Matching is case- and separator-insensitive, so `AnalyticalResultValue`,
    `analytical_result_value`, and `ANALYTICALRESULTVALUE` all resolve.
    """
    if not hasattr(row, "get"):
        return None
    normalized = {re.sub(r"[^a-z0-9]", "", str(k).casefold()): v for k, v in row.items()}
    for name in names:
        key = re.sub(r"[^a-z0-9]", "", name.casefold())
        value = normalized.get(key)
        if value is not None and str(value).strip() != "":
            return value
    return None


def _text(row: dict[str, Any], *names: str) -> str | None:
    value = _pick(row, *names)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _int(row: dict[str, Any], *names: str) -> int | None:
    value = _pick(row, *names)
    if value is None:
        return None
    try:
        return int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return None


def _float(row: dict[str, Any], *names: str) -> float | None:
    value = _pick(row, *names)
    if value is None:
        return None
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _bool_flag(row: dict[str, Any], *names: str) -> bool | None:
    value = _text(row, *names)
    if value is None:
        return None
    head = value.strip().upper()[:1]
    if head in ("Y", "T", "1"):
        return True
    if head in ("N", "F", "0"):
        return False
    return None


_DATE_FORMATS: tuple[str, ...] = (
    "%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%d-%b-%y", "%d-%b-%Y",
    "%Y/%m/%d", "%b %d, %Y", "%Y%m%d",
)


def _date(row: dict[str, Any], *names: str) -> date | None:
    raw = _text(row, *names)
    if not raw:
        return None
    return parse_date(raw)


def parse_date(raw: str) -> date | None:
    """Parse the several date shapes Envirofacts and CCRs emit."""
    text = str(raw).strip()
    if not text or text.upper() in ("NULL", "NONE", "N/A"):
        return None
    if "T" in text and len(text) >= 10:
        text = text.split("T", 1)[0]
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


# --- water systems ----------------------------------------------------------

#: SDWIS one-letter source-water codes.
SOURCE_CODES: dict[str, str] = {
    "GW": "groundwater",
    "SW": "surface water",
    "GU": "groundwater under direct influence of surface water",
    "GWP": "purchased groundwater",
    "SWP": "purchased surface water",
    "GUP": "purchased groundwater under surface influence",
}

SYSTEM_TYPES: dict[str, str] = {
    "CWS": "community",
    "NTNCWS": "non-transient non-community",
    "TNCWS": "transient non-community",
}


def normalize_water_system(
    row: dict[str, Any],
    retrieved_at: datetime,
    *,
    geographic_rows: Sequence[dict[str, Any]] = (),
    report: NormalizationReport | None = None,
) -> WaterSystem | None:
    """Normalize one `sdwis.water_system` row into a `WaterSystem`."""
    report = report or NormalizationReport()
    raw_pwsid = _text(row, "pwsid", "pws_id")
    if not raw_pwsid:
        report.skip("water_system_no_pwsid")
        return None
    try:
        pwsid = validate_pwsid(raw_pwsid)
    except ValidationError as exc:
        report.skip("water_system_bad_pwsid", str(exc))
        return None

    name = _text(row, "pws_name", "pwsname", "name") or pwsid
    activity = (_text(row, "pws_activity_code", "activity_code") or "").upper()
    source_code = (_text(row, "primary_source_code", "primary_source") or "").upper()
    type_code = (_text(row, "pws_type_code", "pws_type") or "").upper()

    service_area = build_service_area(
        [r for r in geographic_rows if _text(r, "pwsid") == pwsid]
    )

    website = _text(row, "website", "url")
    if website and not website.lower().startswith(("http://", "https://")):
        website = f"https://{website}"

    return WaterSystem(
        pwsid=pwsid,
        name=name,
        provenance=Provenance(
            source=Source.SDWIS,
            retrieved_at=retrieved_at,
            source_url="https://data.epa.gov/efservice/sdwis.water_system",
            source_row_id=pwsid,
        ),
        system_type=SYSTEM_TYPES.get(type_code, type_code or None),
        owner_type=_text(row, "owner_type_code", "owner_type"),
        primary_source=SOURCE_CODES.get(source_code, source_code or None),
        population_served=_int(row, "population_served_count", "population_served"),
        service_connections=_int(row, "service_connections_count", "service_connections"),
        is_active=(activity == "A") if activity else None,
        service_area=service_area,
        phone=_text(row, "phone_number", "phone"),
        website=website,
    )


def build_service_area(geographic_rows: Iterable[dict[str, Any]]) -> ServiceArea:
    """Collapse many `geographic_area` rows into one service area.

    SDWIS emits one row per (city, ZIP) pair a system serves, so a mid-sized
    utility can have dozens. ZIPs are truncated to their 5-digit form because
    ZIP+4 in this table is inconsistent and never useful for lookup.
    """
    area = ServiceArea()
    for row in geographic_rows:
        county = _text(row, "county_served", "county")
        city = _text(row, "city_served", "city")
        zip_code = _text(row, "zip_code_served", "zip_code", "zip")
        if county:
            area.counties.append(_titleize(county))
        if city:
            area.cities.append(_titleize(city))
        if zip_code:
            digits = re.sub(r"\D", "", zip_code)[:5]
            if len(digits) == 5:
                area.zips.append(digits)
    return area


def _titleize(value: str) -> str:
    """SDWIS stores place names in caps. Title-case them, keeping `St.`, `Ft.`."""
    cleaned = re.sub(r"\s+", " ", value.strip())
    if not cleaned:
        return cleaned
    return " ".join(
        word if (len(word) <= 3 and word.isupper() and word.endswith(".")) else word.capitalize()
        for word in cleaned.split(" ")
    )


# --- violations -------------------------------------------------------------

#: SDWIS violation category codes -> our canonical categories.
VIOLATION_CATEGORIES: dict[str, str] = {
    "MCL": "MCL",
    "MRDL": "MRDL",
    "TT": "TT",
    "MR": "MR",
    "MON": "MON",
    "RPT": "RPT",
    "MONITORING": "MON",
    "REPORTING": "RPT",
    "OTHER": "OTHER",
}

#: Violation-status strings that mean the system is back in compliance.
RESOLVED_STATUSES: frozenset[str] = frozenset({"resolved", "archived", "returned to compliance"})
OPEN_STATUSES: frozenset[str] = frozenset({"unaddressed", "addressed", "open"})


def normalize_violation(
    row: dict[str, Any],
    retrieved_at: datetime,
    *,
    contaminant_names: dict[str, str] | None = None,
    report: NormalizationReport | None = None,
) -> Violation | None:
    """Normalize one `sdwis.violation` row.

    `contaminant_names` is EPA's own code -> description reference table,
    fetched at ingest time. Codes that resolve to no known analyte keep the
    upstream label in `unmapped_analyte` so the violation still surfaces with a
    name, rather than being dropped for lack of a mapping.
    """
    report = report or NormalizationReport()
    raw_pwsid = _text(row, "pwsid")
    violation_id = _text(row, "violation_id", "violationid", "viol_id")
    if not raw_pwsid or not violation_id:
        report.skip("violation_missing_key")
        return None
    try:
        pwsid = validate_pwsid(raw_pwsid)
    except ValidationError as exc:
        report.skip("violation_bad_pwsid", str(exc))
        return None

    category_raw = (_text(row, "violation_category_code", "viol_category") or "").upper()
    category = VIOLATION_CATEGORIES.get(category_raw, "OTHER" if category_raw else "OTHER")

    code = _text(row, "contaminant_code", "contaminantcode")
    label = None
    if contaminant_names and code:
        label = contaminant_names.get(str(code).lstrip("0") or "0")
    label = label or _text(row, "contaminant_name", "contaminant")

    analyte = analyte_registry.resolve(name=label, code=code)
    unmapped = None
    if analyte is None and (label or code):
        unmapped = label or f"SDWIS contaminant code {code}"
        report.unmapped_analytes[unmapped] += 1

    rtc = _date(row, "calculated_rtc_date", "rtc_date")
    status_text = (_text(row, "violation_status", "compliance_status") or "").casefold()
    if rtc is not None:
        resolved: bool | None = True
    elif status_text in RESOLVED_STATUSES:
        resolved = True
    elif status_text in OPEN_STATUSES:
        resolved = False
    else:
        resolved = None

    tier = _int(row, "public_notification_tier", "pn_tier")
    health_based = _bool_flag(row, "is_health_based_ind", "is_health_based")

    return Violation(
        pwsid=pwsid,
        violation_id=str(violation_id),
        provenance=Provenance(
            source=Source.SDWIS,
            retrieved_at=retrieved_at,
            source_url="https://data.epa.gov/efservice/sdwis.violation",
            source_row_id=str(violation_id),
        ),
        category=category,
        type_label=_text(row, "violation_code_desc", "violation_desc", "violation_code"),
        analyte_id=analyte.id if analyte else None,
        unmapped_analyte=unmapped,
        begin_date=_date(row, "compl_per_begin_date", "begin_date", "non_compl_per_begin_date"),
        end_date=_date(row, "compl_per_end_date", "end_date", "non_compl_per_end_date"),
        resolved=resolved,
        compliance_status=_text(row, "violation_status", "compliance_status"),
        public_notification_tier=tier,
        is_health_based=health_based,
    )


# --- lead and copper --------------------------------------------------------


def normalize_lcr_result(
    row: dict[str, Any],
    retrieved_at: datetime,
    *,
    contaminant_names: dict[str, str] | None = None,
    report: NormalizationReport | None = None,
) -> Result | None:
    """Normalize one `sdwis.lcr_sample_result` row.

    LCR rows are 90th-percentile summaries across a monitoring period, not
    single samples, so `is_percentile_90` is set — comparing one of these to an
    action level means something different from comparing a single tap sample.
    """
    report = report or NormalizationReport()
    raw_pwsid = _text(row, "pwsid")
    if not raw_pwsid:
        report.skip("lcr_no_pwsid")
        return None
    try:
        pwsid = validate_pwsid(raw_pwsid)
    except ValidationError as exc:
        report.skip("lcr_bad_pwsid", str(exc))
        return None

    code = _text(row, "contaminant_code")
    label = (contaminant_names or {}).get(str(code).lstrip("0") or "0") if code else None
    label = label or _text(row, "contaminant_name", "contaminant")
    analyte = analyte_registry.resolve(name=label, code=code)
    if analyte is None:
        report.unmapped_analytes[label or f"code {code}"] += 1
        report.skip("lcr_unmapped_analyte", str(label or code))
        return None

    value = _float(row, "sample_measure", "result_measure", "sar_measure")
    unit_raw = _text(row, "unit_of_measure", "unit")
    if value is None:
        report.skip("lcr_no_value", f"{pwsid}/{analyte.id}")
        return None
    if not unit_raw or not units.is_known_unit(unit_raw):
        report.unknown_units[unit_raw or "(missing)"] += 1
        report.skip("lcr_unknown_unit", f"{pwsid}/{analyte.id}: {unit_raw}")
        return None

    try:
        converted = units.convert(value, unit_raw, analyte.display_unit)
    except (units.ConversionError, units.UnknownUnitError) as exc:
        report.skip("lcr_unit_mismatch", str(exc))
        return None

    sign = (_text(row, "result_sign_code", "sign") or "=").strip()
    below = sign in ("<", "L")
    return Result(
        pwsid=pwsid,
        analyte_id=analyte.id,
        provenance=Provenance(
            source=Source.SDWIS,
            retrieved_at=retrieved_at,
            source_url="https://data.epa.gov/efservice/sdwis.lcr_sample_result",
            source_row_id=_text(row, "sample_id", "sar_id"),
            note="Lead and Copper Rule 90th-percentile summary, not a single sample",
        ),
        value=None if below else converted,
        unit=analyte.display_unit,
        detected=not below,
        censoring=Censoring.BELOW if below else Censoring.NONE,
        detection_limit=converted if below else None,
        sample_date=_date(row, "sampling_end_date", "sampling_start_date", "sample_date"),
        reported_value=value,
        reported_unit=unit_raw,
        is_percentile_90=True,
    )


# --- UCMR 5 (PFAS) ----------------------------------------------------------


def normalize_ucmr5_result(
    row: dict[str, Any],
    retrieved_at: datetime,
    *,
    report: NormalizationReport | None = None,
) -> Result | None:
    """Normalize one UCMR 5 occurrence row.

    UCMR 5 encodes a non-detect as `AnalyticalResultsSign = "<"` with the MRL
    in the value column. Reading that value as a measurement would invent a
    detection at the reporting limit for every clean sample in the dataset —
    so the sign column is honoured before the value column, always.
    """
    report = report or NormalizationReport()
    raw_pwsid = _text(row, "pwsid", "pws_id")
    if not raw_pwsid:
        report.skip("ucmr5_no_pwsid")
        return None
    try:
        pwsid = validate_pwsid(raw_pwsid)
    except ValidationError as exc:
        report.skip("ucmr5_bad_pwsid", str(exc))
        return None

    label = _text(row, "contaminant", "contaminant_name", "analyte")
    if not label:
        report.skip("ucmr5_no_contaminant")
        return None
    analyte = analyte_registry.resolve(name=label)
    if analyte is None:
        report.unmapped_analytes[label] += 1
        report.skip("ucmr5_unmapped_analyte", label)
        return None

    unit_raw = _text(row, "unitofmeasure", "unit_of_measure", "units", "unit") or "ug/L"
    if not units.is_known_unit(unit_raw):
        report.unknown_units[unit_raw] += 1
        report.skip("ucmr5_unknown_unit", f"{label}: {unit_raw}")
        return None

    sign = (_text(row, "analyticalresultssign", "analytical_results_sign", "sign") or "=").strip()
    raw_value = _float(row, "analyticalresultvalue", "analytical_result_value", "result", "value")
    mrl = _float(row, "mrl", "minimum_reporting_level")

    def _to_display(v: float | None) -> float | None:
        if v is None:
            return None
        try:
            return units.convert(v, unit_raw, analyte.display_unit)
        except (units.ConversionError, units.UnknownUnitError) as exc:
            report.skip("ucmr5_unit_mismatch", str(exc))
            return None

    detected = sign not in ("<", "L")
    if detected and raw_value is None:
        report.skip("ucmr5_detect_without_value", f"{pwsid}/{analyte.id}")
        return None

    value = _to_display(raw_value) if detected else None
    if detected and value is None:
        return None

    # For a non-detect UCMR reports the MRL in either the MRL column or the
    # value column; whichever is present is the reporting limit, not a result.
    detection_limit = _to_display(mrl if mrl is not None else raw_value) if not detected else _to_display(mrl)

    return Result(
        pwsid=pwsid,
        analyte_id=analyte.id,
        provenance=Provenance(
            source=Source.UCMR5,
            retrieved_at=retrieved_at,
            source_url="https://www.epa.gov/dwucmr/occurrence-data-unregulated-contaminant-monitoring-rule",
            source_row_id=_text(row, "sampleid", "sample_id"),
        ),
        value=value,
        unit=analyte.display_unit,
        detected=detected,
        censoring=Censoring.NONE if detected else Censoring.BELOW,
        detection_limit=detection_limit,
        sample_date=_date(row, "collectiondate", "collection_date", "sample_date"),
        reported_value=raw_value,
        reported_unit=unit_raw,
        sampling_point=_text(row, "samplepointname", "sample_point_name", "samplepointid"),
    )


# --- aggregation ------------------------------------------------------------


def latest_by_analyte(results: Iterable[Result]) -> dict[str, Result]:
    """Most recent result per analyte, preferring detections over non-detects.

    A detection and a non-detect from the same period are not equivalent
    evidence: reporting "non-detect" as a system's PFOA figure when a detection
    exists in the same monitoring round would understate it. Detections win at
    equal recency; among detections, the highest value wins, matching how
    compliance is assessed.
    """
    best: dict[str, Result] = {}
    for result in results:
        current = best.get(result.analyte_id)
        if current is None or _result_rank(result) > _result_rank(current):
            best[result.analyte_id] = result
    return best


def _result_rank(result: Result) -> tuple[date, int, float]:
    return (
        result.sample_date or date.min,
        1 if result.detected else 0,
        result.value or 0.0,
    )


def pfas_hazard_index(results: Iterable[Result]) -> analyte_registry.HazardIndex:
    """Compute the PFAS Hazard Index from a system's results.

    A non-detect contributes zero (EPA's convention) but still counts as
    measured, so the index is only reported incomplete when an analyte was
    never sampled at all.
    """
    latest = latest_by_analyte(results)
    concentrations: dict[str, float | None] = {}
    for component in analyte_registry.registry().hazard_index_components:
        result = latest.get(component)
        if result is None:
            concentrations[component] = None
        elif not result.detected:
            concentrations[component] = 0.0
        else:
            concentrations[component] = result.value_ng_l()
    return analyte_registry.hazard_index(concentrations)


def summarize_violations(violations: Sequence[Violation]) -> dict[str, Any]:
    """Roll violations up into the counts a consumer-facing view needs."""
    open_violations = [v for v in violations if v.is_open]
    health_based = [v for v in violations if v.is_health_based]
    by_category: Counter = Counter(v.category for v in violations)
    most_recent = max(
        (v.begin_date for v in violations if v.begin_date), default=None
    )
    return {
        "total": len(violations),
        "open": len(open_violations),
        "openHealthBased": len([v for v in open_violations if v.is_health_based]),
        "healthBased": len(health_based),
        "byCategory": dict(by_category),
        "mostRecentBeginDate": most_recent.isoformat() if most_recent else None,
    }
