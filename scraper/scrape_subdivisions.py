"""
scrape_subdivisions.py
----------------------
Builds a searchable index of legal subdivision names for Palm Beach County
from the public Property Appraiser ArcGIS FeatureServer.

Phase 2 adds municipality cross-reference plus contractor/investor signals.
Phase 3 diffs each run against the previous index and a rolling manifest:
  - is_new / palm-beach-diff.json  → names that appeared since the last scrape
  - is_new_this_month              → first_seen within the last 30 days (manifest)

Run:
    cd scraper
    pip install -r requirements.txt
    python scrape_subdivisions.py

Output:
    ../data/subdivisions/palm-beach.json
    ../data/subdivisions/palm-beach-diff.json
    ../data/subdivisions/manifest.json
"""

from __future__ import annotations

import json
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

import requests

HERE = Path(__file__).parent
ROOT = HERE.parent
OUTPUT_PATH = ROOT / "data" / "subdivisions" / "palm-beach.json"
DIFF_PATH = ROOT / "data" / "subdivisions" / "palm-beach-diff.json"
MANIFEST_PATH = ROOT / "data" / "subdivisions" / "manifest.json"
NEW_THIS_MONTH_DAYS = 30

ENDPOINT = (
    "https://services1.arcgis.com/zsFpTOq1dFgzIjQg/arcgis/rest/services/"
    "CollectionDays_Parcels/FeatureServer/21/query"
)
HEADERS = {
    "User-Agent": "PBCSubdivisionIndex/1.0 (+local research tool)",
    "Accept": "application/json",
}
PAGE_SIZE = 2000
REQUEST_TIMEOUT = 120
DELAY_SECONDS = 0.35
NAMED_WHERE = "SUBDIV_NAME IS NOT NULL AND SUBDIV_NAME<>''"

TAG_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("condo", re.compile(r"\bCONDO\b|\bCONDOMINIUM\b", re.I)),
    ("plat", re.compile(r"\bPL\b|\bPLAT\b|\bPL NO\b", re.I)),
    ("unrecorded", re.compile(r"\bUNREC\b|\bUNRECORDED\b", re.I)),
    ("replatted", re.compile(r"\bREPL\b|\bREPLAT\b", re.I)),
    ("mupd", re.compile(r"\bMUPD\b|\bPUD\b", re.I)),
    ("address_based", re.compile(r"^\d+\s+[NSEW]", re.I)),
]

RESIDENTIAL_USES = {
    "single_family",
    "multi_family",
    "condo",
    "mobile",
    "townhouse",
}


def classify_name(name: str) -> list[str]:
    tags: list[str] = []
    for tag, pattern in TAG_PATTERNS:
        if pattern.search(name):
            tags.append(tag)
    if not tags:
        tags.append("subdivision")
    return tags


def normalize_municipality(raw: str | None) -> str:
    if not raw or not str(raw).strip():
        return "Unknown"
    name = str(raw).strip()
    if name.upper() in {"COUNTY OF PALM BEACH", "UNINCORPORATED", "PBC UNINCORPORATED"}:
        return "Unincorporated"
    return name.title() if name.isupper() else name


def classify_property_use(use: str | None) -> str:
    u = (use or "").upper().strip()
    if not u:
        return "other"
    if "SINGLE FAMILY" in u or u == "SFR":
        return "single_family"
    if "CONDO" in u or "CONDOMINIUM" in u:
        return "condo"
    if "VACANT" in u:
        return "vacant"
    if any(x in u for x in ("MULTI", "APART", "DUPLEX", "TRIPLEX", "QUAD", "TOWNHOUSE")):
        return "multi_family"
    if any(x in u for x in ("MOBILE", "MANUFACT")):
        return "mobile"
    if any(
        x in u
        for x in (
            "COMMERCIAL",
            "OFFIC",
            "RETAIL",
            "WAREH",
            "INDUST",
            "MEDIC",
            "STORE",
            "REST",
            "HOTEL",
            "MOTEL",
            "INSTIT",
            "GOVERN",
            "UTIL",
            "AGRI",
        )
    ):
        return "commercial"
    return "other"


def pct(n: int, total: int) -> float | None:
    if total <= 0:
        return None
    return round(100 * n / total, 1)


