"""Homeowner-facing outreach copy for water-filtration sales.

All copy quotes the public EPA SDWIS record so the claim is verifiable --
that's the entire pitch hook. No scare tactics, no made-up health claims.

When a ZIP is served by multiple utilities with materially different risk
profiles (e.g. 33414, where Wellington WTP has no PFAS while Seminole
Improvement District is above the new PFOS MCL), we partition the ZIP into
sub-areas and render copy specific to each sub-area's evidence. Sending the
same "PFAS above MCL!" ad to both groups would embarrass us when a
Wellington homeowner looks up their utility and finds no PFAS on record.
"""
from __future__ import annotations

import os
from typing import Any

BRAND = {
    "company": os.getenv("BRAND_COMPANY_NAME", "ClearStream Water"),
    "name":    os.getenv("BRAND_CONTACT_NAME", "Alex"),
    "phone":   os.getenv("BRAND_PHONE", "(561) 555-0199"),
    "website": os.getenv("BRAND_WEBSITE", "https://clearstream.example"),
    "price":   os.getenv("BRAND_OFFER_PRICE", "299"),
}

# --- PFAS MCL thresholds (EPA final rule, April 2024, ng/L = ppt) ---
_PFAS_MCL_NG_L = {
    "PFOA": 4.0, "PFOS": 4.0, "PFHXS": 10.0, "PFNA": 10.0,
    "HFPO-DA": 10.0, "GENX": 10.0,
}

# Rank of sub-area signatures from most to least actionable. Sub-areas are
# sorted this way so the strongest pitch surfaces first.
_SIGNATURE_RANK = {
    "pfas_mcl": 6,
    "lead_exceedance": 5,
    "mcl_violation": 4,
    "pfas_detected": 3,
    "monitoring_issue": 2,
    "clean": 1,
    "unknown": 0,
}


def envirofacts_url(pwsid: str) -> str:
    return f"https://enviro.epa.gov/envirofacts/sdwis/search/form?pwsid={pwsid}"


# --- unit + number helpers -------------------------------------------------


def _to_ng_per_l(value: float, unit: str | None) -> float | None:
    """Normalize an analytical measure to ng/L so PFAS MCL comparisons are
    meaningful. EPA's PFOA/PFOS MCL is 4 ng/L; UCMR 5 usually reports in
    µg/L (ppb), which needs *1000."""
    if value is None:
        return None
    u = (unit or "").lower().strip()
    if u in ("ug/l", "ppb", "mcg/l", "\xb5g/l", "µg/l"):
        return float(value) * 1000
    if u in ("ng/l", "ppt"):
        return float(value)
    if u in ("mg/l", "ppm"):
        return float(value) * 1_000_000
    return float(value)


def _lead_ugl(sample: dict[str, Any] | None) -> float | None:
    """Convert an LCR sample to µg/L. SDWIS reports lead in mg/L; 15 µg/L
    is the EPA action level."""
    if not sample or sample.get("value") is None:
        return None
    v = float(sample["value"])
    u = (sample.get("unit") or "mg/l").lower().strip()
    if u in ("mg/l", "ppm"):
        return v * 1000.0
    if u in ("ug/l", "ppb", "\xb5g/l", "µg/l"):
        return v
    return v * 1000.0


def _fmt_city_list(cities: list[str]) -> str:
    if not cities:
        return ""
    cleaned = [c.title() for c in cities if c]
    if len(cleaned) == 1:
        return cleaned[0]
    if len(cleaned) == 2:
        return f"{cleaned[0]} and {cleaned[1]}"
    return ", ".join(cleaned[:-1]) + f", and {cleaned[-1]}"


# --- risk signatures -------------------------------------------------------


def _system_signature(
    system: dict[str, Any],
    pfas_by_pwsid: dict[str, list[dict[str, Any]]],
) -> str:
    """Classify a system into one of the signature buckets used for
    sub-area grouping. More severe signatures win when a system qualifies
    for multiple."""
    pfas_rows = pfas_by_pwsid.get(system["pwsid"], [])
    if any(r.get("exceeds_mcl") for r in pfas_rows):
        return "pfas_mcl"
    if system.get("lcr_exceedances") or system.get("lead_risk_tier") == "high":
        return "lead_exceedance"
    if system.get("open_health_violations"):
        return "mcl_violation"
    if pfas_rows:
        return "pfas_detected"
    if system.get("open_violations"):
        return "monitoring_issue"
    return "clean"


