"""
build_curated_sales.py
----------------------
Compute upcoming sale dates for top investor metros from documented county
cadence (data/sale-schedules.json) when the RealAuction scraper is offline.

Output: scraper/curated_sales.json (consumed by scrape_sales.py)

Manual overrides: add entries under "overrides" with source "manual_verified".
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEDULES_PATH = ROOT / "data" / "sale-schedules.json"
SOURCES_PATH = ROOT / "scraper" / "sources.json"
OUTPUT_PATH = ROOT / "scraper" / "curated_sales.json"
WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def load_json(path: Path, default=None):
    if not path.exists():
        return default if default is not None else {}
    return json.loads(path.read_text(encoding="utf-8"))


def nth_weekday_of_month(year: int, month: int, weekday: int, week_num: int) -> date | None:
    """week_num 1 = first weekday of month, etc."""
    d = date(year, month, 1)
    count = 0
    while d.month == month:
        if d.weekday() == weekday:
            count += 1
            if count == week_num:
                return d
        d += timedelta(days=1)
    return None


def dates_from_cadence(weekday: int, weeks: list[int], horizon_months: int = 4) -> list[str]:
    today = date.today()
    out: list[str] = []
    y, m = today.year, today.month
    for _ in range(horizon_months):
        for w in weeks:
            d = nth_weekday_of_month(y, m, weekday, w)
            if d and d >= today:
                out.append(d.isoformat())
        m += 1
        if m > 12:
            m = 1
            y += 1
    return sorted(set(out))[:6]


def main() -> int:
    doc = load_json(SCHEDULES_PATH)
    sources = load_json(SOURCES_PATH)
    top = doc.get("topCounties") or []
    schedules = doc.get("schedules") or {}
    overrides = doc.get("overrides") or {}
    verified_at = date.today().isoformat()
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    counties: dict[str, list] = {}

    for name in top:
        if name in overrides and overrides[name]:
            counties[name] = overrides[name]
            continue
        sched = schedules.get(name)
        if not sched:
            continue
        auction_url = (sources.get(name) or {}).get("url") or ""
        weekday = int(sched["weekday"])
        weeks = [int(w) for w in sched["weeks"]]
        time_str = sched.get("time") or ""
        entries = []
        for iso in dates_from_cadence(weekday, weeks):
            entries.append({
                "date": iso,
                "source": "cadence",
                "verifiedAt": verified_at,
                "officialUrl": auction_url,
                "opening": f"{WEEKDAY_NAMES[weekday]} sale · {time_str} (typical cadence)",
                "note": "Typical county sale cadence — confirm parcel list on official auction site before bidding.",
            })
        if entries:
            counties[name] = entries

    payload = {
        "generated": generated,
        "verifiedAt": verified_at,
        "counties": counties,
        "stats": {
            "counties": len(counties),
            "dates": sum(len(v) for v in counties.values()),
        },
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)} — {payload['stats']['counties']} counties, {payload['stats']['dates']} dates")
    return 0


if __name__ == "__main__":
    sys.exit(main())
