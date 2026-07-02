"""
health_check.py — lightweight scraper/data health for DeedScout static site.

Exit 0 when all checks pass; exit 1 with stderr summary otherwise.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        return exc


def age_hours(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).total_seconds() / 3600
    except ValueError:
        return None


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    required = [
        ROOT / "data" / "county-links.json",
        ROOT / "data" / "data-inventory.json",
        ROOT / "data" / "permits" / "index.json",
        ROOT / "data" / "permits" / "sources.json",
    ]
    for path in required:
        if not path.exists():
            errors.append(f"missing required file: {path.relative_to(ROOT)}")

    links = load_json(ROOT / "data" / "county-links.json")
    if isinstance(links, Exception):
        errors.append(f"county-links.json unreadable: {links}")
    elif len(links) < 67:
        errors.append(f"county-links.json has {len(links)} counties, expected 67")

    inventory = load_json(ROOT / "data" / "data-inventory.json")
    if isinstance(inventory, Exception):
        errors.append(f"data-inventory.json unreadable: {inventory}")
    elif not (inventory.get("rows") or []):
        errors.append("data-inventory.json has no rows")

    permits_index = load_json(ROOT / "data" / "permits" / "index.json")
    if isinstance(permits_index, Exception):
        errors.append(f"permits/index.json unreadable: {permits_index}")
    else:
        active = [c for c in (permits_index.get("coverage") or []) if c.get("status") == "active"]
        if not active:
            warnings.append("no active permit coverage entries")
        gen_age = age_hours(permits_index.get("generated"))
        if gen_age is not None and gen_age > 24 * 14:
            warnings.append(f"permits index generated {gen_age:.0f}h ago (>14d)")

    sources = load_json(ROOT / "data" / "permits" / "sources.json")
    if isinstance(sources, Exception):
        errors.append(f"permits/sources.json unreadable: {sources}")
    else:
        for src in sources.get("sources") or []:
            if src.get("status") != "active":
                continue
            data_file = ROOT / src.get("dataFile", "")
            if not data_file.exists():
                errors.append(f"active permit source missing file: {src.get('id')} -> {src.get('dataFile')}")

    sales_path = ROOT / "sales.json"
    if sales_path.exists():
        sales = load_json(sales_path)
        if isinstance(sales, Exception):
            warnings.append(f"sales.json unreadable: {sales}")
        elif not (sales.get("stats") or {}).get("scraped"):
            warnings.append("sales.json present but scraper reports 0 scraped counties")
    else:
        warnings.append("sales.json missing — site uses inline sale fallbacks")

    td = (ROOT / "tax-deeds.html").read_text(encoding="utf-8")
    if "<tr data-name=" not in td:
        errors.append("tax-deeds.html missing built county registry rows — run build_site_fallbacks.py")

    for msg in warnings:
        print(f"WARN: {msg}", file=sys.stderr)
    for msg in errors:
        print(f"ERROR: {msg}", file=sys.stderr)

    if errors:
        return 1
    print(f"OK: {len(links if isinstance(links, dict) else {})} counties, inventory + permits manifest present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
