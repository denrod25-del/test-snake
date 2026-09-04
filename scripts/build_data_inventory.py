"""
build_data_inventory.py
-----------------------
Generate data/data-inventory.json for data-sources.html and status.html.
Run after scrapes or county page builds:

    python scripts/build_data_inventory.py
"""

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "data-inventory.json"


def load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def permit_status(entry, generated):
    scope = (entry.get("scope") or entry.get("note") or "").lower()
    st = (entry.get("status") or "").lower()
    if any(x in scope for x in ("sample", "illustrative", "demo", "not real")):
        return "sample"
    if st in ("unsupported", "unsupported_paywall"):
        return "blocked"
    if st in ("broken", "error"):
        return "broken"
    if st == "scaffold":
        return "coming-soon"
    if st in ("active", "stale", "manual") and entry.get("permitCount"):
        return "cached"
    if st == "available":
        return "coming-soon"
    return "coming-soon"


def main():
    sources_doc = load_json(ROOT / "data" / "permits" / "sources.json", {})
    index_doc = load_json(ROOT / "data" / "permits" / "index.json", {})
    sales = load_json(ROOT / "sales.json", {})
    stats = load_json(ROOT / "data" / "counties" / "stats.json", {})
    subdiv = load_json(ROOT / "data" / "subdivisions" / "manifest.json", {})
    plats = load_json(ROOT / "data" / "plats" / "manifest.json", {})

    index_by_slug = {e.get("slug"): e for e in (index_doc.get("coverage") or []) if e.get("slug")}
    slug_aliases = {"wpb": "west-palm-beach", "st-lucie": "st-lucie-county", "palm-beach": "palm-beach"}
    generated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    rows = []

    rows.append({
        "category": "Tax deed county links",
        "name": "DeedScout Tax Deeds — 67-county directory",
        "jurisdiction": "Florida statewide",
        "sourceUrl": "https://deedscout.app/tax-deeds.html",
        "status": "cached",
        "count": 67,
        "lastSuccess": stats.get("generated"),
        "lastAttempt": sales.get("generated") or stats.get("salesGenerated"),
        "limitations": "Official clerk, PA, and auction links maintained manually. Sale-date scraper currently failing upstream.",
        "verification": "Official clerk, property appraiser, and auction source required before bidding.",
    })

    rows.append({
        "category": "Auction platforms",
        "name": "Auction platform directory (RealAuction, LienHub, etc.)",
        "jurisdiction": "Florida statewide",
        "sourceUrl": "https://www.realauction.com",
        "status": "broken" if (sales.get("stats") or {}).get("scraped", 0) == 0 else "cached",
        "count": (sales.get("stats") or {}).get("scraped"),
        "lastSuccess": sales.get("generated") if (sales.get("stats") or {}).get("scraped") else None,
        "lastAttempt": sales.get("generated"),
        "limitations": "Automated sale-calendar scrape returning 403 from upstream; platform links remain official.",
        "verification": "Confirm sale list and rules on vendor site before bidding.",
    })

    rows.append({
        "category": "Parcel lookup",
        "name": "DeedScout Parcel Lookup",
        "jurisdiction": "Palm Beach County",
        "sourceUrl": "https://opendata2-pbcgov.opendata.arcgis.com/",
        "status": "cached",
        "count": None,
        "lastSuccess": None,
        "lastAttempt": None,
        "limitations": "Query-time GIS lookup to PBC ArcGIS; not a bulk cached export.",
        "verification": "Cross-check parcel ID and owner with Property Appraiser.",
    })

    for src in sources_doc.get("sources") or []:
        sid = src.get("id")
        idx_slug = slug_aliases.get(sid, sid)
        idx = index_by_slug.get(idx_slug) or {}
        st = permit_status({**src, **idx, "scope": src.get("scope") or idx.get("scope")}, sources_doc.get("generated"))
        rows.append({
            "category": "Permit search",
            "name": src.get("label"),
            "jurisdiction": f"{src.get('city') or src.get('county') or 'FL'}, Florida",
            "sourceUrl": src.get("portalUrl"),
            "status": st,
            "count": idx.get("permitCount"),
            "lastSuccess": idx.get("lastUpdated") or sources_doc.get("generated"),
            "lastAttempt": index_doc.get("generated") or sources_doc.get("generated"),
            "limitations": src.get("scope") or idx.get("scope") or "",
            "verification": "Sample or blocked — use official portal manually." if st in ("sample", "blocked") else "Cached municipal scrape — verify on official portal before outreach.",
        })

    subdiv_count = len((subdiv or {}).get("names") or {})
    subdiv_ts = None
    if subdiv and subdiv.get("names"):
        subdiv_ts = next(iter(subdiv["names"].values()), {}).get("last_seen")
    rows.append({
        "category": "Subdivision index",
        "name": "DeedScout Subdivision Index",
        "jurisdiction": "Palm Beach County",
        "sourceUrl": "https://deedscout.app/subdivision-index.html",
        "status": "cached",
        "count": subdiv_count or None,
        "lastSuccess": subdiv_ts,
        "lastAttempt": subdiv_ts,
        "limitations": "Cached reference index from public records; not live clerk filings.",
        "verification": "Verify legal description with clerk or property appraiser.",
    })

    plat_count = len((plats or {}).get("plat_ids") or {})
    plat_ts = None
    if plats and plats.get("plat_ids"):
        plat_ts = next(iter(plats["plat_ids"].values()), {}).get("last_seen")
    rows.append({
        "category": "Plat index",
        "name": "DeedScout Plat Index",
        "jurisdiction": "Palm Beach County",
        "sourceUrl": "https://deedscout.app/plat-index.html",
        "status": "cached",
        "count": plat_count or None,
        "lastSuccess": plat_ts,
        "lastAttempt": plat_ts,
        "limitations": "Plat PDF sheets from PBC; OCR names may contain errors.",
        "verification": "Use recorded plat at clerk.",
    })

    rows.append({
        "category": "Surplus funds",
        "name": "Surplus funds registry links",
        "jurisdiction": "Florida counties (where published)",
        "sourceUrl": "https://deedscout.app/tax-deeds.html#/surplus",
        "status": "cached",
        "count": sum(1 for c in (stats.get("counties") or {}).values() if c.get("surplusPortal")),
        "lastSuccess": stats.get("generated"),
        "lastAttempt": stats.get("generated"),
        "limitations": "Curated county surplus claim portal links; not automated filing.",
        "verification": "Follow county surplus claim procedures and deadlines.",
    })

    doc = {"generated": generated, "rows": rows}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} inventory rows to {OUT}")


if __name__ == "__main__":
    main()
