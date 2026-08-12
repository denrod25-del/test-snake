#!/usr/bin/env python3
"""Generate SEO landing pages for DeedScout."""
import html
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://deedscout.netlify.app"

PAGES = [
    {
        "file": "florida-tax-deed-sales.html",
        "title": "Florida Tax Deed Sales — Research Guide | DeedScout",
        "h1": "Florida tax deed sales",
        "desc": "How Florida tax deed sales work, what to verify on official clerk sites, and how DeedScout organizes county auction links.",
        "body": """
        <p>Florida tax deed sales transfer property after delinquent taxes. Each county clerk publishes sale rules; many counties use online auction vendors. DeedScout links to official sources — it does not replace clerk verification.</p>
        <h2>Start researching</h2>
        <ul><li><a href="tax-deeds.html">DeedScout Tax Deeds — 67 counties</a></li>
        <li><a href="counties/index.html">Browse by county</a></li>
        <li><a href="learn/florida-tax-deed-sales.html">Learn: Florida tax deed sales</a></li></ul>
        """,
        "faq": [
            ("Are DeedScout sale dates official?", "No. Sale-date automation may be offline. Always verify on the county clerk or auction platform before bidding."),
            ("Is this legal advice?", "No. DeedScout is a research tool only."),
        ],
    },
    {
        "file": "florida-tax-deed-sales-by-county.html",
        "title": "Florida Tax Deed Sales by County | DeedScout",
        "h1": "Tax deed sales by county",
        "desc": "Directory of all 67 Florida counties with clerk, property appraiser, and auction links.",
        "body": """
        <p>Each Florida county runs its own tax deed process. DeedScout maintains a directory of official links — not scraped sale guarantees.</p>
        <p><a class="ds-btn ds-btn-primary" href="counties/index.html">Browse all 67 counties →</a></p>
        """,
        "faq": [],
    },
    {
        "file": "palm-beach-county-tax-deed-sales.html",
        "title": "Palm Beach County Tax Deed Sales | DeedScout",
        "h1": "Palm Beach County tax deed sales",
        "desc": "Official Palm Beach County clerk, property appraiser, and auction links plus permit research tools.",
        "body": """
        <p>Palm Beach County is a major Southeast Florida tax deed market. DeedScout links to official clerk and auction sources and provides cached municipal permit data for West Palm Beach, Boca Raton, and Jupiter (labeled separately from county sample data).</p>
        <ul><li><a href="counties/palm-beach.html">Palm Beach County page</a></li>
        <li><a href="municipalities/west-palm-beach.html">West Palm Beach permits</a></li>
        <li><a href="parcel-lookup.html">Palm Beach parcel lookup</a></li></ul>
        """,
        "faq": [],
    },
    {
        "file": "florida-surplus-funds-by-county.html",
        "title": "Florida Surplus Funds by County | DeedScout",
        "h1": "Florida surplus funds by county",
        "desc": "County surplus claim portals and research resources after tax deed overbids.",
        "body": """
        <p>When a tax deed sale produces excess proceeds, Florida Statute §197.582 governs claims. DeedScout links to county surplus resources where published.</p>
        <p><a href="tax-deeds.html#/surplus">Open surplus registry in Tax Deeds →</a></p>
        """,
        "faq": [],
    },
    {
        "file": "palm-beach-parcel-lookup.html",
        "title": "Palm Beach Parcel Lookup | DeedScout",
        "h1": "Palm Beach parcel lookup",
        "desc": "Search Palm Beach County parcels by PCN, address, or owner with official source verification.",
        "body": """
        <p>DeedScout Parcel Lookup queries Palm Beach County GIS for research — verify all fields with the Property Appraiser before bidding.</p>
        <p><a class="ds-btn ds-btn-primary" href="parcel-lookup.html">Open Parcel Lookup →</a></p>
        """,
        "faq": [],
    },
]


def render_page(p):
    faq_ld = ""
    if p.get("faq"):
        entities = []
        for q, a in p["faq"]:
            entities.append({"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}})
        faq_ld = f'<script type="application/ld+json">{json.dumps({"@context":"https://schema.org","@type":"FAQPage","mainEntity":entities})}</script>'
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{html.escape(p['title'])}</title>
<meta name="description" content="{html.escape(p['desc'])}"/>
<link rel="canonical" href="{BASE}/{html.escape(p['file'])}"/>
<link rel="stylesheet" href="/assets/deedscout.css"/>
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"WebPage","name":{json.dumps(p['h1'])},"description":{json.dumps(p['desc'])},"url":{json.dumps(BASE + '/' + p['file'])}}}</script>
{faq_ld}
</head>
<body class="ds-body">
<main class="ds-main" style="padding-top:48px;max-width:760px;">
<div class="ds-section-head"><p class="ds-section-label">DeedScout · Florida</p>
<h1>{html.escape(p['h1'])}</h1>
<p>{html.escape(p['desc'])}</p></div>
<div class="ds-prose">{p['body']}
<p class="ds-trust-inline"><span class="ds-status ds-status-cached">Public Beta</span> Official source required before bidding. Not legal or investment advice.</p>
</div></main>
<script src="assets/data-trust.js"></script>
<script src="/assets/deedscout.js"></script>
<script src="assets/deedscout-errors.js"></script>
</body></html>"""


def main():
    for p in PAGES:
        out = ROOT / p["file"]
        out.write_text(render_page(p), encoding="utf-8")
        print(f"wrote {p['file']}")


if __name__ == "__main__":
    main()