# --- per-signature evidence + phrasing -------------------------------------


def _evidence_for(
    signature: str,
    systems: list[dict[str, Any]],
    pfas_rows: list[dict[str, Any]],
    flagged_contaminants: list[dict[str, Any]],
) -> dict[str, Any]:
    """Pull the strongest concrete number we can cite for a sub-area."""
    ev: dict[str, Any] = {
        "signature": signature,
        "headline_number": None,     # e.g. "PFOS at 11 ng/L"
        "mcl_reference":   None,     # e.g. "EPA MCL: 4 ng/L"
        "multiplier":      None,     # e.g. "2.75×"
        "issue_phrase":    "",
        "severity":        "low",
        "date":            None,
        "analyte":         None,
    }

    if signature == "pfas_mcl" and pfas_rows:
        worst = None
        worst_ratio = 0.0
        for r in pfas_rows:
            if not r.get("exceeds_mcl"):
                continue
            analyte = (r.get("contaminant") or "").upper()
            ng = _to_ng_per_l(r.get("sample_measure"), r.get("unit_of_measure"))
            if ng is None:
                continue
            mcl = next(
                (v for k, v in _PFAS_MCL_NG_L.items() if k in analyte), None
            )
            if mcl and ng / mcl > worst_ratio:
                worst_ratio = ng / mcl
                worst = {"analyte": analyte, "ng": ng, "mcl": mcl, "row": r}
        if worst:
            ev["analyte"] = worst["analyte"]
            ev["headline_number"] = f"{worst['analyte']} at {worst['ng']:.1f} ng/L"
            ev["mcl_reference"] = f"EPA MCL: {worst['mcl']:.0f} ng/L"
            ev["multiplier"] = f"{worst['ng'] / worst['mcl']:.1f}\u00d7"
            ev["issue_phrase"] = (
                f"PFAS above the EPA limit \u2014 "
                f"{worst['analyte']} at {worst['ng']:.1f} ng/L "
                f"({ev['multiplier']} the federal MCL of {worst['mcl']:.0f} ng/L)"
            )
            ev["severity"] = "high"
            ev["date"] = worst["row"].get("collection_date")
        return ev

    if signature == "lead_exceedance":
        worst_ugl = 0.0
        worst_date = None
        for s in systems:
            ls = s.get("worst_lead_sample")
            ugl = _lead_ugl(ls)
            if ugl is not None and ugl > worst_ugl:
                worst_ugl = ugl
                worst_date = (ls or {}).get("date")
        if worst_ugl > 0:
            ev["headline_number"] = f"Lead at {worst_ugl:.1f} \u00b5g/L"
            ev["mcl_reference"] = "EPA action level: 15 \u00b5g/L"
            if worst_ugl >= 15:
                ev["multiplier"] = f"{worst_ugl / 15:.1f}\u00d7"
                ev["issue_phrase"] = (
                    f"a lead sample at {worst_ugl:.1f} \u00b5g/L \u2014 "
                    f"above the EPA action level of 15 \u00b5g/L"
                )
                ev["severity"] = "high"
            else:
                ev["issue_phrase"] = (
                    f"measurable lead in recent samples (up to {worst_ugl:.1f} "
                    f"\u00b5g/L; EPA is lowering the action level to 10 \u00b5g/L "
                    f"under the 2024 Lead and Copper Rule Improvements)"
                )
                ev["severity"] = "medium"
            ev["date"] = worst_date
        else:
            ev["issue_phrase"] = "a lead action-level exceedance in the Lead and Copper Rule record"
            ev["severity"] = "high"
        return ev

    if signature == "mcl_violation":
        contam = next(
            (
                c for c in flagged_contaminants
                if any(c.get("pwsid") == s["pwsid"] for s in systems)
                and (c.get("category") or "").upper() in ("MCL", "MRDL")
            ),
            None,
        )
        if contam:
            ev["analyte"] = contam.get("contaminant_code")
            ev["issue_phrase"] = (
                f"an active {contam.get('category') or 'MCL'} violation for "
                f"contaminant code {contam.get('contaminant_code') or 'unknown'}"
            )
            ev["date"] = contam.get("begin_date")
        else:
            ev["issue_phrase"] = "an active health-based drinking water violation on EPA record"
        ev["severity"] = "high"
        return ev

    if signature == "pfas_detected" and pfas_rows:
        worst = max(
            (r for r in pfas_rows if r.get("sample_measure")),
            key=lambda r: _to_ng_per_l(r.get("sample_measure"), r.get("unit_of_measure")) or 0,
            default=None,
        )
        if worst:
            ng = _to_ng_per_l(worst.get("sample_measure"), worst.get("unit_of_measure")) or 0
            ev["analyte"] = (worst.get("contaminant") or "").upper()
            ev["headline_number"] = f"{ev['analyte']} at {ng:.1f} ng/L"
            ev["issue_phrase"] = (
                f"PFAS detected \u2014 {ev['analyte']} at {ng:.1f} ng/L "
                f"under the EPA MCL but confirmed present in UCMR 5 testing"
            )
            ev["date"] = worst.get("collection_date")
            ev["severity"] = "medium"
        return ev

    if signature == "monitoring_issue":
        ev["issue_phrase"] = (
            "active monitoring and reporting items on its EPA filings (not a "
            "contaminant exceedance, but an administrative compliance gap)"
        )
        ev["severity"] = "low"
        return ev

    if signature == "clean":
        ev["issue_phrase"] = "no active violations on EPA record today"
        ev["severity"] = "low"
    return ev


