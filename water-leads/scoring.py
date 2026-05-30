"""Per-system and per-ZIP risk scoring for the lead-gen UI.

Higher score = better sales target (stronger pitch hook for the homeowner).
"""
from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

# Short human labels for SDWIS contaminant codes that we quote in copy.
# Not exhaustive; falls back to the raw code when unknown.
CONTAMINANT_LABELS: dict[str, str] = {
    "1005": "Arsenic",
    "1038": "Nitrate",
    "1040": "Nitrite",
    "1074": "Lead",
    "1022": "Copper",
    "2950": "Total Trihalomethanes (TTHM)",
    "2456": "Haloacetic Acids (HAA5)",
    "3014": "Coliform",
    "3100": "E. coli",
    "1094": "Radium",
    "4000": "Gross Alpha",
    "1036": "Fluoride",
    "1045": "Chromium",
    "2039": "Perchlorate",
    "2969": "PFOA",
    "2968": "PFOS",
    "2034": "Atrazine",
    "1015": "Chromium, Hexavalent",
    "1094A": "Radium 226/228",
}


def contaminant_label(code: str | None) -> str:
    if not code:
        return "unknown contaminant"
    return CONTAMINANT_LABELS.get(code.strip(), f"contaminant {code.strip()}")


def _is_open(v: dict[str, Any]) -> bool:
    status = (v.get("compliance_status") or "").upper()
    # O = Open, K = Known, U = Unaddressed
    return status in ("O", "K", "U")


def _category(v: dict[str, Any]) -> str:
    return (v.get("category") or "").upper()


def _lead_risk_tier(
    has_open_lead_violation: bool,
    has_lead_exceedance: bool,
    any_lead_detection: bool,
    lcr_sample_count: int,
    pre_1980_housing_pct: float | None,
) -> str:
    """Derive a lead risk tier per PWSID from LCR + housing age.

    This is a proxy for a formal LSL inventory row (which utilities now have
    to publish under LCRR, but distribution is uneven). When an uploaded
    `lsl_inventory` row exists the caller may override this.
    """
    if has_open_lead_violation or has_lead_exceedance:
        return "high"
    if any_lead_detection:
        return "medium"
    if pre_1980_housing_pct is not None and pre_1980_housing_pct >= 50:
        return "medium"
    if pre_1980_housing_pct is not None and pre_1980_housing_pct >= 25:
        return "medium" if lcr_sample_count == 0 else "low"
    if lcr_sample_count == 0:
        return "unknown"
    return "low"