def fetch_grouped(group_fields: str, where: str = NAMED_WHERE, label: str = "") -> list[dict]:
    rows: list[dict] = []
    offset = 0
    prefix = f"[{label}] " if label else ""

    while True:
        params = {
            "where": where,
            "groupByFieldsForStatistics": group_fields,
            "outStatistics": json.dumps(
                [
                    {
                        "statisticType": "count",
                        "onStatisticField": "OBJECTID",
                        "outStatisticFieldName": "parcel_count",
                    }
                ]
            ),
            "f": "json",
            "resultOffset": offset,
            "resultRecordCount": PAGE_SIZE,
        }
        url = f"{ENDPOINT}?{urlencode(params)}"
        r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            raise RuntimeError(data["error"])

        batch = data.get("features") or []
        for feat in batch:
            attrs = feat.get("attributes") or {}
            row = {"parcel_count": int(attrs.get("parcel_count") or 0)}
            for field in group_fields.split(","):
                row[field.strip()] = attrs.get(field.strip())
            rows.append(row)

        print(
            f"{prefix}offset {offset:6d}  batch {len(batch):4d}  "
            f"total {len(rows):6d}  exceeded={data.get('exceededTransferLimit')}"
        )

        if not data.get("exceededTransferLimit") or not batch:
            break

        offset += PAGE_SIZE
        time.sleep(DELAY_SECONDS)

    return rows


def canonical_subdiv_name(raw: str | None) -> str | None:
    name = (raw or "").strip()
    return name or None


def merge_subdivisions(
    base_rows: list[dict],
    muni_rows: list[dict],
    use_rows: list[dict],
    hmstd_rows: list[dict],
) -> tuple[list[dict], dict]:
    merged: dict[str, dict] = {}

    for row in base_rows:
        name = canonical_subdiv_name(row.get("SUBDIV_NAME"))
        if not name:
            continue
        key = name.upper()
        if key not in merged:
            merged[key] = {
                "name": name,
                "parcel_count": 0,
                "tags": classify_name(name),
                "_municipalities": Counter(),
                "_use": Counter(),
                "_homestead_yes": 0,
                "_homestead_no": 0,
            }
        merged[key]["parcel_count"] += row["parcel_count"]

    for row in muni_rows:
        name = canonical_subdiv_name(row.get("SUBDIV_NAME"))
        if not name:
            continue
        key = name.upper()
        if key not in merged:
            continue
        muni = normalize_municipality(row.get("MUNICIPALITY"))
        merged[key]["_municipalities"][muni] += row["parcel_count"]

    for row in use_rows:
        name = canonical_subdiv_name(row.get("SUBDIV_NAME"))
        if not name:
            continue
        key = name.upper()
        if key not in merged:
            continue
        bucket = classify_property_use(row.get("PROPERTY_USE"))
        merged[key]["_use"][bucket] += row["parcel_count"]

    for row in hmstd_rows:
        name = canonical_subdiv_name(row.get("SUBDIV_NAME"))
        if not name:
            continue
        key = name.upper()
        if key not in merged:
            continue
        flag = (row.get("HMSTD_FLG") or "").strip().upper()
        if flag == "Y":
            merged[key]["_homestead_yes"] += row["parcel_count"]
        else:
            merged[key]["_homestead_no"] += row["parcel_count"]

    subdivisions: list[dict] = []
    municipality_totals: Counter = Counter()

    for entry in merged.values():
        total = entry["parcel_count"]
        munis = entry["_municipalities"]
        use = entry["_use"]
        hs_yes = entry["_homestead_yes"]
        hs_no = entry["_homestead_no"]
        hs_total = hs_yes + hs_no

        municipalities = [
            {
                "name": name,
                "parcel_count": count,
                "pct": pct(count, total),
            }
            for name, count in munis.most_common()
        ]
        primary = municipalities[0]["name"] if municipalities else "Unknown"
        municipality_totals[primary] += 1

        residential = sum(use.get(k, 0) for k in RESIDENTIAL_USES)
        use_summary = {
            "single_family": use.get("single_family", 0),
            "multi_family": use.get("multi_family", 0),
            "condo": use.get("condo", 0),
            "mobile": use.get("mobile", 0),
            "vacant": use.get("vacant", 0),
            "commercial": use.get("commercial", 0),
            "other": use.get("other", 0),
        }

        subdivisions.append(
            {
                "name": entry["name"],
                "parcel_count": total,
                "tags": entry["tags"],
                "primary_municipality": primary,
                "municipality_count": len(municipalities),
                "municipalities": municipalities,
                "residential_parcels": residential,
                "residential_pct": pct(residential, total),
                "use_summary": use_summary,
                "homestead_parcels": hs_yes,
                "homestead_pct": pct(hs_yes, hs_total) if hs_total else None,
                "investor_parcels": hs_no,
                "investor_pct": pct(hs_no, hs_total) if hs_total else None,
            }
        )

    subdivisions.sort(key=lambda x: (-x["parcel_count"], x["name"].upper()))

    extra_stats = {
        "municipality_subdivision_counts": dict(
            sorted(municipality_totals.items(), key=lambda x: (-x[1], x[0]))
        ),
    }
    return subdivisions, extra_stats


