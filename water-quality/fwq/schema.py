"""Canonical record types for the Florida Water Quality API.

Every upstream feed lands in one of these shapes. The rules that hold across
all of them:

**Provenance is mandatory.** Each record carries the source system, the URL it
came from, when it was retrieved, and the upstream row identifier. A number
without a citation is not publishable; a caller must always be able to get back
to the original record.

**Non-detects are not zeros.** A lab result below the reporting limit means
"we looked and found nothing above X", which is different information from
"we measured zero" and very different from "we never sampled". `Result` keeps
`detected`, `detection_limit`, and `censoring` separate so no downstream
consumer has to guess.

**Freshness is a first-class field.** `DataStatus` reuses the DeedScout trust
vocabulary (live / cached / sample / blocked / broken / coming-soon) so the
water endpoints label themselves the same way the rest of the site does.

Serialization uses camelCase keys because the output is consumed by the
browser-side API clients; the Python attributes stay snake_case.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any, Literal

from . import analytes as analyte_registry
from . import units

SCHEMA_VERSION = "1.0"

PWSID_RE = re.compile(r"^[A-Z]{2}\d{7}$")


class DataStatus(str, Enum):
    """Trust label for a record or a whole dataset. Mirrors assets/data-trust.js."""

    LIVE = "live"
    CACHED = "cached"
    SAMPLE = "sample"
    BLOCKED = "blocked"
    BROKEN = "broken"
    COMING_SOON = "coming-soon"


class Source(str, Enum):
    """Which upstream system a record came from."""

    SDWIS = "epa-sdwis"
    UCMR5 = "epa-ucmr5"
    ECHO = "epa-echo"
    FDEP = "fl-dep"
    CCR = "utility-ccr"
    UTILITY_NOTICE = "utility-notice"
    DERIVED = "derived"


class Censoring(str, Enum):
    """How a reported value relates to the number attached to it."""

    NONE = "none"        # a measured value
    BELOW = "below"      # "< MRL" — non-detect
    ABOVE = "above"      # "> upper calibration limit"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | date | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return value.isoformat()


def _drop_none(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


class ValidationError(ValueError):
    pass


def validate_pwsid(pwsid: str) -> str:
    """Normalize and check a public water system id (e.g. `FL4500123`)."""
    s = str(pwsid).strip().upper().replace(" ", "")
    if not PWSID_RE.match(s):
        raise ValidationError(
            f"invalid PWSID {pwsid!r}: expected two letters followed by seven digits"
        )
    return s


# --- provenance -------------------------------------------------------------


@dataclass(frozen=True)
class Provenance:
    """Where a record came from and when."""

    source: Source
    retrieved_at: datetime
    source_url: str | None = None
    #: Upstream primary key, so a record can be traced back to its original row.
    source_row_id: str | None = None
    #: Free-text note about how the value was derived or why it is imperfect.
    note: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return _drop_none({
            "source": self.source.value,
            "retrievedAt": _iso(self.retrieved_at),
            "sourceUrl": self.source_url,
            "sourceRowId": self.source_row_id,
            "note": self.note,
        })


# --- water systems ----------------------------------------------------------


@dataclass
class ServiceArea:
    """Where a system delivers water. Populated from SDWIS geographic_area."""

    counties: list[str] = field(default_factory=list)
    cities: list[str] = field(default_factory=list)
    zips: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "counties": sorted(set(self.counties)),
            "cities": sorted(set(self.cities)),
            "zips": sorted(set(self.zips)),
        }


@dataclass
class WaterSystem:
    """A public water system — the top-level entity everything else hangs off."""

    pwsid: str
    name: str
    provenance: Provenance
    #: CWS (community), NTNCWS (non-transient non-community), TNCWS (transient).
    system_type: str | None = None
    owner_type: str | None = None
    #: GW, SW, GU (groundwater under direct surface influence), or a purchased variant.
    primary_source: str | None = None
    population_served: int | None = None
    service_connections: int | None = None
    is_active: bool | None = None
    service_area: ServiceArea = field(default_factory=ServiceArea)
    #: Other names the utility trades under, used for name-based lookup.
    aliases: list[str] = field(default_factory=list)
    phone: str | None = None
    website: str | None = None
    #: Systems this one buys water from, by PWSID. Matters because a purchased
    #: supply means the buyer's tap water carries the seller's contaminants.
    purchases_from: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.pwsid = validate_pwsid(self.pwsid)

    def to_dict(self) -> dict[str, Any]:
        return _drop_none({
            "pwsid": self.pwsid,
            "name": self.name,
            "aliases": self.aliases or None,
            "systemType": self.system_type,
            "ownerType": self.owner_type,
            "primarySource": self.primary_source,
            "populationServed": self.population_served,
            "serviceConnections": self.service_connections,
            "isActive": self.is_active,
            "serviceArea": self.service_area.to_dict(),
            "phone": self.phone,
            "website": self.website,
            "purchasesFrom": self.purchases_from or None,
            "provenance": self.provenance.to_dict(),
        })


# --- results ----------------------------------------------------------------


@dataclass
class Result:
    """One normalized measurement of one analyte at one system.

    `value` and `unit` are always in the analyte's canonical display unit; the
    original pair is preserved in `reported_value` / `reported_unit` so nothing
    is lost in translation.
    """

    pwsid: str
    analyte_id: str
    provenance: Provenance
    #: Normalized value in `unit`. `None` when the result is a non-detect with
    #: no numeric value, or when the analyte is qualitative (presence/absence).
    value: float | None
    unit: str
    detected: bool
    sample_date: date | None = None
    censoring: Censoring = Censoring.NONE
    #: Method detection or minimum reporting limit, in `unit`.
    detection_limit: float | None = None
    reported_value: float | None = None
    reported_unit: str | None = None
    #: Where in the system the sample was taken (entry point, distribution, tap).
    sampling_point: str | None = None
    #: For LCR results: the 90th-percentile value rather than a single sample.
    is_percentile_90: bool = False
    #: Number of samples behind an averaged or percentile value.
    sample_count: int | None = None

    def __post_init__(self) -> None:
        self.pwsid = validate_pwsid(self.pwsid)
        if self.detected and self.value is None and self.censoring is Censoring.NONE:
            raise ValidationError(
                f"{self.pwsid}/{self.analyte_id}: detected result has no value"
            )

    @property
    def analyte(self) -> analyte_registry.Analyte | None:
        return analyte_registry.get(self.analyte_id)

    def value_ng_l(self) -> float | None:
        """Value in ng/L, or `None` if not a mass concentration or not detected."""
        if self.value is None:
            return None
        try:
            return units.to_ng_l(self.value, self.unit)
        except (units.ConversionError, units.UnknownUnitError):
            return None

    def compare_to_limit(self) -> dict[str, Any] | None:
        """Compare against the analyte's enforceable limit.

        Returns `None` when the analyte has no enforceable limit, when the
        result is a non-detect, or when the limit and the result are in
        different dimensions. A non-detect is never reported as an exceedance:
        "not found above the reporting limit" cannot exceed anything.
        """
        analyte = self.analyte
        if analyte is None or self.value is None or not self.detected:
            return None
        limit = analyte.enforceable_limit
        if limit is None or limit.value is None or limit.unit is None:
            return None
        try:
            limit_in_result_unit = units.convert(limit.value, limit.unit, self.unit)
        except (units.ConversionError, units.UnknownUnitError):
            return None
        if limit_in_result_unit == 0:
            return None
        ratio = self.value / limit_in_result_unit
        return {
            "limitKind": limit.kind,
            "limitValue": limit.value,
            "limitUnit": limit.unit,
            "authority": limit.authority,
            "citation": limit.citation,
            "ratioToLimit": round(ratio, 4),
            "exceeds": self.value > limit_in_result_unit,
        }

    def to_dict(self) -> dict[str, Any]:
        analyte = self.analyte
        return _drop_none({
            "pwsid": self.pwsid,
            "analyteId": self.analyte_id,
            "analyteName": analyte.short_name if analyte else self.analyte_id,
            "group": analyte.group if analyte else None,
            "value": self.value,
            "unit": self.unit,
            "detected": self.detected,
            "censoring": self.censoring.value if self.censoring is not Censoring.NONE else None,
            "detectionLimit": self.detection_limit,
            "sampleDate": _iso(self.sample_date),
            "samplingPoint": self.sampling_point,
            "is90thPercentile": self.is_percentile_90 or None,
            "sampleCount": self.sample_count,
            "reportedValue": self.reported_value,
            "reportedUnit": self.reported_unit,
            "comparison": self.compare_to_limit(),
            "provenance": self.provenance.to_dict(),
        })


# --- violations -------------------------------------------------------------

ViolationCategory = Literal["MCL", "MRDL", "TT", "MR", "MON", "RPT", "OTHER"]

#: Categories that mean the water itself failed a health standard, as opposed
#: to the utility failing a paperwork or monitoring requirement.
HEALTH_BASED_CATEGORIES: frozenset[str] = frozenset({"MCL", "MRDL", "TT"})


@dataclass
class Violation:
    """A normalized SDWA violation."""

    pwsid: str
    violation_id: str
    provenance: Provenance
    category: str
    #: Upstream's own description of the violation type, kept verbatim.
    type_label: str | None = None
    analyte_id: str | None = None
    unmapped_analyte: str | None = None
    begin_date: date | None = None
    end_date: date | None = None
    #: True once the system has returned to compliance.
    resolved: bool | None = None
    compliance_status: str | None = None
    #: Public-notification tier: 1 = acute (24h), 2 = 30 days, 3 = annual.
    public_notification_tier: int | None = None
    is_health_based: bool | None = None

    def __post_init__(self) -> None:
        self.pwsid = validate_pwsid(self.pwsid)
        if self.is_health_based is None:
            self.is_health_based = self.category in HEALTH_BASED_CATEGORIES

    @property
    def is_open(self) -> bool | None:
        if self.resolved is None:
            return None
        return not self.resolved

    def to_dict(self) -> dict[str, Any]:
        analyte = analyte_registry.get(self.analyte_id) if self.analyte_id else None
        return _drop_none({
            "pwsid": self.pwsid,
            "violationId": self.violation_id,
            "category": self.category,
            "typeLabel": self.type_label,
            "analyteId": self.analyte_id,
            "analyteName": analyte.short_name if analyte else self.unmapped_analyte,
            "isHealthBased": self.is_health_based,
            "beginDate": _iso(self.begin_date),
            "endDate": _iso(self.end_date),
            "resolved": self.resolved,
            "complianceStatus": self.compliance_status,
            "publicNotificationTier": self.public_notification_tier,
            "provenance": self.provenance.to_dict(),
        })


# --- boil water notices -----------------------------------------------------


@dataclass
class BoilWaterNotice:
    """A precautionary or mandatory boil-water notice.

    Florida has no single statewide machine-readable BWN feed: notices are
    issued by individual utilities and county health departments, so each entry
    records exactly which utility page or notice it was read from.
    """

    pwsid: str
    notice_id: str
    provenance: Provenance
    issued_at: datetime | date
    status: Literal["active", "rescinded", "unknown"] = "unknown"
    rescinded_at: datetime | date | None = None
    #: Plain-text description of the affected area as the utility worded it.
    area_description: str | None = None
    affected_zips: list[str] = field(default_factory=list)
    affected_streets: list[str] = field(default_factory=list)
    reason: str | None = None
    is_precautionary: bool | None = None

    def __post_init__(self) -> None:
        self.pwsid = validate_pwsid(self.pwsid)

    def to_dict(self) -> dict[str, Any]:
        return _drop_none({
            "pwsid": self.pwsid,
            "noticeId": self.notice_id,
            "status": self.status,
            "issuedAt": _iso(self.issued_at),
            "rescindedAt": _iso(self.rescinded_at),
            "areaDescription": self.area_description,
            "affectedZips": self.affected_zips or None,
            "affectedStreets": self.affected_streets or None,
            "reason": self.reason,
            "isPrecautionary": self.is_precautionary,
            "provenance": self.provenance.to_dict(),
        })


# --- consumer confidence reports --------------------------------------------


@dataclass
class CCRDocument:
    """A utility's annual Consumer Confidence Report, and what we got out of it."""

    pwsid: str
    report_year: int
    url: str
    provenance: Provenance
    title: str | None = None
    #: False when we have the document but have not extracted its table yet.
    parsed: bool = False
    result_count: int = 0
    #: Contaminant names in the document that did not resolve to an analyte.
    unmapped_analytes: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.pwsid = validate_pwsid(self.pwsid)

    def to_dict(self) -> dict[str, Any]:
        return _drop_none({
            "pwsid": self.pwsid,
            "reportYear": self.report_year,
            "url": self.url,
            "title": self.title,
            "parsed": self.parsed,
            "resultCount": self.result_count,
            "unmappedAnalytes": self.unmapped_analytes or None,
            "provenance": self.provenance.to_dict(),
        })


# --- dataset envelope -------------------------------------------------------


@dataclass
class DatasetMeta:
    """Freshness and trust metadata attached to every API payload."""

    dataset: str
    status: DataStatus
    generated_at: datetime
    #: When the underlying source last returned data successfully.
    source_last_success: datetime | None = None
    record_count: int = 0
    #: Human-readable statement of what this dataset does not cover.
    limitations: str | None = None
    sources: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return _drop_none({
            "dataset": self.dataset,
            "schemaVersion": SCHEMA_VERSION,
            "status": self.status.value,
            "generatedAt": _iso(self.generated_at),
            "sourceLastSuccess": _iso(self.source_last_success),
            "recordCount": self.record_count,
            "limitations": self.limitations,
            "sources": self.sources or None,
            "warnings": self.warnings or None,
        })
