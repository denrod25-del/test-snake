"""Per-utility configuration and PWSID resolution.

A utility config says which real-world utility we mean and where its
non-federal data lives (CCR index page, alerts page). It deliberately does not
carry a hardcoded PWSID.

That choice is the point of this module. Attaching results to the wrong PWSID
is the most damaging thing this API could do — it would show one community
another community's PFAS numbers and violations — and a nine-character
identifier typed from memory is exactly the kind of thing that is wrong without
looking wrong. So a PWSID enters the system only by being resolved against
SDWIS by name, scored against the config's expectations, and written to a
committed lockfile with the runners-up that were rejected. A human reviewing
the lockfile diff can see what was chosen and why.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from .schema import ValidationError, validate_pwsid

log = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent / "data"
UTILITIES_DIR = _DATA_DIR / "utilities"
LOCKFILE_PATH = _DATA_DIR / "utilities.lock.json"


@dataclass
class SourceRef:
    """A configured non-federal source for one utility."""

    id: str
    kind: str
    url: str
    verified: bool = False
    selector: str | None = None
    link_pattern: str | None = None
    note: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "SourceRef":
        return cls(
            id=raw["id"],
            kind=raw.get("kind", "unknown"),
            url=raw["url"],
            verified=bool(raw.get("verified", False)),
            selector=raw.get("selector"),
            link_pattern=raw.get("link_pattern"),
            note=raw.get("note"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "url": self.url,
            "verified": self.verified,
            "note": self.note,
        }


@dataclass
class UtilityConfig:
    slug: str
    name: str
    state: str = "FL"
    short_name: str | None = None
    #: Only ever set from the lockfile, never from the config file itself.
    pwsid: str | None = None
    aliases: list[str] = field(default_factory=list)
    resolution: dict[str, Any] = field(default_factory=dict)
    expected_service_area: dict[str, Any] = field(default_factory=dict)
    website: dict[str, Any] = field(default_factory=dict)
    ccr_sources: list[SourceRef] = field(default_factory=list)
    notice_sources: list[SourceRef] = field(default_factory=list)
    priority_analytes: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "UtilityConfig":
        configured_pwsid = raw.get("pwsid")
        if configured_pwsid:
            # Tolerated but flagged: a config-file PWSID skips the audit trail.
            log.warning(
                "utility %s pins a PWSID in its config file; prefer name resolution "
                "so the choice is recorded in the lockfile",
                raw.get("slug"),
            )
        return cls(
            slug=raw["slug"],
            name=raw["name"],
            state=raw.get("state", "FL"),
            short_name=raw.get("short_name"),
            pwsid=validate_pwsid(configured_pwsid) if configured_pwsid else None,
            aliases=list(raw.get("aliases", [])),
            resolution=dict(raw.get("pwsid_resolution", {})),
            expected_service_area=dict(raw.get("expected_service_area", {})),
            website=dict(raw.get("website", {})),
            ccr_sources=[SourceRef.from_dict(s) for s in raw.get("ccr_sources", [])],
            notice_sources=[SourceRef.from_dict(s) for s in raw.get("notice_sources", [])],
            priority_analytes=list(raw.get("priority_analytes", {}).get("ids", [])),
        )

    @property
    def search_fragment(self) -> str:
        return self.resolution.get("search_fragment") or self.name


def load_configs(directory: Path | None = None) -> dict[str, UtilityConfig]:
    """Load every utility config, keyed by slug."""
    directory = directory or UTILITIES_DIR
    out: dict[str, UtilityConfig] = {}
    if not directory.exists():
        return out
    for path in sorted(directory.glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        config = UtilityConfig.from_dict(raw)
        out[config.slug] = config
    return out


# --- PWSID resolution -------------------------------------------------------


@dataclass
class ResolutionOutcome:
    """The result of resolving a utility config to a PWSID."""

    slug: str
    pwsid: str | None
    matched_name: str | None
    confidence: str  # "high" | "medium" | "low" | "unresolved"
    checks: dict[str, Any] = field(default_factory=dict)
    rejected: list[dict[str, Any]] = field(default_factory=list)
    resolved_at: str | None = None
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "pwsid": self.pwsid,
            "matchedName": self.matched_name,
            "confidence": self.confidence,
            "checks": self.checks,
            "rejected": self.rejected,
            "resolvedAt": self.resolved_at,
            "warnings": self.warnings,
        }


def score_candidate(config: UtilityConfig, row: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Score one SDWIS system against a utility config's expectations.

    Returns `(score, checks)`. Each expectation the config states is checked
    explicitly and recorded, so the lockfile shows not just what matched but
    what was verified about it.
    """
    expectations = config.resolution
    name = str(row.get("pws_name", ""))
    checks: dict[str, Any] = {}
    score = 0

    fragment = config.search_fragment.casefold()
    checks["nameContainsFragment"] = fragment in name.casefold()
    if checks["nameContainsFragment"]:
        score += 3

    expected_type = str(expectations.get("expect_type", "")).upper()
    actual_type = str(row.get("pws_type_code", "")).upper()
    if expected_type:
        checks["typeMatches"] = actual_type == expected_type
        score += 2 if checks["typeMatches"] else -2
    checks["pwsTypeCode"] = actual_type or None

    activity = str(row.get("pws_activity_code", "")).upper()
    checks["isActive"] = activity == "A"
    score += 2 if checks["isActive"] else -3

    population = row.get("population_served_count")
    try:
        population_int = int(float(population)) if population not in (None, "") else None
    except (TypeError, ValueError):
        population_int = None
    checks["populationServed"] = population_int
    minimum = expectations.get("expect_population_min")
    if minimum is not None and population_int is not None:
        checks["meetsPopulationMinimum"] = population_int >= int(minimum)
        score += 2 if checks["meetsPopulationMinimum"] else -2

    return score, checks