def score_system(
    system: dict[str, Any],
    violations: list[dict[str, Any]],
    lcr_results: list[dict[str, Any]],
    ucmr_results: list[dict[str, Any]] | None = None,
    pre_1980_housing_pct: float | None = None,
) -> dict[str, Any]:
    """Compute a risk score + flags for a single water system."""
    ucmr_results = ucmr_results or []
    score = 0
    flags = {
        "mcl": False,
        "mrdl": False,
        "tt": False,
        "lcr_lead": False,
        "lcr_copper": False,
        "health_based": False,
        "pfas": False,
        "pfas_mcl": False,
    }
    top_issue = None
    top_contaminant = None

    open_violations = [v for v in violations if _is_open(v)]

    has_mcl_health = any(
        _category(v) in ("MCL", "MRDL") and v.get("is_health_based")
        for v in open_violations
    )
    if has_mcl_health:
        score += 3
        flags["mcl"] = True
        flags["health_based"] = True
        top_issue = "Active MCL violation (health-based)"
        for v in open_violations:
            if _category(v) in ("MCL", "MRDL") and v.get("is_health_based"):
                top_contaminant = contaminant_label(v.get("contaminant_code"))
                break

    has_tt = any(_category(v) == "TT" for v in open_violations)
    if has_tt:
        score += 2
        flags["tt"] = True
        top_issue = top_issue or "Active treatment technique violation"

    lead_exceed = any(
        r.get("exceeds_action")
        and (
            "PB" in (r.get("contaminant_code") or "").upper()
            or "LEAD" in (r.get("contaminant_code") or "").upper()
        )
        for r in lcr_results
    )
    copper_exceed = any(
        r.get("exceeds_action")
        and (
            "CU" in (r.get("contaminant_code") or "").upper()
            or "COPPER" in (r.get("contaminant_code") or "").upper()
        )
        for r in lcr_results
    )
    any_lead_detection = any(
        (r.get("sample_measure") or 0) > 0
        and (
            "PB" in (r.get("contaminant_code") or "").upper()
            or "LEAD" in (r.get("contaminant_code") or "").upper()
        )
        for r in lcr_results
    )
    if lead_exceed:
        score += 3
        flags["lcr_lead"] = True
        top_issue = "Lead above EPA action level (15 ppb)"
        top_contaminant = "Lead"
    if copper_exceed:
        score += 2
        flags["lcr_copper"] = True
        if not top_issue:
            top_issue = "Copper above EPA action level (1.3 mg/L)"
            top_contaminant = "Copper"

    # PFAS via UCMR 5
    pfas_any = any(
        "PF" in (u.get("contaminant") or "").upper()
        and (u.get("sample_measure") or 0) > 0
        for u in ucmr_results
    )
    pfas_over_mcl = any(u.get("exceeds_mcl") for u in ucmr_results)
    if pfas_any:
        score += 1
        flags["pfas"] = True
    if pfas_over_mcl:
        score += 3
        flags["pfas_mcl"] = True
        flags["health_based"] = True
        top_issue = "PFAS detected above 2024 MCL"
        # name the specific analyte
        for u in ucmr_results:
            if u.get("exceeds_mcl"):
                top_contaminant = u.get("contaminant") or "PFAS"
                break
    elif pfas_any and not top_issue:
        top_issue = "PFAS detected (UCMR 5)"
        for u in ucmr_results:
            if "PF" in (u.get("contaminant") or "").upper() and (u.get("sample_measure") or 0) > 0:
                top_contaminant = u.get("contaminant")
                break

    extra_open = max(0, len(open_violations) - (3 if has_mcl_health else 0))
    score += min(3, extra_open)

    pop = int(system.get("population_served") or 0)
    if pop > 10_000:
        score += 1
    if pop > 100_000:
        score += 1

    lead_tier = _lead_risk_tier(
        has_open_lead_violation=any(
            _category(v) in ("MCL", "TT") and "PB" in (v.get("contaminant_code") or "").upper()
            for v in open_violations
        ) or any(
            _category(v) in ("MCL", "TT") and "LEAD" in (v.get("contaminant_code") or "").upper()
            for v in open_violations
        ),
        has_lead_exceedance=lead_exceed,
        any_lead_detection=any_lead_detection,
        lcr_sample_count=len(lcr_results),
        pre_1980_housing_pct=pre_1980_housing_pct,
    )

    return {
        "pwsid": system["pwsid"],
        "score": score,
        "flags": flags,
        "top_issue": top_issue,
        "top_contaminant": top_contaminant,
        "population": pop,
        "open_violations": len(open_violations),
        "lead_risk_tier": lead_tier,
        "pfas_detected": bool(pfas_any or pfas_over_mcl),
    }


_LEAD_TIER_RANK = {"high": 3, "medium": 2, "low": 1, "unknown": 0}


def _income_factor(median_income: int | None) -> float:
    """Multiplier that biases the buyer-opportunity score toward ZIPs with
    higher household income (better candidates for $500–$3k filtration sales).

    Capped so a wealthy ZIP without any water issue can't overtake a
    middle-class ZIP with a PFAS detection.
    """
    if not median_income:
        return 1.0
    if median_income < 40_000:
        return 0.7
    if median_income < 60_000:
        return 0.9
    if median_income < 90_000:
        return 1.1
    if median_income < 125_000:
        return 1.3
    return 1.5


