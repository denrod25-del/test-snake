#!/usr/bin/env python3
"""Rebuild data/signals/recent-permits.json from cached permit city files."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERMIT_DIR = ROOT / "data" / "permits"
OUT_DIR = ROOT / "data" / "signals"
SLUGS = ["west-palm-beach", "boca-raton", "jupiter", "st-lucie-county"]


def main() -> None:
    rows = []
    for slug in SLUGS:
        path = PERMIT_DIR / f"{slug}.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        by = data.get("permitsByParcel") or {}
        meta_gen = data.get("generated")
        for parcel, permits in by.items():
            if not isinstance(permits, list):
                continue
            for p in permits:
                if not isinstance(p, dict):
                    continue
                date = p.get("issuedDate") or p.get("appliedDate") or p.get("finalDate") or ""
                rows.append(
                    {
                        "source": slug,
                        "permitNumber": p.get("permitNumber") or p.get("number"),
                        "parcelId": parcel or p.get("parcelId") or "",
                        "address": p.get("address") or "",
                        "type": p.get("type") or p.get("subtype") or "",
                        "status": p.get("status") or "",
                        "valuation": p.get("valuation"),
                        "date": str(date)[:10] if date else "",
                        "url": p.get("url") or "",
                        "sourceGenerated": meta_gen,
                    }
                )

    rows.sort(key=lambda r: r["date"] or "", reverse=True)
    top = [r for r in rows if r["date"]][:150] or rows[:150]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "note": "Top recent permits from cached Tyler EnerGov scrapes. Verify on municipal portals.",
        "count": len(top),
        "poolSize": len(rows),
        "permits": top,
    }
    (OUT_DIR / "recent-permits.json").write_text(json.dumps(payload, indent=2) + "\n")
    print(f"wrote {len(top)} of {len(rows)} → {OUT_DIR / 'recent-permits.json'}")


if __name__ == "__main__":
    main()