# --- per-subarea rendering -------------------------------------------------


def _sub_label(signature: str, cities: list[str]) -> str:
    city_s = _fmt_city_list(cities) or "Unassigned"
    name = {
        "pfas_mcl":         "PFAS above EPA limit",
        "lead_exceedance":  "Elevated lead in Lead & Copper Rule samples",
        "mcl_violation":    "Active health-based violation",
        "pfas_detected":    "PFAS detected below MCL",
        "monitoring_issue": "Administrative / reporting issues only",
        "clean":            "No active issues on record",
        "unknown":          "Unknown",
    }.get(signature, signature)
    return f"{city_s} — {name}"


def _render_copy(ctx: dict[str, Any]) -> dict[str, str]:
    """Render the five channel templates from a fully prepared context."""
    b = BRAND
    city       = ctx["city_phrase"]
    utility    = ctx["utility_phrase"]
    issue      = ctx["issue_phrase"]
    epa_link   = ctx["epa_link"]
    zip_code   = ctx["zip_code"]
    population = ctx["population"]
    headline   = ctx.get("headline_number")
    mcl_ref    = ctx.get("mcl_reference")
    date       = ctx.get("date")
    signature  = ctx["signature"]
    lead_copper = signature in ("lead_exceedance",) or "lead" in issue.lower()
    pfas_focus  = signature in ("pfas_mcl", "pfas_detected")

    date_clause = f" (sample dated {date})" if date else ""
    filter_line = (
        f"NSF/ANSI 53-certified lead-reducing filters start at ${b['price']} installed."
        if lead_copper and not pfas_focus else
        f"NSF/ANSI 53 + 58 reverse-osmosis systems that remove PFOA/PFOS start at ${b['price']} installed."
        if pfas_focus else
        f"Under-sink and whole-home systems start at ${b['price']} installed."
    )
    evidence_bullet = (
        f"\n\u2022 {headline}{' \u2014 ' + mcl_ref if mcl_ref else ''}{date_clause}"
        if headline else ""
    )

    door_hanger = (
        f"HAVE YOU SEEN YOUR WATER REPORT?\n\n"
        f"EPA records show {utility} \u2014 the utility serving {city} "
        f"(ZIP {zip_code}) \u2014 reported {issue}.{evidence_bullet}\n\n"
        f"{filter_line}\n\n"
        f"Verify the record yourself: {epa_link}\n\n"
        f"Questions? Text or call {b['name']} at {b['phone']}.\n"
        f"{b['company']} \u2014 {b['website']}"
    )

    postcard = (
        f"{city} neighbors: the EPA's Safe Drinking Water record for "
        f"{utility} shows {issue}.{evidence_bullet}\n\n"
        f"We install NSF-certified filters that address it \u2014 "
        f"starting at ${b['price']}.\n\n"
        f"Verify the EPA record \u2192 [QR CODE: {epa_link}]\n"
        f"Call or text {b['phone']} for a free water test."
    )

    if signature == "pfas_mcl" and headline:
        fb_headline = f"EPA tested your water. {headline.replace(' at ', ': ')}."
    elif signature == "lead_exceedance" and headline:
        fb_headline = f"{city} lead samples: {headline}. Action level is 15 \u00b5g/L."
    elif signature == "mcl_violation":
        fb_headline = f"{city} water: active EPA violation on record"
    elif signature == "pfas_detected":
        fb_headline = f"PFAS detected in {city} drinking water (EPA UCMR 5)"
    elif signature == "monitoring_issue":
        fb_headline = f"{city} water utility has open EPA reporting items"
    else:
        fb_headline = f"{city} water: know what's in your tap"

    fb_body = (
        f"The EPA's public record for {utility} shows {issue}.{evidence_bullet}\n\n"
        f"We install NSF-certified filters that remove the contaminant \u2014 "
        f"systems from ${b['price']}. Read the EPA record: {epa_link}\n\n"
        f"Targeting: {city}, ZIP {zip_code}"
        f"{' (approx. ' + f'{population:,}' + ' residents on this system)' if population else ''}."
    )

    nextdoor = (
        f"Neighbors \u2014 I was reviewing our water utility's EPA filings and "
        f"wanted to share what I found.\n\n"
        f"{utility}, which serves {city} (ZIP {zip_code}), has {issue} on "
        f"file with EPA.{evidence_bullet}\n\n"
        f"Source: {epa_link}\n\n"
        f"I run {b['company']}, a small local shop that installs NSF-certified "
        f"filters. Happy to do a free water test at your home, no obligation. "
        f"Reply or text {b['phone']}.\n\n"
        f"(Posting with the EPA link so everyone can verify \u2014 not trying "
        f"to scare anyone.)"
    )

    if signature == "pfas_mcl" and ctx.get("analyte"):
        email_subject = f"EPA recorded {ctx['analyte']} above the new federal limit at your water utility"
    elif signature == "lead_exceedance":
        email_subject = "EPA flagged elevated lead at your water utility"
    elif signature == "mcl_violation":
        email_subject = "Active EPA violation at your drinking water utility"
    else:
        email_subject = "Your water utility's latest EPA record"

    email = (
        f"Hi \u2014 I'm {b['name']} with {b['company']}, here in {city}.\n\n"
        f"I noticed that {utility} (the PWS that serves ZIP {zip_code}) has "
        f"{issue} on its EPA Safe Drinking Water Information System record."
        f"{evidence_bullet}\n\n"
        f"The record is here: {epa_link}\n\n"
        f"A point-of-use filter certified to the relevant NSF standard "
        f"removes the contaminant. Our installed systems start at "
        f"${b['price']}, and I'm happy to do a free 15-minute water test at "
        f"your kitchen tap \u2014 no pressure, no follow-up if the numbers "
        f"come back clean.\n\n"
        f"Reply to this email or text {b['phone']}.\n\n"
        f"\u2014 {b['name']}\n"
        f"{b['company']} \u2014 {b['website']}"
    )

    return {
        "door_hanger":          door_hanger,
        "postcard":             postcard,
        "facebook_ad_headline": fb_headline,
        "facebook_ad_body":     fb_body,
        "nextdoor_post":        nextdoor,
        "email_subject":        email_subject,
        "email":                email,
    }


