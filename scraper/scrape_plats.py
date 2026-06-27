"""
scrape_plats.py
---------------
Scrapes the Palm Beach County PZB Plat Map Index (PDF links per book).

Run:
    cd scraper
    python scrape_plats.py
    python scrape_plats.py --recent-books 20   # books with highest numbers only

Output:
    ../data/plats/palm-beach.json
    ../data/plats/palm-beach-diff.json
    ../data/plats/manifest.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

HERE = Path(__file__).parent
ROOT = HERE.parent
OUTPUT_PATH = ROOT / "data" / "plats" / "palm-beach.json"
DIFF_PATH = ROOT / "data" / "plats" / "palm-beach-diff.json"
MANIFEST_PATH = ROOT / "data" / "plats" / "manifest.json"

MAIN_URL = "https://discover.pbc.gov/pzb/Pages/Plats.aspx"
BOOK_URL = "https://discover.pbc.gov/pzb/Plats/{book}.aspx"
CROSS_REF_PDF = "https://discover.pbc.gov/pzb/PDF/plat_index.pdf"

HEADERS = {
    "User-Agent": "PBCPlatIndex/1.0 (+local research tool)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
REQUEST_TIMEOUT = 45
DELAY_SECONDS = 0.25
NEW_THIS_MONTH_DAYS = 30

PDF_LINK_RE = re.compile(
    r'href="(https://discover\.pbc\.gov/pzb/[^"]+\.pdf)"[^>]*>([^<]+)</a>',
    re.I,
)
BOOK_LINK_RE = re.compile(r"/pzb/Plats/(\d+)\.aspx", re.I)


def load_json_file(path: Path) -> dict | None:
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def fetch_books(session: requests.Session) -> list[str]:
    r = session.get(MAIN_URL, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    books = sorted({m.group(1) for m in BOOK_LINK_RE.finditer(r.text)}, key=lambda x: int(x))
    if not books:
        raise RuntimeError("No plat books found on PZB index page")
    return books


def scrape_book(session: requests.Session, book: str) -> list[dict]:
    url = BOOK_URL.format(book=book)
    r = session.get(url, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    rows: list[dict] = []
    seen: set[str] = set()
    for pdf_url, label in PDF_LINK_RE.findall(r.text):
        plat_id = label.strip()
        if not plat_id or plat_id in seen:
            continue
        if "/Plats-" not in pdf_url and "plat" not in pdf_url.lower():
            continue
        seen.add(plat_id)
        rows.append(
            {
                "plat_id": plat_id,
                "book": str(int(book)),
                "pdf_url": pdf_url,
            }
        )
    return rows


def update_manifest(plats: list[dict], now_iso: str, new_ids: set[str], prev_generated: str | None) -> dict:
    manifest = load_json_file(MANIFEST_PATH)
    if manifest is None:
        manifest = {"plat_ids": {}, "baseline_at": prev_generated or now_iso}

    entries: dict = manifest.setdefault("plat_ids", {})
    known_seed = prev_generated or manifest.get("baseline_at") or now_iso

    for row in plats:
        pid = row["plat_id"]
        if pid not in entries:
            entries[pid] = {
                "first_seen": now_iso if pid in new_ids else known_seed,
                "last_seen": now_iso,
                "book": row["book"],
                "pdf_url": row["pdf_url"],
            }
        else:
            entries[pid]["last_seen"] = now_iso
            entries[pid]["book"] = row["book"]
            entries[pid]["pdf_url"] = row["pdf_url"]
            entries[pid].pop("removed_at", None)

    current = {row["plat_id"] for row in plats}
    for pid, entry in entries.items():
        if pid not in current and "removed_at" not in entry:
            entry["removed_at"] = now_iso

    manifest["updatedAt"] = now_iso
    return manifest


def apply_diff(
    payload: dict,
    prev_by_id: dict[str, dict],
    prev_generated: str | None,
    manifest: dict,
) -> dict:
    now_iso = payload["generated"]
    now_dt = datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    month_cutoff = now_dt - timedelta(days=NEW_THIS_MONTH_DAYS)
    manifest_ids = manifest.get("plat_ids", {})

    current_ids = {p["plat_id"] for p in payload["plats"]}
    prev_ids = set(prev_by_id.keys())
    new_ids = set() if prev_generated is None else current_ids - prev_ids
    removed_ids = prev_ids - current_ids if prev_generated else set()

    new_rows: list[dict] = []
    new_this_month = 0

    for row in payload["plats"]:
        pid = row["plat_id"]
        entry = manifest_ids.get(pid, {})
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
                    is_new_this_month = False
        row["is_new_this_month"] = is_new_this_month
        if is_new_this_month:
            new_this_month += 1

        if pid in new_ids:
            row["is_new"] = True
            new_rows.append({k: row[k] for k in ("plat_id", "book", "pdf_url")})
        else:
            row["is_new"] = False

    removed_rows = [
        {
            "plat_id": prev_by_id[pid]["plat_id"],
            "book": prev_by_id[pid].get("book"),
            "pdf_url": prev_by_id[pid].get("pdf_url"),
            "last_seen_run": prev_generated,
        }
        for pid in sorted(removed_ids)
    ]

    diff_payload = {
        "generated": now_iso,
        "previous_run": prev_generated,
        "baseline_at": manifest.get("baseline_at"),
        "new_count": len(new_rows),
        "removed_count": len(removed_rows),
        "new_this_month_count": new_this_month,
        "new": sorted(new_rows, key=lambda x: x["plat_id"]),
        "removed": removed_rows,
        "notes": [
            "Plat sheet IDs (e.g. 130-053) link to recorded plat PDFs at PZB.",
            "New sheets often appear on the county roll before SUBDIV_NAME hits the PAO GIS index.",
        ],
    }

    payload["version"] = 1
    payload["stats"]["new_since_last_run"] = len(new_rows)
    payload["stats"]["removed_since_last_run"] = len(removed_rows)
    payload["stats"]["new_this_month"] = new_this_month
    payload["stats"]["previous_run"] = prev_generated
    return diff_payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape PBC PZB plat PDF index")
    parser.add_argument(
        "--recent-books",
        type=int,
        default=0,
        help="Only scrape the N highest-numbered books (0 = all)",
    )
    args = parser.parse_args()

    session = requests.Session()
    session.headers.update(HEADERS)

    prev = load_json_file(OUTPUT_PATH)
    prev_by_id = {p["plat_id"]: p for p in (prev or {}).get("plats", [])}
    prev_generated = (prev or {}).get("generated")

    print("Fetching plat book list from PZB…")
    books = fetch_books(session)
    if args.recent_books > 0:
        books = books[-args.recent_books :]
        print(f"  Scraping {len(books)} recent books (--recent-books {args.recent_books})")
    else:
        print(f"  Scraping all {len(books)} books")

    all_plats: list[dict] = []
    for i, book in enumerate(books, 1):
        try:
            rows = scrape_book(session, book)
            all_plats.extend(rows)
            print(f"  [{i:3d}/{len(books)}] book {book:>3s}  {len(rows):4d} plats  total {len(all_plats):5d}")
        except requests.RequestException as exc:
            print(f"  [{i:3d}/{len(books)}] book {book:>3s}  FAILED: {exc}")
        time.sleep(DELAY_SECONDS)

    if args.recent_books > 0 and prev_by_id:
        merged = {p["plat_id"]: p for p in prev_by_id.values()}
        for row in all_plats:
            merged[row["plat_id"]] = row
        all_plats = sorted(merged.values(), key=lambda x: (int(x["book"]), x["plat_id"]))

    all_plats.sort(key=lambda x: (int(x["book"]), x["plat_id"]))
    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    books_seen = sorted({int(p["book"]) for p in all_plats})
    payload = {
        "county": "Palm Beach",
        "state": "FL",
        "generated": now_iso,
        "source": "Palm Beach County Planning, Zoning & Building — Plat Map Index",
        "sourceUrl": MAIN_URL,
        "crossReferencePdf": CROSS_REF_PDF,
        "stats": {
            "plat_count": len(all_plats),
            "book_count": len(books_seen),
            "books": books_seen,
        },
        "plats": all_plats,
    }

    current_ids = {p["plat_id"] for p in all_plats}
    new_ids = set() if prev_generated is None else current_ids - set(prev_by_id.keys())
    manifest = update_manifest(all_plats, now_iso, new_ids, prev_generated)
    diff_payload = apply_diff(payload, prev_by_id, prev_generated, manifest)

    write_json(MANIFEST_PATH, manifest)
    write_json(DIFF_PATH, diff_payload)
    write_json(OUTPUT_PATH, payload)

    stats = payload["stats"]
    print(
        f"\nDone. {stats['plat_count']:,} plat PDFs across {stats['book_count']} books. "
        f"Diff: {stats['new_since_last_run']} new, {stats['removed_since_last_run']} removed, "
        f"{stats['new_this_month']} new this month."
    )
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
