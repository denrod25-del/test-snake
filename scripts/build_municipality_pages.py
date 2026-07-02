"""
build_municipality_pages.py — SEO pages for municipal permit sources (not counties).

    python scripts/build_municipality_pages.py --base-url https://deedscout.netlify.app
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MUNI_DIR = ROOT / "municipalities"
SOURCES_PATH = ROOT / "data" / "permits" / "sources.json"
PERMITS_INDEX = ROOT / "data" / "permits" / "index.json"


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def html_escape(s):
    if s is None:
        return ""
    return (str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;"))


def load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def permit_status_label(src, count):
    scope = (src.get("scope") or "").lower()
    st = src.get("status") or ""
    if "sample" in scope or st in ("unsupported_paywall", "scaffold"):
        if count:
            return "Sample/demo only", f"{count} sample rows — not real permit records", "warn"
        return "Sample/demo only", "No real records", "warn"
    if st == "active" and count:
        return "Cached", f"{count:,} cached Tyler EnerGov records", "ok"
    return "Blocked/manual lookup required", "Portal lookup only", "muted"


def render_page(src, slug, coverage, base_url):
    city = src["label"]
    parent = src.get("county") or "Florida"
    parent_slug = slugify(parent)
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    count = (coverage or {}).get("permitCount")
    badge, val, badge_cls = permit_status_label(src, count or 0)
    h1 = f"{city}, {parent} County, FL"
    title = f"{h1} — Building Permits &amp; DeedScout Research"
    description = (
        f"Cached municipal building permit data for {city}, {parent} County, Florida. "
        f"Status: {badge}. Verify on the official portal before outreach."
    )
    canonical = f"{base_url}/municipalities/{slug}.html" if base_url else f"municipalities/{slug}.html"
    portal = src.get("portalUrl") or ""
    source_id = src.get("id") or slug

    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": f"{city} building permits (DeedScout cached)",
        "description": description,
        "url": canonical,
        "isAccessibleForFree": True,
        "creator": {"@type": "Organization", "name": "DeedScout"},
    }, indent=2)

    sample_banner = ""
    if badge == "Sample/demo only":
        sample_banner = (
            '<div class="trust-box" style="background:#faecdb;border-color:#d8b58a;">'
            "<strong>Sample/demo only — not production permit records.</strong> "
            "Do not use for bidding or contractor outreach. Verify on the official portal.</div>"
        )

    body = f"""
    {sample_banner}
    <div class="stat-grid">
      <div class="stat"><div class="lbl">Data status</div><div class="val"><span class="badge {badge_cls}">{html_escape(badge)}</span></div>
        <div class="sub">Not a live query — cached snapshot in DeedScout</div></div>
      <div class="stat"><div class="lbl">Records in cache</div><div class="val">{html_escape(val)}</div>
        <div class="sub">Verify on official portal before acting</div></div>
      <div class="stat"><div class="lbl">Parent county</div><div class="val"><a href="../counties/{html_escape(parent_slug)}.html">{html_escape(parent)} County</a></div>
        <div class="sub">Tax deed sales are county-level</div></div>
    </div>
    <h2>Official permit portal</h2>
    <p><a href="{html_escape(portal)}" target="_blank" rel="noopener">{html_escape(portal)}</a></p>
    <p class="small">{html_escape(src.get('scope') or '')}</p>
    <h2>Search in DeedScout</h2>
    <p><a href="../permit-search.html?source={html_escape(source_id)}">Open {html_escape(city)} permits in Permit Search →</a></p>
    <p class="small"><strong>Official source required.</strong> DeedScout is a research layer — not the city building department.</p>
    """

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{html_escape(description)}" />
<link rel="canonical" href="{html_escape(canonical)}" />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
<script type="application/ld+json">{jsonld}</script>
<link rel="stylesheet" href="../assets/deedscout.css" />
</head>
<body class="ds-body">
<script src="../assets/deedscout.js"></script>
<main class="ds-main" style="padding-top:32px;max-width:920px;margin:0 auto;">
  <p class="ds-section-label">Municipality · {html_escape(parent)} County</p>
  <h1 style="font-family:'Cormorant Garamond',serif;">{html_escape(h1)}</h1>
  <p class="ds-hero-lede" style="font-size:18px;">{html_escape(city)} is a city in {html_escape(parent)} County, Florida — not a county. This page covers municipal building permit data only. Tax deed sales for this area are handled at the {html_escape(parent)} County clerk and auction links.</p>
  {body}
  <p style="margin-top:32px;font-size:13px;color:var(--ds-muted);">Generated {html_escape(today)} · <a href="../trust.html">Trust Center</a> · <a href="../data-sources.html">Data Sources</a></p>
</main>
<script src="../assets/deedscout-errors.js"></script>
</body>
</html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="https://deedscout.netlify.app")
    args = ap.parse_args()
    base_url = (args.base_url or "").rstrip("/")

    manifest = load_json(SOURCES_PATH, {"sources": []})
    index = load_json(PERMITS_INDEX, {"coverage": []})
    by_slug = {c.get("slug"): c for c in index.get("coverage") or []}

    MUNI_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for src in manifest.get("sources") or []:
        if src.get("kind") != "municipality":
            continue
        slug = slugify(src["label"])
        data_file = src.get("dataFile") or ""
        file_slug = Path(data_file).stem if data_file else slug
        cov = by_slug.get(file_slug) or by_slug.get(slug)
        html = render_page(src, slug, cov, base_url)
        out = MUNI_DIR / f"{slug}.html"
        out.write_text(html, encoding="utf-8")
        count += 1
        print(f"  wrote municipalities/{slug}.html")

    index_html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Municipalities — DeedScout</title>
<link rel="stylesheet" href="../assets/deedscout.css"/></head>
<body class="ds-body"><main class="ds-main" style="padding-top:48px;">
<h1 style="font-family:'Cormorant Garamond',serif;">Municipal permit coverage</h1>
<p>Cities with cached or sample permit data in DeedScout — not Florida counties.</p>
<ul>
  <li><a href="west-palm-beach.html">West Palm Beach, Palm Beach County</a></li>
  <li><a href="boca-raton.html">Boca Raton, Palm Beach County</a></li>
  <li><a href="jupiter.html">Jupiter, Palm Beach County</a></li>
  <li><a href="royal-palm-beach.html">Royal Palm Beach, Palm Beach County</a></li>
  <li><a href="boynton-beach.html">Boynton Beach, Palm Beach County</a></li>
</ul>
<p><a href="../counties/index.html">Browse 67 Florida counties →</a></p>
</main><script src="../assets/deedscout.js"></script></body></html>"""
    (MUNI_DIR / "index.html").write_text(index_html, encoding="utf-8")
    print(f"Generated {count} municipality pages.")


if __name__ == "__main__":
    main()