# --- public entry point ----------------------------------------------------


def render_zip_templates(zip_target: dict[str, Any]) -> dict[str, Any]:
    """Return templates keyed by channel, plus per-sub-area variants when the
    ZIP is served by utilities with materially different risk profiles.

    Top-level keys (door_hanger, postcard, ...) are preserved so the existing
    frontend still works; they render from the most actionable sub-area so
    the one-click default is the strongest pitch.
    """
    zip_code = zip_target.get("zip_code", "")
    systems = zip_target.get("systems") or []
    pfas_results = zip_target.get("pfas_results") or []
    flagged_contams = zip_target.get("flagged_contaminants") or []

    pfas_by_pwsid: dict[str, list[dict[str, Any]]] = {}
    for r in pfas_results:
        pfas_by_pwsid.setdefault(r.get("pwsid") or "", []).append(r)

    # Group systems by signature.
    groups: dict[str, list[dict[str, Any]]] = {}
    for s in systems:
        sig = _system_signature(s, pfas_by_pwsid)
        groups.setdefault(sig, []).append(s)

    fallback_city = zip_target.get("city") or f"ZIP {zip_code}"
    fallback_pwsid = (zip_target.get("pwsids") or [""])[0]
    fallback_link = envirofacts_url(fallback_pwsid) if fallback_pwsid else \
        "https://enviro.epa.gov/envirofacts/sdwis/"

    subareas: list[dict[str, Any]] = []
    for signature, sys_list in groups.items():
        cities: list[str] = []
        for s in sys_list:
            for c in s.get("service_cities") or []:
                if c and c not in cities:
                    cities.append(c)
        if not cities and fallback_city:
            cities = [fallback_city]

        rel_pfas = [
            r for r in pfas_results
            if r.get("pwsid") in {s["pwsid"] for s in sys_list}
        ]
        ev = _evidence_for(signature, sys_list, rel_pfas, flagged_contams)

        primary = sys_list[0]
        population = sum(s.get("population_served") or 0 for s in sys_list)

        others = len(sys_list) - 1
        if others == 0:
            utility_phrase = primary.get("name") or "your local water utility"
        elif others == 1:
            utility_phrase = (
                f"{primary.get('name') or 'your local water utility'} "
                f"(plus 1 other utility in the area)"
            )
        else:
            utility_phrase = (
                f"{primary.get('name') or 'your local water utility'} "
                f"(plus {others} other utilities in the area)"
            )

        ctx = {
            "zip_code":         zip_code,
            "city_phrase":      _fmt_city_list(cities) or fallback_city,
            "utility_phrase":   utility_phrase,
            "issue_phrase":     ev.get("issue_phrase") or "drinking water items on EPA record",
            "epa_link":         envirofacts_url(primary["pwsid"]) if primary.get("pwsid") else fallback_link,
            "population":       population,
            "headline_number":  ev.get("headline_number"),
            "mcl_reference":    ev.get("mcl_reference"),
            "date":             ev.get("date"),
            "signature":        signature,
            "analyte":          ev.get("analyte"),
        }

        subareas.append({
            "signature":         signature,
            "label":             _sub_label(signature, cities),
            "cities":            cities,
            "pwsids":            [s["pwsid"] for s in sys_list],
            "systems":           [
                {"pwsid": s["pwsid"], "name": s.get("name"),
                 "population_served": s.get("population_served")}
                for s in sys_list
            ],
            "population":        population,
            "severity":          ev.get("severity"),
            "evidence":          ev,
            "epa_link":          ctx["epa_link"],
            "recommended":       signature not in ("clean",),
            "templates":         _render_copy(ctx),
            "inputs": {
                "zip_code":       zip_code,
                "city":           ctx["city_phrase"],
                "utility":        primary.get("name") or "",
                "primary_pwsid":  primary.get("pwsid") or "",
                "population":     population,
                "epa_link":       ctx["epa_link"],
                "issue":          ctx["issue_phrase"],
                "flags":          zip_target.get("flags") or {},
                "brand":          BRAND,
            },
        })

    # Sort strongest pitch first.
    subareas.sort(key=lambda s: _SIGNATURE_RANK.get(s["signature"], 0), reverse=True)

    # Top-level convenience copy = strongest sub-area's templates so existing
    # UI keeps rendering a sensible default.
    if subareas:
        default = subareas[0]
        default_templates = dict(default["templates"])
        default_inputs = dict(default["inputs"])
    else:
        default_templates = _render_copy({
            "zip_code":        zip_code,
            "city_phrase":     fallback_city,
            "utility_phrase":  "your local water utility",
            "issue_phrase":    "no active issues on record",
            "epa_link":        fallback_link,
            "population":      zip_target.get("population_impacted") or 0,
            "signature":       "clean",
        })
        default_inputs = {
            "zip_code":      zip_code, "city": fallback_city,
            "utility":       "", "primary_pwsid": fallback_pwsid,
            "population":    zip_target.get("population_impacted") or 0,
            "epa_link":      fallback_link, "issue": "no active issues",
            "flags":         zip_target.get("flags") or {}, "brand": BRAND,
        }

    return {
        "inputs":    default_inputs,
        "subareas":  subareas,
        **default_templates,
    }