def resolve_pwsid(
    config: UtilityConfig,
    candidates: Sequence[dict[str, Any]],
    *,
    geographic_rows: Sequence[dict[str, Any]] = (),
) -> ResolutionOutcome:
    """Pick the SDWIS system that a utility config refers to.

    Confidence is deliberately conservative:

    ``high``    one clear winner that passed every stated expectation
    ``medium``  a winner, but an expectation failed or a rival scored close
    ``low``     a weak best guess; the ingest treats this as needing review
    ``unresolved`` nothing matched

    Only `high` should be published without a human looking at the lockfile.
    """
    outcome = ResolutionOutcome(
        slug=config.slug,
        pwsid=None,
        matched_name=None,
        confidence="unresolved",
        resolved_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )
    if not candidates:
        outcome.warnings.append(
            f"no SDWIS system matched name fragment {config.search_fragment!r} in "
            f"{config.state}"
        )
        return outcome

    scored: list[tuple[int, dict[str, Any], dict[str, Any]]] = []
    for row in candidates:
        score, checks = score_candidate(config, row)
        scored.append((score, checks, row))
    scored.sort(key=lambda item: item[0], reverse=True)

    best_score, best_checks, best_row = scored[0]
    try:
        pwsid = validate_pwsid(str(best_row.get("pwsid", "")))
    except ValidationError as exc:
        outcome.warnings.append(f"best candidate had an unusable PWSID: {exc}")
        return outcome

    counties = _counties_for(pwsid, geographic_rows)
    expected_counties = {
        c.casefold() for c in config.resolution.get("expect_counties", [])
    }
    if expected_counties:
        actual = {c.casefold() for c in counties}
        best_checks["countyMatches"] = bool(expected_counties & actual) if actual else None
        best_checks["countiesServed"] = sorted(counties)
        if best_checks["countyMatches"] is False:
            best_score -= 3
            outcome.warnings.append(
                f"resolved system serves {sorted(counties)}, expected one of "
                f"{sorted(expected_counties)}"
            )

    runner_up_score = scored[1][0] if len(scored) > 1 else None
    failed_checks = [k for k, v in best_checks.items() if v is False]

    if best_score >= 7 and not failed_checks and (
        runner_up_score is None or best_score - runner_up_score >= 3
    ):
        confidence = "high"
    elif best_score >= 4:
        confidence = "medium"
        if failed_checks:
            outcome.warnings.append(f"failed expectations: {', '.join(failed_checks)}")
        if runner_up_score is not None and best_score - runner_up_score < 3:
            outcome.warnings.append(
                f"runner-up scored {runner_up_score} against winner's {best_score}; "
                "the match is not clear-cut"
            )
    else:
        confidence = "low"
        outcome.warnings.append(
            f"best candidate scored only {best_score}; treat as unverified"
        )

    outcome.pwsid = pwsid
    outcome.matched_name = str(best_row.get("pws_name", "")) or None
    outcome.confidence = confidence
    outcome.checks = best_checks
    outcome.rejected = [
        {
            "pwsid": str(row.get("pwsid", "")),
            "name": str(row.get("pws_name", "")),
            "score": score,
            "typeCode": str(row.get("pws_type_code", "")),
            "activityCode": str(row.get("pws_activity_code", "")),
        }
        for score, _checks, row in scored[1:6]
    ]
    return outcome


def _counties_for(pwsid: str, geographic_rows: Sequence[dict[str, Any]]) -> set[str]:
    out: set[str] = set()
    for row in geographic_rows:
        if str(row.get("pwsid", "")).upper() != pwsid:
            continue
        county = row.get("county_served") or row.get("county")
        if county:
            out.add(re.sub(r"\s+", " ", str(county)).strip().title())
    return out


# --- lockfile ---------------------------------------------------------------


def load_lockfile(path: Path | None = None) -> dict[str, Any]:
    path = path or LOCKFILE_PATH
    if not path.exists():
        return {"version": 1, "utilities": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def write_lockfile(outcomes: Sequence[ResolutionOutcome], path: Path | None = None) -> Path:
    """Persist resolution outcomes so PWSID choices are reviewable in a diff."""
    path = path or LOCKFILE_PATH
    existing = load_lockfile(path)
    utilities = existing.get("utilities", {})
    for outcome in outcomes:
        utilities[outcome.slug] = outcome.to_dict()
    payload = {
        "$comment": (
            "Generated by `python -m fwq resolve`. Each entry records which SDWIS "
            "system a utility config resolved to, what was checked, and which "
            "candidates were rejected. Review changes to this file carefully: a "
            "changed PWSID reassigns every result, violation, and notice for that "
            "utility."
        ),
        "version": 1,
        "utilities": utilities,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    return path


def apply_lockfile(configs: dict[str, UtilityConfig], lock: dict[str, Any] | None = None) -> None:
    """Attach resolved PWSIDs from the lockfile onto loaded configs."""
    lock = lock if lock is not None else load_lockfile()
    for slug, entry in lock.get("utilities", {}).items():
        config = configs.get(slug)
        pwsid = entry.get("pwsid")
        if config is None or not pwsid:
            continue
        if entry.get("confidence") == "low":
            log.warning(
                "utility %s resolved to %s with low confidence; not applying",
                slug, pwsid,
            )
            continue
        config.pwsid = pwsid
