"""Ingest orchestrator: pull, normalize, and write the published dataset.

Output layout under `data/water/`:

    index.json               dataset manifest, freshness, per-source status
    analytes.json            the public analyte dictionary and limits
    systems.json             compact record for every Florida system
    service-index.json       ZIP / city / county -> PWSID reverse index
    utilities.json           the utilities built out end to end
    systems/<PWSID>.json     full profile: results, violations, notices, CCRs
    source-probe.json        last reachability check per source
    ingest-report.json       what was dropped and why

The orchestrator's contract is that a partial failure produces a smaller, and
correctly labelled, dataset rather than a broken one. Each stage is wrapped;
what fails is recorded in the manifest as a `blocked` or `broken` source and
the previous run's file for that section is left in place.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

from . import analytes as analyte_registry
from . import normalize, utilities
from .geo import ServiceIndex
from .schema import (
    BoilWaterNotice,
    CCRDocument,
    DatasetMeta,
    DataStatus,
    Provenance,
    Result,
    Source,
    Violation,
    WaterSystem,
)
from .sources import envirofacts, notices
from .sources.http import Client, SourceUnavailable

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT_DIR = REPO_ROOT / "data" / "water"

#: A dataset older than this is labelled `cached` rather than `live`, matching
#: the 72-hour threshold the rest of the site uses.
LIVE_WINDOW = timedelta(hours=72)


@dataclass
class SourceOutcome:
    """Per-source result of an ingest run."""

    source_id: str
    status: DataStatus
    detail: str = ""
    record_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source_id,
            "status": self.status.value,
            "detail": self.detail,
            "recordCount": self.record_count,
        }


@dataclass
class IngestResult:
    generated_at: datetime
    systems: list[WaterSystem] = field(default_factory=list)
    results: list[Result] = field(default_factory=list)
    violations: list[Violation] = field(default_factory=list)
    boil_water_notices: list[BoilWaterNotice] = field(default_factory=list)
    ccr_documents: list[CCRDocument] = field(default_factory=list)
    outcomes: list[SourceOutcome] = field(default_factory=list)
    report: normalize.NormalizationReport = field(
        default_factory=normalize.NormalizationReport
    )
    resolutions: list[utilities.ResolutionOutcome] = field(default_factory=list)

    @property
    def overall_status(self) -> DataStatus:
        """Worst-case status across sources, because a manifest must not oversell.

        If the system inventory could not be pulled at all there is nothing to
        publish, so the dataset is `blocked`/`broken` outright. Otherwise a
        degraded section downgrades `live` to `cached`.
        """
        by_id = {o.source_id: o for o in self.outcomes}
        inventory = by_id.get("epa-envirofacts")
        if inventory is not None and inventory.status in (
            DataStatus.BLOCKED, DataStatus.BROKEN
        ):
            return inventory.status
        if not self.systems:
            return DataStatus.COMING_SOON
        degraded = {
            o.status for o in self.outcomes
            if o.status in (DataStatus.BLOCKED, DataStatus.BROKEN)
        }
        return DataStatus.CACHED if degraded else DataStatus.LIVE


# --- stages -----------------------------------------------------------------


def resolve_utilities(
    client: Client, configs: dict[str, utilities.UtilityConfig]
) -> list[utilities.ResolutionOutcome]:
    """Resolve each configured utility to a PWSID via SDWIS name search."""
    outcomes: list[utilities.ResolutionOutcome] = []
    for slug, config in sorted(configs.items()):
        log.info("resolving %s (fragment=%r)", slug, config.search_fragment)
        try:
            candidates = envirofacts.find_systems_by_name(
                client, config.search_fragment, config.state
            )
        except SourceUnavailable as exc:
            outcome = utilities.ResolutionOutcome(
                slug=slug, pwsid=None, matched_name=None, confidence="unresolved"
            )
            outcome.warnings.append(f"SDWIS unreachable: {exc}")
            outcomes.append(outcome)
            continue

        geographic: list[dict[str, Any]] = []
        pwsids = [str(r.get("pwsid")) for r in candidates[:5] if r.get("pwsid")]
        if pwsids:
            try:
                geographic = envirofacts.fetch_geographic_areas(client, pwsids)
            except SourceUnavailable as exc:
                log.warning("service areas unavailable during resolution: %s", exc)

        outcome = utilities.resolve_pwsid(config, candidates, geographic_rows=geographic)
        log.info(
            "  -> %s (%s) confidence=%s",
            outcome.pwsid, outcome.matched_name, outcome.confidence,
        )
        for warning in outcome.warnings:
            log.warning("  ! %s", warning)
        outcomes.append(outcome)
    return outcomes


def ingest_state(
    client: Client,
    *,
    state: str = "FL",
    focus_pwsids: Sequence[str] = (),
    retrieved_at: datetime | None = None,
    codemap_path: Path | None = None,
) -> IngestResult:
    """Pull and normalize a state's systems, plus deep data for focus systems.

    The statewide pass builds the inventory and the ZIP index — cheap, two
    tables. The deep pass (violations, lead/copper, PFAS) runs only for
    `focus_pwsids`, because pulling every violation for ~5,000 Florida systems
    on every run is neither necessary nor polite to a public agency's servers.

    `codemap_path` redirects the learned SDWIS contaminant-code map. Tests pass
    a temporary path so a test run never writes fixture-derived mappings into
    the package's shipped data directory.
    """
    retrieved_at = retrieved_at or datetime.now(timezone.utc)
    out = IngestResult(generated_at=retrieved_at)
    report = out.report

    # -- statewide inventory ---------------------------------------------
    try:
        system_rows = envirofacts.fetch_state_water_systems(client, state)
        geo_rows = envirofacts.fetch_geographic_areas_for_state(client, state)
        out.outcomes.append(
            SourceOutcome("epa-envirofacts", DataStatus.LIVE, "", len(system_rows))
        )
    except SourceUnavailable as exc:
        log.error("SDWIS inventory unavailable: %s", exc)
        status = DataStatus.BLOCKED if "denied" in exc.reason else DataStatus.BROKEN
        out.outcomes.append(SourceOutcome("epa-envirofacts", status, exc.reason))
        return out

    geo_by_pwsid: dict[str, list[dict[str, Any]]] = {}
    for row in geo_rows:
        pwsid = str(row.get("pwsid", "")).upper()
        if pwsid:
            geo_by_pwsid.setdefault(pwsid, []).append(row)

    for row in system_rows:
        pwsid = str(row.get("pwsid", "")).upper()
        system = normalize.normalize_water_system(
            row, retrieved_at,
            geographic_rows=geo_by_pwsid.get(pwsid, []),
            report=report,
        )
        if system is not None:
            out.systems.append(system)
    report.counts["systems"] = len(out.systems)

    if not focus_pwsids:
        return out

    # -- reference codes ---------------------------------------------------
    try:
        contaminant_names = envirofacts.fetch_contaminant_codes(client)
        _persist_contaminant_codes(contaminant_names, codemap_path)
    except SourceUnavailable as exc:
        log.warning("contaminant reference table unavailable: %s", exc)
        contaminant_names = {}

    # -- deep pull for focus systems --------------------------------------
    pulled = envirofacts.pull_systems(client, focus_pwsids)
    for section, message in pulled.get("errors", {}).items():
        out.outcomes.append(SourceOutcome(f"epa-envirofacts:{section}", DataStatus.BROKEN, message))

    for row in pulled["violations"]:
        violation = normalize.normalize_violation(
            row, retrieved_at, contaminant_names=contaminant_names, report=report
        )
        if violation is not None:
            out.violations.append(violation)
    report.counts["violations"] = len(out.violations)

    for row in pulled["lcr_results"]:
        result = normalize.normalize_lcr_result(
            row, retrieved_at, contaminant_names=contaminant_names, report=report
        )
        if result is not None:
            out.results.append(result)
    report.counts["lcrResults"] = len(out.results)

    ucmr_rows = pulled.get("ucmr5") or []
    ucmr_count = 0
    for row in ucmr_rows:
        result = normalize.normalize_ucmr5_result(row, retrieved_at, report=report)
        if result is not None:
            out.results.append(result)
            ucmr_count += 1
    report.counts["ucmr5Results"] = ucmr_count
    out.outcomes.append(
        SourceOutcome(
            "epa-ucmr5",
            DataStatus.LIVE if ucmr_rows else DataStatus.BLOCKED,
            f"table={pulled.get('ucmr5_table')}" if ucmr_rows
            else "UCMR 5 not reachable under any known table name",
            ucmr_count,
        )
    )

    # -- manual boil-water notices ----------------------------------------
    manual = notices.load_manual_notices()
    out.boil_water_notices.extend(manual)
    out.outcomes.append(
        SourceOutcome(
            "utility-notice:manual",
            DataStatus.CACHED if manual else DataStatus.COMING_SOON,
            "hand-entered notices" if manual else "no manual notices on file",
            len(manual),
        )
    )
    return out


#: Where the learned SDWIS contaminant-code map is written. Committed by CI so
#: the mapping ships with the package; overridable so tests never mutate it.
CODEMAP_PATH = Path(__file__).parent / "data" / "sdwis_contaminant_codes.json"


def _persist_contaminant_codes(
    names: dict[str, str], path: Path | None = None
) -> None:
    """Save EPA's contaminant code table, mapped onto our analyte ids where possible."""
    if not names:
        return
    mapping: dict[str, str] = {}
    unmapped: dict[str, str] = {}
    for code, description in names.items():
        analyte = analyte_registry.resolve(name=description)
        if analyte is not None:
            mapping[code] = analyte.id
        else:
            unmapped[code] = description
    path = Path(path or CODEMAP_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "$comment": (
                    "Learned from EPA's sdwis.ref_code_values table by `fwq ingest`. "
                    "`codes` maps SDWIS contaminant codes to our analyte ids; "
                    "`unmapped` lists codes whose EPA description matches no analyte "
                    "in analytes.json and is the to-do list for extending it."
                ),
                "codes": dict(sorted(mapping.items())),
                "unmapped": dict(sorted(unmapped.items())),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    analyte_registry.registry.cache_clear()


# --- profile assembly -------------------------------------------------------


def build_profile(
    system: WaterSystem,
    *,
    results: Sequence[Result],
    violations: Sequence[Violation],
    boil_water: Sequence[BoilWaterNotice],
    ccrs: Sequence[CCRDocument],
    generated_at: datetime,
    config: utilities.UtilityConfig | None = None,
) -> dict[str, Any]:
    """Assemble everything known about one system into one document."""
    system_results = [r for r in results if r.pwsid == system.pwsid]
    system_violations = [v for v in violations if v.pwsid == system.pwsid]
    system_notices = [n for n in boil_water if n.pwsid == system.pwsid]
    system_ccrs = [c for c in ccrs if c.pwsid == system.pwsid]

    latest = normalize.latest_by_analyte(system_results)
    hazard = normalize.pfas_hazard_index(system_results)

    pfas_results = [
        r for r in latest.values()
        if (r.analyte and r.analyte.group == "pfas")
    ]
    exceedances = [
        r for r in latest.values()
        if (comparison := r.compare_to_limit()) and comparison["exceeds"]
    ]

    priority_ids = config.priority_analytes if config else []
    priority = [latest[a].to_dict() for a in priority_ids if a in latest]

    active_notices = [n for n in system_notices if n.status in ("active", "unknown")]

    return {
        "system": system.to_dict(),
        "generatedAt": generated_at.isoformat().replace("+00:00", "Z"),
        "summary": {
            "resultCount": len(system_results),
            "analytesMeasured": len(latest),
            "exceedanceCount": len(exceedances),
            "violations": normalize.summarize_violations(system_violations),
            "activeBoilWaterNotices": len(active_notices),
            "pfas": {
                "analytesMeasured": len(pfas_results),
                "detections": len([r for r in pfas_results if r.detected]),
                "hazardIndex": hazard.to_dict(),
            },
        },
        "priorityResults": priority,
        "exceedances": [r.to_dict() for r in exceedances],
        "results": [r.to_dict() for r in sorted(
            latest.values(), key=lambda r: (r.analyte.group if r.analyte else "", r.analyte_id)
        )],
        "violations": [
            v.to_dict() for v in sorted(
                system_violations,
                key=lambda v: (v.begin_date or datetime.min.date()),
                reverse=True,
            )
        ],
        "boilWaterNotices": [n.to_dict() for n in system_notices],
        "consumerConfidenceReports": [c.to_dict() for c in system_ccrs],
    }


# --- writing ----------------------------------------------------------------


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def write_dataset(
    result: IngestResult,
    configs: dict[str, utilities.UtilityConfig],
    *,
    out_dir: Path | None = None,
    profiles_for: Sequence[str] = (),
) -> dict[str, Any]:
    """Write every published artifact and return the manifest."""
    out_dir = Path(out_dir or DEFAULT_OUT_DIR)
    generated = result.generated_at
    status = result.overall_status

    # analyte dictionary — the public normalization contract
    reg = analyte_registry.registry()
    _write_json(out_dir / "analytes.json", {
        "meta": DatasetMeta(
            dataset="analytes",
            status=DataStatus.CACHED,
            generated_at=generated,
            record_count=len(reg.analytes),
            limitations=(
                "Regulatory limits are a maintained snapshot, not a live feed from "
                "the CFR. Re-verify before relying on them for compliance."
            ),
            sources=["EPA National Primary Drinking Water Regulations"],
        ).to_dict(),
        "version": reg.version,
        "limitReview": reg.limit_review,
        "hazardIndex": {
            "limit": reg.hazard_index_limit,
            "components": list(reg.hazard_index_components),
        },
        "analytes": [a.to_dict() for a in sorted(reg.analytes.values(), key=lambda a: a.id)],
    })

    if result.systems:
        _write_json(out_dir / "systems.json", {
            "meta": DatasetMeta(
                dataset="systems",
                status=status,
                generated_at=generated,
                record_count=len(result.systems),
                sources=["EPA SDWIS via Envirofacts"],
                limitations=(
                    "Inventory and service areas are self-reported by utilities to "
                    "SDWIS and can lag reality by a reporting cycle."
                ),
            ).to_dict(),
            "systems": [s.to_dict() for s in sorted(result.systems, key=lambda s: s.pwsid)],
        })

        index = ServiceIndex.from_systems(result.systems)
        _write_json(out_dir / "service-index.json", index.to_dict())

    # per-system profiles
    wanted = set(profiles_for) or {c.pwsid for c in configs.values() if c.pwsid}
    by_pwsid = {s.pwsid: s for s in result.systems}
    config_by_pwsid = {c.pwsid: c for c in configs.values() if c.pwsid}
    written_profiles: list[str] = []
    for pwsid in sorted(p for p in wanted if p):
        system = by_pwsid.get(pwsid)
        if system is None:
            log.warning("no system record for %s; profile skipped", pwsid)
            continue
        profile = build_profile(
            system,
            results=result.results,
            violations=result.violations,
            boil_water=result.boil_water_notices,
            ccrs=result.ccr_documents,
            generated_at=generated,
            config=config_by_pwsid.get(pwsid),
        )
        _write_json(out_dir / "systems" / f"{pwsid}.json", profile)
        written_profiles.append(pwsid)

    _write_json(out_dir / "utilities.json", {
        "meta": DatasetMeta(
            dataset="utilities",
            status=status,
            generated_at=generated,
            record_count=len(configs),
        ).to_dict(),
        "utilities": [
            {
                "slug": c.slug,
                "name": c.name,
                "shortName": c.short_name,
                "pwsid": c.pwsid,
                "hasProfile": bool(c.pwsid and c.pwsid in written_profiles),
                "website": c.website.get("url") if c.website.get("verified") else None,
                "websiteUnverified": None if c.website.get("verified") else c.website.get("url"),
                "ccrSources": [s.to_dict() for s in c.ccr_sources],
                "noticeSources": [s.to_dict() for s in c.notice_sources],
            }
            for c in sorted(configs.values(), key=lambda c: c.slug)
        ],
    })

    _write_json(out_dir / "ingest-report.json", {
        "generatedAt": generated.isoformat().replace("+00:00", "Z"),
        "normalization": result.report.to_dict(),
        "sources": [o.to_dict() for o in result.outcomes],
        "resolutions": [r.to_dict() for r in result.resolutions],
    })

    manifest = {
        "meta": DatasetMeta(
            dataset="florida-water-quality",
            status=status,
            generated_at=generated,
            record_count=len(result.systems),
            sources=[o.source_id for o in result.outcomes],
            limitations=(
                "Aggregated from public federal and utility sources. Not a substitute "
                "for your utility's own Consumer Confidence Report or for a certified "
                "lab test of water at your tap."
            ),
            warnings=[o.detail for o in result.outcomes if o.detail and o.status in (
                DataStatus.BLOCKED, DataStatus.BROKEN
            )],
        ).to_dict(),
        "schemaVersion": "1.0",
        "endpoints": {
            "analytes": "/api/water/analytes",
            "systems": "/api/water/systems",
            "system": "/api/water/system?pwsid=FL0000000",
            "lookup": "/api/water/lookup?zip=33410",
            "utilities": "/api/water/utilities",
            "health": "/api/water/health",
        },
        "counts": {
            "systems": len(result.systems),
            "results": len(result.results),
            "violations": len(result.violations),
            "boilWaterNotices": len(result.boil_water_notices),
            "profiles": len(written_profiles),
        },
        "sources": [o.to_dict() for o in result.outcomes],
        "profiles": written_profiles,
    }
    _write_json(out_dir / "index.json", manifest)
    return manifest


def probe_sources(client: Client, out_dir: Path | None = None) -> dict[str, Any]:
    """Check every registered source's reachability and record the answer."""
    registry_path = Path(__file__).parent / "data" / "sources.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    checked: list[dict[str, Any]] = []
    for source in registry.get("sources", []):
        probe_url = source.get("probe_url") or source.get("url")
        outcome = client.probe(probe_url)
        outcome["id"] = source["id"]
        outcome["name"] = source["name"]
        checked.append(outcome)
        log.info(
            "%-24s %s %s",
            source["id"],
            "OK " if outcome["reachable"] else "FAIL",
            outcome.get("httpStatus") or outcome.get("detail", "")[:60],
        )

    payload = {
        "checkedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "$comment": (
            "Written by `python -m fwq probe`. `reachable: false` here means the "
            "source was not reachable from wherever the probe ran, which may be a "
            "network policy at the runner rather than an outage at the source."
        ),
        "results": checked,
    }
    _write_json(Path(out_dir or DEFAULT_OUT_DIR) / "source-probe.json", payload)
    return payload