def build_index(
    base_rows: list[dict],
    muni_rows: list[dict],
    use_rows: list[dict],
    hmstd_rows: list[dict],
    unnamed_count: int,
) -> dict:
    subdivisions, extra_stats = merge_subdivisions(base_rows, muni_rows, use_rows, hmstd_rows)
    tag_counts = Counter(tag for s in subdivisions for tag in s["tags"])

    residential_heavy = sum(1 for s in subdivisions if (s.get("residential_pct") or 0) >= 80)
    investor_heavy = sum(1 for s in subdivisions if (s.get("investor_pct") or 0) >= 50)

    return {
        "county": "Palm Beach",
        "state": "FL",
        "version": 2,
        "generated": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": (
            "Palm Beach County Property Appraiser — CollectionDays_Parcels "
            "FeatureServer layer 21 (public ArcGIS Open Data)"
        ),
        "sourceUrl": "https://opendata2-pbcgov.opendata.arcgis.com/",
        "endpoint": ENDPOINT,
        "stats": {
            "named_subdivisions": len(subdivisions),
            "parcels_with_subdivision_name": sum(s["parcel_count"] for s in subdivisions),
            "parcels_without_subdivision_name": unnamed_count,
            "tag_counts": dict(sorted(tag_counts.items())),
            "subdivisions_80pct_residential": residential_heavy,
            "subdivisions_50pct_investor": investor_heavy,
            **extra_stats,
        },
        "subdivisions": subdivisions,
        "notes": [
            "SUBDIV_NAME is the legal plat/subdivision label on the tax roll, not necessarily the marketing or HOA community name.",
            "primary_municipality is where most parcels in the subdivision sit; some span city lines.",
            "residential_pct is derived from PROPERTY_USE buckets (single-family, multi-family, condo, mobile).",
            "homestead_pct / investor_pct use HMSTD_FLG (Y = owner-occupied homestead). Non-homestead is a rough investor/landlord proxy, not a deed-verified investor count.",
            "Future plats not yet recorded on parcels will not appear until the Property Appraiser updates the roll.",
        ],
    }


def load_json_file(path: Path) -> dict | None:
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_previous_index() -> tuple[dict[str, dict], str | None]:
    prev = load_json_file(OUTPUT_PATH)
    if not prev:
        return {}, None
    by_key = {s["name"].upper(): s for s in prev.get("subdivisions", [])}
    return by_key, prev.get("generated")


def subdiv_summary(row: dict) -> dict:
    return {
        "name": row["name"],
        "primary_municipality": row.get("primary_municipality"),
        "parcel_count": row.get("parcel_count", 0),
        "residential_pct": row.get("residential_pct"),
        "investor_pct": row.get("investor_pct"),
        "tags": row.get("tags", []),
    }


def update_manifest(
    subdivisions: list[dict],
    now_iso: str,
    new_keys: set[str],
    prev_generated: str | None,
) -> dict:
    manifest = load_json_file(MANIFEST_PATH)
    if manifest is None:
        manifest = {"names": {}, "baseline_at": prev_generated or now_iso}

    names: dict = manifest.setdefault("names", {})
    known_seed = prev_generated or manifest.get("baseline_at") or now_iso

    for row in subdivisions:
        key = row["name"].upper()
        if key not in names:
            names[key] = {
                "display_name": row["name"],
                "first_seen": now_iso if key in new_keys else known_seed,
                "last_seen": now_iso,
            }
        else:
            names[key]["last_seen"] = now_iso
            names[key]["display_name"] = row["name"]
            if "removed_at" in names[key]:
                del names[key]["removed_at"]

    current_keys = {row["name"].upper() for row in subdivisions}
    for key, entry in names.items():
        if key not in current_keys and "removed_at" not in entry:
            entry["removed_at"] = now_iso

    manifest["updatedAt"] = now_iso
    return manifest


