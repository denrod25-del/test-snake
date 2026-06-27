"""
extract_plat_names.py
---------------------
OCR plat PDFs (scanned images) and extract subdivision / development names.

Uses PyMuPDF + RapidOCR (no Tesseract). Caches per-plat JSON under
data/plats/extracts/ and builds data/plats/extract-index.json for the UI.

Run:
    cd scraper
    python extract_plat_names.py                  # new plats since last scrape
    python extract_plat_names.py --plat-id 130-001
    python extract_plat_names.py --recent-books 2 --limit 10
    python extract_plat_names.py --backfill --limit 50

Typical OCR time: ~2 min/page at 1.25x scale on this machine — keep --limit low
for interactive runs; CI only processes new plat PDFs from the monthly diff.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import fitz
import numpy as np
import requests
from rapidocr_onnxruntime import RapidOCR

from plat_name_parser import parse_subdivision_names, pick_primary_name

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

HERE = Path(__file__).parent
ROOT = HERE.parent
PLAT_INDEX_PATH = ROOT / "data" / "plats" / "palm-beach.json"
PLAT_DIFF_PATH = ROOT / "data" / "plats" / "palm-beach-diff.json"
SUBDIV_PATH = ROOT / "data" / "subdivisions" / "palm-beach.json"
EXTRACTS_DIR = ROOT / "data" / "plats" / "extracts"
CACHE_DIR = ROOT / "data" / "plats" / "cache"
INDEX_PATH = ROOT / "data" / "plats" / "extract-index.json"

HEADERS = {
    "User-Agent": "PBCPlatOCR/1.0 (+local research tool)",
    "Accept": "application/pdf,*/*",
}
REQUEST_TIMEOUT = 120
OCR_SCALE = 1.25
MAX_PAGES = 1

STOPWORDS = {
    "PL", "PLAT", "NO", "OF", "THE", "AND", "PHASE", "COND", "CONDO",
    "REPL", "IN", "ADD", "PB", "PGS", "PUD", "MUPD", "UNREC", "THRU",
    "PAR", "AT", "FOR", "TO", "A", "AN", "OR", "REPLAT", "VILLAGE", "CITY",
    "TOWN", "BEACH", "PALM", "COUNTY", "FLORIDA", "ONE", "TWO", "THREE",
    "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "SOUTH", "NORTH",
    "EAST", "WEST", "BRIDGES", "PORTION", "HALF", "MODEL", "LAND", "COMPANY",
}

MATCH_SOURCES = {"pud", "subdivision_line", "replat_of", "plat_of", "quoted", "title_block", "primary"}


def _name_ok_for_match(name: str) -> bool:
    return bool(name) and len(name) >= 6 and len(re.findall(r"[A-Z]", name.upper())) >= 4


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


def match_subdivisions(names: list[dict], subdiv_by_name: dict[str, dict], primary: str | None = None) -> list[str]:
    """Return PAO SUBDIV_NAME values that fuzzy-match OCR names."""
    hits: set[str] = set()
    ordered: list[dict] = []
    if primary and _name_ok_for_match(primary):
        ordered.append({"name": primary, "source": "primary"})
    for entry in names:
        if entry.get("source") not in MATCH_SOURCES:
            continue
        nm = entry.get("name", "")
        if not _name_ok_for_match(nm):
            continue
        if primary and nm == primary and ordered:
            continue
        ordered.append(entry)

    for entry in ordered:
        ocr_name = entry["name"].upper()
        if ocr_name in subdiv_by_name:
            hits.add(subdiv_by_name[ocr_name]["name"])
            continue
        tokens = significant_tokens(ocr_name)
        if not tokens:
            continue
        for subdiv_name, row in subdiv_by_name.items():
            subdiv_tokens = significant_tokens(subdiv_name)
            if not subdiv_tokens:
                continue
            if ocr_name in subdiv_name or subdiv_name.startswith(ocr_name):
                hits.add(row["name"])
                continue
            overlap = [t for t in tokens if t in subdiv_name or t in subdiv_tokens]
            need = min(2, len(tokens))
            if len(overlap) >= need and all(len(t) >= 5 for t in overlap[:need]):
                hits.add(row["name"])
            elif len(tokens) == 1 and len(tokens[0]) >= 8 and tokens[0] in subdiv_name:
                hits.add(row["name"])
    return sorted(hits)


def download_pdf(url: str, dest: Path, session: requests.Session) -> None:
    if dest.exists() and dest.stat().st_size > 500:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = session.get(url, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    dest.write_bytes(r.content)


def extract_text_native(pdf_path: Path, max_pages: int) -> list[str]:
    lines: list[str] = []
    doc = fitz.open(pdf_path)
    for page_num in range(min(max_pages, len(doc))):
        text = doc[page_num].get_text("text")
        for ln in text.splitlines():
            ln = ln.strip()
            if ln:
                lines.append(ln)
    return lines


def ocr_pdf(pdf_path: Path, ocr: RapidOCR, scale: float, max_pages: int) -> tuple[list[str], str]:
    doc = fitz.open(pdf_path)
    lines: list[str] = []
    for page_num in range(min(max_pages, len(doc))):
        page = doc[page_num]
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        result, _ = ocr(img)
        for item in result or []:
            lines.append(str(item[1]))
    return lines, "ocr"


def process_plat(
    plat: dict,
    ocr: RapidOCR,
    session: requests.Session,
    subdiv_by_name: dict[str, dict],
    *,
    scale: float,
    max_pages: int,
    force: bool,
) -> dict:
    plat_id = plat["plat_id"]
    extract_path = EXTRACTS_DIR / f"{plat_id}.json"
    if extract_path.exists() and not force:
        return load_json(extract_path) or {}

    pdf_path = CACHE_DIR / f"{plat_id}.pdf"
    t0 = time.time()
    method = "none"
    ocr_lines: list[str] = []

    try:
        download_pdf(plat["pdf_url"], pdf_path, session)
        native = extract_text_native(pdf_path, max_pages)
        if len(native) >= 5:
            ocr_lines = native
            method = "native_text"
        else:
            ocr_lines, method = ocr_pdf(pdf_path, ocr, scale, max_pages)
    except Exception as exc:
        payload = {
            "plat_id": plat_id,
            "book": plat.get("book"),
            "pdf_url": plat.get("pdf_url"),
            "extracted_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "method": "error",
            "error": str(exc),
            "subdivision_names": [],
            "primary_name": None,
            "matched_subdivisions": [],
            "duration_sec": round(time.time() - t0, 1),
        }
        write_json(extract_path, payload)
        return payload

    names = parse_subdivision_names(ocr_lines)
    primary = pick_primary_name(names)
    matched = match_subdivisions(names, subdiv_by_name, primary)

    payload = {
        "plat_id": plat_id,
        "book": plat.get("book"),
        "pdf_url": plat.get("pdf_url"),
        "extracted_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "method": method,
        "ocr_scale": scale if method == "ocr" else None,
        "ocr_line_count": len(ocr_lines),
        "subdivision_names": names,
        "primary_name": primary,
        "matched_subdivisions": matched,
        "duration_sec": round(time.time() - t0, 1),
    }
    write_json(extract_path, payload)
    return payload


def build_extract_index(extracts: dict[str, dict], plat_index: dict | None) -> dict:
    with_names = sum(1 for e in extracts.values() if e.get("subdivision_names"))
    matched = sum(1 for e in extracts.values() if e.get("matched_subdivisions"))
    return {
        "generated": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": "PBC PZB plat PDF OCR (PyMuPDF + RapidOCR)",
        "plat_index_generated": (plat_index or {}).get("generated"),
        "stats": {
            "extracted_count": len(extracts),
            "with_names_count": with_names,
            "matched_subdiv_count": matched,
        },
        "plats": {
            pid: {
                "primary_name": e.get("primary_name"),
                "subdivision_names": [n["name"] for n in (e.get("subdivision_names") or [])],
                "name_details": e.get("subdivision_names") or [],
                "matched_subdivisions": e.get("matched_subdivisions") or [],
                "method": e.get("method"),
                "extracted_at": e.get("extracted_at"),
                "error": e.get("error"),
            }
            for pid, e in sorted(extracts.items())
        },
    }


def load_existing_extracts() -> dict[str, dict]:
    out: dict[str, dict] = {}
    if not EXTRACTS_DIR.exists():
        return out
    for path in EXTRACTS_DIR.glob("*.json"):
        data = load_json(path)
        if data and data.get("plat_id"):
            out[data["plat_id"]] = data
    return out


def select_plats(
    all_plats: list[dict],
    *,
    plat_id: str | None,
    recent_books: int,
    new_only: bool,
    backfill: bool,
    limit: int,
    existing: dict[str, dict],
) -> list[dict]:
    if plat_id:
        return [p for p in all_plats if p["plat_id"] == plat_id]

    candidates = list(all_plats)

    if recent_books > 0:
        books = sorted({int(p["book"]) for p in all_plats})
        keep = set(str(b) for b in books[-recent_books:])
        candidates = [p for p in candidates if p["book"] in keep]

    if new_only and not backfill:
        diff = load_json(PLAT_DIFF_PATH) or {}
        new_ids = {r["plat_id"] for r in diff.get("new") or []}
        if new_ids:
            candidates = [p for p in candidates if p["plat_id"] in new_ids]
        else:
            candidates = [p for p in candidates if p.get("is_new")]

    if not backfill:
        candidates = [p for p in candidates if p["plat_id"] not in existing]

    if limit > 0:
        candidates = candidates[:limit]

    return candidates


def merge_into_plat_index(plat_index: dict, extracts: dict[str, dict]) -> None:
    for row in plat_index.get("plats", []):
        ext = extracts.get(row["plat_id"])
        if not ext:
            continue
        row["primary_name"] = ext.get("primary_name")
        row["subdivision_names"] = [n["name"] for n in (ext.get("subdivision_names") or [])]
        row["matched_subdivisions"] = ext.get("matched_subdivisions") or []
        row["name_extracted_at"] = ext.get("extracted_at")
        row["name_method"] = ext.get("method")


def main() -> int:
    parser = argparse.ArgumentParser(description="OCR PBC plat PDFs for subdivision names")
    parser.add_argument("--plat-id", help="Process a single plat ID (e.g. 130-001)")
    parser.add_argument("--recent-books", type=int, default=0, help="Limit to N highest book numbers")
    parser.add_argument("--limit", type=int, default=0, help="Max plats to process (0 = no cap)")
    parser.add_argument("--new-only", action="store_true", help="Only plats new since last scrape (CI default)")
    parser.add_argument("--backfill", action="store_true", help="Re-process even if extract exists")
    parser.add_argument("--force", action="store_true", help="Force re-OCR (with --backfill or single plat)")
    parser.add_argument("--scale", type=float, default=OCR_SCALE, help="OCR render scale (default 1.25)")
    parser.add_argument("--pages", type=int, default=MAX_PAGES, help="Max pages to OCR per PDF")
    parser.add_argument("--reindex", action="store_true", help="Rebuild index from cached extracts (no OCR)")
    parser.add_argument("--skip-index-merge", action="store_true", help="Do not rewrite palm-beach.json")
    args = parser.parse_args()

    plat_index = load_json(PLAT_INDEX_PATH)
    if not plat_index:
        print(f"Missing {PLAT_INDEX_PATH.relative_to(ROOT)} — run scrape_plats.py first.")
        return 1

    subdiv_data = load_json(SUBDIV_PATH) or {}
    subdiv_by_name = {s["name"].upper(): s for s in subdiv_data.get("subdivisions", [])}

    if args.reindex:
        extracts = load_existing_extracts()
        for pid, ext in extracts.items():
            names = ext.get("subdivision_names") or []
            primary = pick_primary_name(names)
            ext["primary_name"] = primary
            ext["matched_subdivisions"] = match_subdivisions(names, subdiv_by_name, primary)
            write_json(EXTRACTS_DIR / f"{pid}.json", ext)
        write_json(INDEX_PATH, build_extract_index(extracts, plat_index))
        if not args.skip_index_merge:
            merge_into_plat_index(plat_index, extracts)
            stats = plat_index.setdefault("stats", {})
            stats["names_extracted"] = len(extracts)
            stats["names_with_subdivisions"] = sum(1 for e in extracts.values() if e.get("subdivision_names"))
            write_json(PLAT_INDEX_PATH, plat_index)
        print(f"Reindexed {len(extracts)} cached extracts.")
        return 0

    all_plats = plat_index.get("plats") or []

    existing = {} if args.backfill or args.force else load_existing_extracts()
    # Monthly CI passes --new-only; local runs use --plat-id / --recent-books / --limit.
    new_only = args.new_only or not (
        args.plat_id or args.recent_books or args.limit or args.backfill
    )

    targets = select_plats(
        all_plats,
        plat_id=args.plat_id,
        recent_books=args.recent_books,
        new_only=new_only,
        backfill=args.backfill or args.force,
        limit=args.limit,
        existing=existing,
    )

    if not targets:
        print("No plat PDFs queued for extraction (all cached or none match filters).")
        extracts = load_existing_extracts()
        write_json(INDEX_PATH, build_extract_index(extracts, plat_index))
        return 0

    print(f"Processing {len(targets)} plat PDF(s) at scale {args.scale}…")
    session = requests.Session()
    session.headers.update(HEADERS)
    ocr = RapidOCR()
    # Warm-up pass (loads ONNX models).
    _ = ocr(np.zeros((32, 32, 3), dtype=np.uint8))

    extracts = load_existing_extracts()
    for i, plat in enumerate(targets, 1):
        pid = plat["plat_id"]
        print(f"  [{i}/{len(targets)}] {pid} …", end=" ", flush=True)
        result = process_plat(
            plat,
            ocr,
            session,
            subdiv_by_name,
            scale=args.scale,
            max_pages=args.pages,
            force=args.force or args.backfill,
        )
        extracts[pid] = result
        names = [n["name"] for n in (result.get("subdivision_names") or [])]
        primary = result.get("primary_name") or "(none)"
        print(f"{result.get('method')} {result.get('duration_sec')}s — {primary}" + (f" (+{len(names)-1})" if len(names) > 1 else ""))

    index_payload = build_extract_index(extracts, plat_index)
    write_json(INDEX_PATH, index_payload)

    if not args.skip_index_merge:
        merge_into_plat_index(plat_index, extracts)
        stats = plat_index.setdefault("stats", {})
        stats["names_extracted"] = index_payload["stats"]["extracted_count"]
        stats["names_with_subdivisions"] = index_payload["stats"]["with_names_count"]
        write_json(PLAT_INDEX_PATH, plat_index)

    s = index_payload["stats"]
    print(
        f"\nDone. {s['extracted_count']} extracts on disk, "
        f"{s['with_names_count']} with names, {s['matched_subdiv_count']} matched PAO subdivisions."
    )
    print(f"Wrote {INDEX_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