def build_zip_targets(
    systems: list[dict[str, Any]],
    violations_by_pwsid: dict[str, list[dict[str, Any]]],
    lcr_by_pwsid: dict[str, list[dict[str, Any]]],
    service_areas: list[dict[str, Any]],
    ucmr_by_pwsid: dict[str, list[dict[str, Any]]] | None = None,
    demographics_by_zip: dict[str, dict[str, Any]] | None = None,
    out_system_scores: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Roll system-level scores up to one row per ZIP served.

    A single ZIP can be served by multiple water systems; we take the max
    score per system and accumulate. Population is summed but capped (a
    home can only drink from one system, so we avoid double-counting wildly).
    """
    ucmr_by_pwsid = ucmr_by_pwsid or {}
    demographics_by_zip = demographics_by_zip or {}

    # Pre-compute average pre-1980 housing % across the PWSIDs' service areas
    # so lead-tier derivation has a housing signal.
    pwsid_to_zips: dict[str, list[str]] = defaultdict(list)
    for sa in service_areas:
        if sa.get("pwsid") and sa.get("zip_code"):
            pwsid_to_zips[sa["pwsid"]].append(sa["zip_code"])

    def _housing_for(pwsid: str) -> float | None:
        zips = pwsid_to_zips.get(pwsid) or []
        values = [
            demographics_by_zip[z]["pre_1980_housing_pct"]
            for z in zips
            if z in demographics_by_zip
            and demographics_by_zip[z].get("pre_1980_housing_pct") is not None
        ]
        if not values:
            return None
        return sum(values) / len(values)

    system_scores: dict[str, dict[str, Any]] = {}
    for s in systems:
        pwsid = s["pwsid"]
        sc = score_system(
            s,
            violations_by_pwsid.get(pwsid, []),
            lcr_by_pwsid.get(pwsid, []),
            ucmr_results=ucmr_by_pwsid.get(pwsid, []),
            pre_1980_housing_pct=_housing_for(pwsid),
        )
        system_scores[pwsid] = sc
    if out_system_scores is not None:
        out_system_scores.update(system_scores)

    by_zip: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "pwsids": set(),
            "cities": set(),
            "county": None,
            "state": None,
            "raw_score": 0.0,
            "population": 0,
            "top_issue": None,
            "top_contaminant": None,
            "top_score": -1,
            "pfas_detected": False,
            "lead_risk_tier": "unknown",
            "flags": {
                "mcl": False,
                "mrdl": False,
                "tt": False,
                "lcr_lead": False,
                "lcr_copper": False,
                "health_based": False,
                "pfas": False,
                "pfas_mcl": False,
            },
        }
    )

    for sa in service_areas:
        zip_code = (sa.get("zip_code") or "").strip()
        if not zip_code:
            continue
        pwsid = sa.get("pwsid")
        if not pwsid or pwsid not in system_scores:
            continue

        sc = system_scores[pwsid]
        bucket = by_zip[zip_code]
        if pwsid in bucket["pwsids"]:
            continue

        bucket["pwsids"].add(pwsid)
        if sa.get("city"):
            bucket["cities"].add(sa["city"])
        bucket["county"] = bucket["county"] or sa.get("county")
        bucket["state"] = bucket["state"] or sa.get("state")
        bucket["raw_score"] += sc["score"]
        bucket["population"] += sc["population"]
        for k, v in sc["flags"].items():
            if v:
                bucket["flags"][k] = True
        if sc["pfas_detected"]:
            bucket["pfas_detected"] = True
        if _LEAD_TIER_RANK.get(sc["lead_risk_tier"], 0) > _LEAD_TIER_RANK.get(bucket["lead_risk_tier"], 0):
            bucket["lead_risk_tier"] = sc["lead_risk_tier"]
        if sc["score"] > bucket["top_score"] and sc["top_issue"]:
            bucket["top_score"] = sc["score"]
            bucket["top_issue"] = sc["top_issue"]
            bucket["top_contaminant"] = sc["top_contaminant"]

    out: list[dict[str, Any]] = []
    for zip_code, b in by_zip.items():
        pop = b["population"]
        risk = b["raw_score"] * math.log10(max(pop, 1) + 10)
        demo = demographics_by_zip.get(zip_code) or {}
        income = demo.get("median_household_income")
        opp = risk * _income_factor(income)
        city = ", ".join(sorted(b["cities"])) or None
        out.append({
            "zip_code": zip_code,
            "city": city,
            "county": b["county"],
            "state": b["state"],
            "pwsids": sorted(b["pwsids"]),
            "risk_score": round(risk, 2),
            "opportunity_score": round(opp, 2),
            "population_impacted": pop,
            "top_issue": b["top_issue"],
            "top_contaminant": b["top_contaminant"],
            "pfas_detected": bool(b["pfas_detected"]),
            "lead_risk_tier": b["lead_risk_tier"],
            "flags": b["flags"],
            "median_household_income": income,
            "median_home_value": demo.get("median_home_value"),
            "owner_occupied_pct": demo.get("owner_occupied_pct"),
            "pre_1980_housing_pct": demo.get("pre_1980_housing_pct"),
        })

    out.sort(key=lambda z: (z["risk_score"], z["population_impacted"]), reverse=True)
    return out