def apply_diff(
    payload: dict,
    prev_by_key: dict[str, dict],
    prev_generated: str | None,
    manifest: dict,
) -> dict:
    now_iso = payload["generated"]
    now_dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    month_cutoff = now_dt - timedelta(days=NEW_THIS_MONTH_DAYS)
    manifest_names = manifest.get("names", {})

    current_keys = {row["name"].upper() for row in payload["subdivisions"]}
    prev_keys = set(prev_by_key.keys())
    new_keys = set() if prev_generated is None else current_keys - prev_keys
    removed_keys = prev_keys - current_keys if prev_generated else set()

    new_since_run: list[dict] = []
    removed_since_run: list[dict] = []
    new_this_month_count = 0

    for row in payload["subdivisions"]:
        key = row["name"].upper()
        entry = manifest_names.get(key, {})
        first_seen = entry.get("first_seen")
        row["first_seen"] = first_seen

        is_new_this_month = False
        if first_seen:
            fs_dt = datetime.fromisoformat(first_seen.replace("Z", "+00:00"))
            if fs_dt >= month_cutoff:
                if prev_generated:
                    pg_dt = datetime.fromisoformat(prev_generated.replace("Z", "+00:00"))
                    is_new_this_month = fs_dt > pg_dt
                else:
                    is_new_this_month = True
        row["is_new_this_month"] = is_new_this_month
        if is_new_this_month:
            new_this_month_count += 1

        if key in new_keys:
            row["is_new"] = True
            new_since_run.append(subdiv_summary(row))
        else:
            row["is_new"] = False

    for key in sorted(removed_keys):
        prev = prev_by_key[key]
        removed_since_run.append(
            {
                "name": prev["name"],
                "primary_municipality": prev.get("primary_municipality"),
                "parcel_count": prev.get("parcel_count", 0),
                "last_seen_run": prev_generated,
            }
        )

    diff_payload = {
        "generated": now_iso,
        "previous_run": prev_generated,
        "baseline_at": manifest.get("baseline_at"),
        "new_count": len(new_since_run),
        "removed_count": len(removed_since_run),
        "new_this_month_count": new_this_month_count,
        "new": sorted(new_since_run, key=lambda x: (-x["parcel_count"], x["name"])),
        "removed": removed_since_run,
        "notes": [
            "new = subdivision names absent from the previous palm-beach.json scrape.",
            "new_this_month_count uses manifest first_seen within the last 30 days.",
            "Removed names may reflect PAO relabeling or data cleanup, not demolition.",
        ],
    }

    payload["version"] = 3
    payload["stats"]["new_since_last_run"] = len(new_since_run)
    payload["stats"]["removed_since_last_run"] = len(removed_since_run)
    payload["stats"]["new_this_month"] = new_this_month_count
    payload["stats"]["previous_run"] = prev_generated
    return diff_payload


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main() -> int:
    print("Phase 3 — fetching subdivision data + diff vs previous run…\n")

    prev_by_key, prev_generated = load_previous_index()
    if prev_generated:
        print(f"Previous index: {prev_generated} ({len(prev_by_key):,} names)\n")
    else:
        print("No previous index — this run establishes the baseline.\n")

    print("1/4 Subdivision totals…")
    all_subdiv_rows = fetch_grouped("SUBDIV_NAME", where="1=1", label="subdiv")
    unnamed_count = sum(r["parcel_count"] for r in all_subdiv_rows if not canonical_subdiv_name(r.get("SUBDIV_NAME")))
    base_rows = [r for r in all_subdiv_rows if canonical_subdiv_name(r.get("SUBDIV_NAME"))]

    print("\n2/4 Municipality cross-reference…")
    muni_rows = fetch_grouped("SUBDIV_NAME,MUNICIPALITY", label="muni")

    print("\n3/4 Property use mix…")
    use_rows = fetch_grouped("SUBDIV_NAME,PROPERTY_USE", label="use")

    print("\n4/4 Homestead / investor proxy…")
    hmstd_rows = fetch_grouped("SUBDIV_NAME,HMSTD_FLG", label="hmstd")

    payload = build_index(base_rows, muni_rows, use_rows, hmstd_rows, unnamed_count)
    now_iso = payload["generated"]

    current_keys = {row["name"].upper() for row in payload["subdivisions"]}
    prev_keys = set(prev_by_key.keys())
    new_keys = current_keys - prev_keys

    manifest = update_manifest(payload["subdivisions"], now_iso, new_keys, prev_generated)
    diff_payload = apply_diff(payload, prev_by_key, prev_generated, manifest)

    write_json(MANIFEST_PATH, manifest)
    write_json(DIFF_PATH, diff_payload)
    write_json(OUTPUT_PATH, payload)

    stats = payload["stats"]
    print(
        f"\nDone. {stats['named_subdivisions']:,} subdivisions across "
        f"{len(stats['municipality_subdivision_counts']):,} municipalities."
    )
    print(
        f"  {stats['subdivisions_80pct_residential']:,} are >=80% residential "
        f"({stats['subdivisions_50pct_investor']:,} are >=50% non-homestead)."
    )
    print(
        f"  Diff: {stats['new_since_last_run']:,} new since last run, "
        f"{stats['removed_since_last_run']:,} removed, "
        f"{stats['new_this_month']:,} new this month."
    )
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)}")
    print(f"Wrote {DIFF_PATH.relative_to(ROOT)}")
    print(f"Wrote {MANIFEST_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
