"""
export_county_links.py
----------------------
Extract official county links from tax-deeds.html COUNTIES array into
data/county-links.json for build_county_pages.py.

Usage:
    python scripts/export_county_links.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAX_DEEDS = ROOT / "tax-deeds.html"
OUT = ROOT / "data" / "county-links.json"


def main():
    text = TAX_DEEDS.read_text(encoding="utf-8")
    m = re.search(r"const COUNTIES = \[(.*?)\];", text, re.DOTALL)
    if not m:
        raise SystemExit("Could not find COUNTIES array in tax-deeds.html")

    # Parse county objects with a minimal regex (name + link keys)
    block = m.group(1)
    entries = {}
    for chunk in re.finditer(
        r'\{\s*name:"([^"]+)"[^}]*?(?:pa:\{[^}]*url:"([^"]*)"[^}]*\})?[^}]*?(?:clerk:\{[^}]*url:"([^"]*)"[^}]*\})?[^}]*?(?:auction:\{[^}]*url:"([^"]*)"[^}]*\})?',
        block,
        re.DOTALL,
    ):
        name = chunk.group(1)
        entries[name] = {}
        if chunk.group(2):
            entries[name]["pa"] = {"url": chunk.group(2)}
        if chunk.group(3):
            entries[name]["clerk"] = {"url": chunk.group(3)}
        if chunk.group(4):
            entries[name]["auction"] = {"url": chunk.group(4)}

    # Richer parse: eval-like extraction via repeated object scans
    for obj in re.finditer(r"\{[^{}]*name:\"([^\"]+)\"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", block):
        pass  # fallback only — use Node-style full parse below

    # Full parse: strip JS to JSON-ish and load name/url pairs per key
    county_blocks = re.split(r"\n\s*\{", block)
    out = {}
    for raw in county_blocks:
        nm = re.search(r'name:\s*"([^"]+)"', raw)
        if not nm:
            continue
        name = nm.group(1)
        entry = {}
        for key in ("pa", "clerk", "auction", "taxCollector", "surplus"):
            km = re.search(rf"{key}:\{{\s*url:\s*\"([^\"]+)\"", raw)
            lm = re.search(rf'{key}:\{{\s*url:\s*"[^"]*",\s*label:\s*"([^"]*)"', raw)
            if km:
                entry[key] = {"url": km.group(1)}
                if lm:
                    entry[key]["label"] = lm.group(1).replace("&mdash;", "—")
        if entry:
            out[name] = entry

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(out)} counties to {OUT}")


if __name__ == "__main__":
    main()
