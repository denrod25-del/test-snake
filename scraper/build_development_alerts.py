"""
build_development_alerts.py
---------------------------
Cross-links new subdivisions + new plat sheets with cached permit data.
Produces alerts consumed by permit-search.html and subdivision-index.html.

Run after scrape_subdivisions.py (and ideally scrape_plats.py):
    cd scraper
    python build_development_alerts.py

Output: ../data/subdivisions/alerts.json
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

HERE = Path(__file__).parent
ROOT = HERE.parent
SUBDIV_PATH = ROOT / "data" / "subdivisions" / "palm-beach.json"
SUBDIV_DIFF_PATH = ROOT / "data" / "subdivisions" / "palm-beach-diff.json"
PLAT_DIFF_PATH = ROOT / "data" / "plats" / "palm-beach-diff.json"
PLAT_EXTRACT_INDEX = ROOT / "data" / "plats" / "extract-index.json"
PERMITS_DIR = ROOT / "data" / "permits"
OUTPUT_PATH = ROOT / "data" / "subdivisions" / "alerts.json"

STOPWORDS = {
    "PL", "PLAT", "NO", "OF", "THE", "AND", "PHASE", "COND", "CONDO",
    "REPL", "IN", "ADD", "PB", "PGS", "PUD", "MUPD", "UNREC", "THRU",
    "PAR", "AT", "FOR", "TO", "A", "AN", "OR",
}


def load_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def significant_tokens(name: str) -> list[str]:
    raw = re.findall(r"[A-Z0-9]{4,}", name.upper())
    return [t for t in raw if t not in STOPWORDS and not t.isdigit()]


def normalize_city(city: str | None) -> str:
    return (city or "").upper().strip()


def load_all_permits() -> list[dict]:
    permits: list[dict] = []
    skip = {"index.json", "sources.json"}
    for path in sorted(PERMITS_DIR.glob("*.json")):
        if path.name in skip:
            continue
        try:
            data = load_json(path) or {}
        except json.JSONDecodeError:
            continue
        source_city = (data.get("city") or "").upper()
        if data.get("permitsByParcel"):
            for arr in data["permitsByParcel"].values():
                for p in arr or []:
                    permits.append(flatten_permit(p, source_city, path.stem))
        elif isinstance(data.get("permits"), list):
            for p in data["permits"]:
                permits.append(flatten_permit(p, source_city, path.stem))
    return permits


def flatten_permit(p: dict, source_city: str, source_slug: str) -> dict:
    address = (p.get("address") or "").strip()
    city = extract_city(address) or source_city
    parts = [
        p.get("permitNumber"),
        address,
        p.get("type"),
        p.get("subtype"),
        p.get("description"),
        p.get("contractor"),
        p.get("applicantName"),
        p.get("status"),
    ]
    blob = " ".join(str(x) for x in parts if x).upper()
    return {
        "permitNumber": (p.get("permitNumber") or "").strip(),
        "address": address,
        "city": city,
        "type": (p.get("type") or "").strip(),
        "description": (p.get("description") or "") or None,
        "status": (p.get("status") or "").strip(),
        "appliedDate": p.get("appliedDate"),
        "valuation": p.get("valuation"),
        "dataSource": source_slug,
        "searchBlob": blob,
    }


def extract_city(addr: str) -> str:
    if not addr:
        return ""
    parts = [s.strip() for s in addr.split(",") if s.strip()]
    if len(parts) >= 3:
        return parts[-2].upper()
    return ""


def match_permits(subdiv: dict, permits: list[dict], limit: int = 25) -> list[dict]:
    name_u = subdiv["name"].upper()
    tokens = significant_tokens(name_u)
    city = normalize_city(subdiv.get("primary_municipality"))
    matches: list[dict] = []

    for p in permits:
        blob = p["searchBlob"]
        p_city = normalize_city(p.get("city"))

        if name_u in blob:
            matches.append(p)
            continue

        if len(tokens) >= 2 and sum(1 for t in tokens if t in blob) >= min(2, len(tokens)):
            if not city or city == "UNKNOWN" or city in blob or p_city == city:
                matches.append(p)
                continue

        if len(tokens) == 1 and tokens[0] in blob:
            if not city or city == "UNKNOWN" or p_city == city:
                matches.append(p)

    matches.sort(key=lambda x: x.get("appliedDate") or "", reverse=True)
    slim = []
    for p in matches[:limit]:
        slim.append(
            {
                "permitNumber": p["permitNumber"],
                "address": p["address"],
                "city": p.get("city"),
                "type": p["type"],
                "status": p["status"],
                "appliedDate": p.get("appliedDate"),
                "valuation": p.get("valuation"),
                "dataSource": p["dataSource"],
            }
        )
    return slim


def main() -> int:
    subdiv_data = load_json(SUBDIV_PATH)
    subdiv_diff = load_json(SUBDIV_DIFF_PATH) or {}
    plat_diff = load_json(PLAT_DIFF_PATH) or {}

    if not subdiv_data:
        print("Missing palm-beach.json — run scrape_subdivisions.py first.")
        return 1

    by_name = {s["name"].upper(): s for s in subdiv_data.get("subdivisions", [])}
    new_names = {r["name"].upper() for r in (subdiv_diff.get("new") or [])}

    watch_subdivs: list[dict] = []
    seen: set[str] = set()
    for key in new_names:
        row = by_name.get(key)
        if row and key not in seen:
            watch_subdivs.append(row)
            seen.add(key)
    for row in subdiv_data.get("subdivisions", []):
        key = row["name"].upper()
        if key in seen:
            continue
        if row.get("is_new") or row.get("is_new_this_month"):
            watch_subdivs.append(row)
            seen.add(key)

    permits = load_all_permits()
    print(f"Loaded {len(permits):,} cached permits for alert matching…")

    alerts: list[dict] = []
    total_permit_hits = 0
    for subdiv in watch_subdivs:
        if subdiv.get("is_new") or subdiv["name"].upper() in new_names:
            reason = "new_since_last_scrape"
        elif subdiv.get("is_new_this_month"):
            reason = "new_this_month"
        else:
            reason = "watchlist"

        permit_matches = match_permits(subdiv, permits)
        total_permit_hits += len(permit_matches)
        alerts.append(
            {
                "name": subdiv["name"],
                "primary_municipality": subdiv.get("primary_municipality"),
                "parcel_count": subdiv.get("parcel_count", 0),
                "residential_pct": subdiv.get("residential_pct"),
                "investor_pct": subdiv.get("investor_pct"),
                "first_seen": subdiv.get("first_seen"),
                "reason": reason,
                "is_new": bool(subdiv.get("is_new")),
                "is_new_this_month": bool(subdiv.get("is_new_this_month")),
                "permit_count": len(permit_matches),
                "permits": permit_matches,
                "links": {
                    "parcels": f"parcel-lookup.html?subdiv={subdiv['name']}",
                    "permits": f"permit-search.html?watchSubdiv={subdiv['name']}",
                    "subdivision_index": f"subdivision-index.html?q={subdiv['name']}",
                },
            }
        )

    extract_index = load_json(PLAT_EXTRACT_INDEX) or {}
    extract_by_plat = extract_index.get("plats") or {}

    new_plats_raw = plat_diff.get("new") or []
    new_plats: list[dict] = []
    for p in new_plats_raw:
        ext = extract_by_plat.get(p["plat_id"]) or {}
        enriched = dict(p)
        enriched["primary_name"] = ext.get("primary_name")
        enriched["subdivision_names"] = ext.get("subdivision_names") or []
        enriched["matched_subdivisions"] = ext.get("matched_subdivisions") or []
        enriched["name_method"] = ext.get("method")
        if enriched["subdivision_names"] or enriched["primary_name"]:
            enriched["links"] = {
                "pdf": p.get("pdf_url"),
                "plat_index": f"plat-index.html?q={p['plat_id']}",
            }
            if enriched["matched_subdivisions"]:
                enriched["links"]["subdivision_index"] = (
                    f"subdivision-index.html?q={enriched['matched_subdivisions'][0]}"
                )
                enriched["links"]["permits"] = (
                    f"permit-search.html?watchSubdiv={enriched['matched_subdivisions'][0]}"
                )
        new_plats.append(enriched)

    payload = {
        "generated": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "subdivisions_generated": subdiv_data.get("generated"),
        "subdivisions_previous_run": subdiv_diff.get("previous_run"),
        "summary": {
            "new_subdivisions_since_last_scrape": subdiv_diff.get("new_count", 0),
            "new_plats_since_last_scrape": plat_diff.get("new_count", 0),
            "new_plats_with_ocr_names": sum(1 for p in new_plats if p.get("subdivision_names")),
            "watch_subdivision_count": len(alerts),
            "permits_matched": total_permit_hits,
        },
        "new_subdivisions": alerts,
        "new_plats": new_plats,
        "notes": [
            "Permit matches are heuristic (subdivision name tokens + city). Verify on the ground.",
            "New plat PDFs at PZB may precede SUBDIV_NAME appearing on the PAO tax roll.",
            "Run scrape_plats.py + scrape_subdivisions.py monthly, then this script.",
        ],
    }

    write_json(OUTPUT_PATH, payload)
    s = payload["summary"]
    print(
        f"Wrote {OUTPUT_PATH.relative_to(ROOT)} — "
        f"{s['watch_subdivision_count']} watch subdivisions, "
        f"{s['new_plats_since_last_scrape']} new plats, "
        f"{s['permits_matched']} permit matches."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
