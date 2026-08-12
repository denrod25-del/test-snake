"""
build_county_pages.py
---------------------
Generate one static HTML page per Florida county under counties/<slug>.html.

Each page is SEO-optimized for queries like:
    "tax deed sales palm beach county fl"
    "broward county building permits"
    "miami-dade surplus funds"

Pulls live data from:
    sales.json                    upcoming auction dates
    surplus.json                  surplus-funds resources (if present)
    data/permits/index.json       permit coverage status
    data/county-regions.json      regions + cities per county
    scraper/sources_permits.json  permit portal URLs
    scraper/sources.json          auction-platform URLs

Also writes counties/index.html (browse-by-region landing) and
sitemap.xml (root). Designed to be run after each scrape:

    cd scripts
    python build_county_pages.py
    python build_county_pages.py --base-url https://example.com
    python build_county_pages.py --only "Palm Beach,Orange"

The generated pages are static HTML (no JS required) so search engines can
index them. They link back to the main app for live tools (parcel-lookup,
research notebook).
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


HERE = Path(__file__).parent
ROOT = HERE.parent
COUNTIES_DIR    = ROOT / "counties"
DATA_DIR        = ROOT / "data"
PERMIT_MANIFEST = DATA_DIR / "permits" / "sources.json"
PERMITS_INDEX   = DATA_DIR / "permits" / "index.json"
COUNTY_REGIONS  = DATA_DIR / "county-regions.json"
SALES_PATH      = ROOT / "sales.json"
SURPLUS_PATH    = ROOT / "surplus.json"
SOURCES_SALES   = ROOT / "scraper" / "sources.json"
SOURCES_SURPLUS = ROOT / "scraper" / "sources_surplus.json"
SOURCES_PERMITS = ROOT / "scraper" / "sources_permits.json"
PERMITS_SOURCES_JSON = DATA_DIR / "permits" / "sources.json"
COUNTY_LINKS     = DATA_DIR / "county-links.json"
STATS_PATH      = DATA_DIR / "counties" / "stats.json"
SITEMAP_PATH    = ROOT / "sitemap.xml"


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def fmt_money(n):
    if n is None:
        return "n/a"
    try:
        return "${:,.0f}".format(float(n))
    except (ValueError, TypeError):
        return str(n)


def fmt_date_iso(s):
    try:
        d = datetime.strptime(s, "%Y-%m-%d")
        return d.strftime("%B %-d, %Y") if sys.platform != "win32" else d.strftime("%B %#d, %Y")
    except (ValueError, TypeError):
        return s or ""


def fmt_date_short(iso):
    """Compact label for home-page badges, e.g. Jul 15."""
    try:
        d = datetime.strptime(iso, "%Y-%m-%d")
        return d.strftime("%b %-d") if sys.platform != "win32" else d.strftime("%b %#d")
    except (ValueError, TypeError):
        return iso or ""


def pick_next_sale(sales_entries):
    """Return the nearest upcoming sale entry, or None."""
    today = datetime.now(timezone.utc).date()
    future = []
    for entry in sales_entries or []:
        try:
            sale_date = datetime.strptime(entry["date"], "%Y-%m-%d").date()
        except (ValueError, TypeError, KeyError):
            continue
        if sale_date >= today:
            future.append(entry)
    future.sort(key=lambda x: x["date"])
    return future[0] if future else None


def surplus_source_for(county, surplus_by_county, surplus_sources):
    """Resolve surplus portal metadata from scraped surplus.json or sources."""
    entry = surplus_by_county.get(county) if isinstance(surplus_by_county, dict) else None
    if not entry:
        entry = surplus_sources.get(county) if isinstance(surplus_sources, dict) else None
    if not entry or not entry.get("url"):
        return None
    return {"url": entry["url"], "parser": entry.get("parser")}


def build_stats_entry(county, slug, region, sales_entries, surplus_meta, permit_coverage):
    next_sale = pick_next_sale(sales_entries)
    permit_status = (permit_coverage or {}).get("status", "available")
    permit_count = (permit_coverage or {}).get("permitCount")
    stats = {
        "county": county,
        "slug": slug,
        "region": region or None,
        "nextSale": None,
        "surplusPortal": bool(surplus_meta),
        "surplusUrl": surplus_meta["url"] if surplus_meta else None,
        "permits": {
            "status": permit_status,
            "count": permit_count if permit_count is not None else None,
        },
    }
    if next_sale:
        stats["nextSale"] = {
            "date": next_sale["date"],
            "label": fmt_date_iso(next_sale["date"]),
            "shortLabel": fmt_date_short(next_sale["date"]),
            "count": next_sale.get("count"),
            "source": next_sale.get("source") or "scraper",
        }
    return stats


def html_escape(s):
    if s is None:
        return ""
    text = str(s)
    # Source JSON sometimes already contains HTML entities (&mdash;). Decode
    # common ones first so we do not emit broken &amp;mdash; in pages.
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&mdash;", "—")
        .replace("&ndash;", "–")
    )
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


FLOOD_GIS_COUNTIES = {
    "palm-beach",
    "miami-dade",
    "broward",
    "hillsborough",
    "pinellas",
    "orange",
    "duval",
    "lee",
}


PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{description}" />
<link rel="canonical" href="{canonical}" />
<meta property="og:title" content="{og_title}" />
<meta property="og:description" content="{description}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="{canonical}" />
<meta name="twitter:card" content="summary" />
<meta name="robots" content="index, follow" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/assets/deedscout.css" />
<script type="application/ld+json">
{jsonld}
</script>
<style>
  .county-main {{ max-width: 920px; margin: 0 auto; padding: 36px 28px 80px; }}
  .county-main .eyebrow {{
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: var(--muted, #6b6b6b);
    margin: 0 0 8px;
  }}
  .county-main .lede {{
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 21px;
    color: var(--ink, #0c1320);
    line-height: 1.45;
    margin: 0 0 28px;
    max-width: 660px;
  }}
  .county-main h1 {{
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 600;
    font-size: clamp(2rem, 4vw, 2.4rem);
    margin: 0 0 8px;
    line-height: 1.15;
    color: var(--accent-ink, #4a3a25);
  }}
  .county-main h2 {{
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 600;
    font-size: 1.55rem;
    margin: 36px 0 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--rule, #d9d4c7);
    color: var(--accent-ink, #4a3a25);
  }}
  .county-main h3 {{
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 1.2rem;
    margin: 24px 0 6px;
    color: var(--accent-ink, #4a3a25);
  }}
  .stat-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin: 24px 0 32px;
  }}
  .stat {{
    padding: 16px 18px;
    background: #fff;
    border: 1px solid var(--rule, #d9d4c7);
    border-left: 3px solid var(--accent-ink, #4a3a25);
  }}
  .stat .lbl {{
    font-size: 11px;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--muted, #6b6b6b);
    margin-bottom: 6px;
  }}
  .stat .val {{ font-size: 1.15rem; font-weight: 600; color: var(--ink, #0c1320); font-family: 'Cormorant Garamond', Georgia, serif; }}
  .stat .sub {{ font-size: 13px; color: var(--muted, #6b6b6b); margin-top: 4px; }}
  .badge {{
    display: inline-block;
    padding: 2px 8px;
    background: #fff;
    border: 1px solid var(--rule, #d9d4c7);
    font-size: 10.5px;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--accent-ink, #4a3a25);
    margin-left: 6px;
  }}
  .badge.ok {{ background: #ecf2e6; border-color: #aac199; color: #2f4a2a; }}
  .badge.warn {{ background: #faecdb; border-color: #d8b58a; color: #6b3e1f; }}
  .badge.muted {{ opacity: .75; }}
  .trust-box {{
    background: #fff;
    border: 1px solid var(--rule, #d9d4c7);
    padding: 18px 22px;
    margin: 24px 0;
  }}
  .trust-list {{ margin: 12px 0 0; padding-left: 20px; font-size: 14px; }}
  .official-links {{ font-size: 14px; line-height: 1.7; }}
  .official-links li {{ margin-bottom: 8px; }}
  .county-main table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    margin: 12px 0 8px;
  }}
  .county-main th, .county-main td {{
    text-align: left;
    padding: 10px 8px;
    border-bottom: 1px solid var(--rule, #d9d4c7);
  }}
  ul.cities {{
    columns: 3;
    column-gap: 32px;
    list-style: none;
    padding: 0;
    font-size: 13.5px;
  }}
  ul.cities li {{ break-inside: avoid; padding: 2px 0; }}
  .cta {{
    margin: 32px 0 8px;
    padding: 18px 22px;
    background: #fff;
    border: 1px solid var(--rule, #d9d4c7);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }}
  .cta .cta-msg {{ flex: 1 1 380px; }}
  .cta .cta-msg strong {{ font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; color: var(--accent-ink, #4a3a25); }}
  .btn {{
    display: inline-block;
    padding: 10px 20px;
    background: var(--ink, #0c1320);
    color: #fff !important;
    border: 0;
    text-decoration: none;
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
  }}
  .county-footer {{
    max-width: 920px;
    margin: 0 auto;
    padding: 24px 28px 60px;
    color: var(--muted, #6b6b6b);
    font-size: 13px;
  }}
  .small {{ font-size: 12.5px; color: var(--muted, #6b6b6b); }}
  @media (max-width: 720px) {{
    ul.cities {{ columns: 1; }}
  }}
</style>
</head>
<body class="ds-body">
  <main class="ds-main county-main">
    <p class="eyebrow">{eyebrow}</p>
    <h1>{h1}</h1>
    <p class="lede">{lede}</p>

    {body}

    {cta_block}
  </main>

  <footer class="county-footer">
    <p>
      Generated {generated} from public county data.
      <a href="../tax-deeds.html">Live tools</a> ·
      <a href="../property-intelligence.html">Property Intelligence</a> ·
      <a href="../parcel-lookup.html">Palm Beach parcel lookup</a> ·
      <a href="index.html">All counties</a>
    </p>
    <p class="small">
      This is an information resource, not legal advice. Tax-deed investing carries real risk; always verify
      current statute text at <a href="https://www.flsenate.gov/Laws/Statutes/2024/Chapter197" target="_blank" rel="noopener">flsenate.gov</a>
      and consult an attorney before bidding.
    </p>
  </footer>
<script src="/assets/deedscout.js"></script>
</body>
</html>
"""


def build_county_body(county, slug, region, cities, sales_entries, surplus_entry,
                      permit_coverage, sales_source_url, permit_source_url, generated,
                      county_links_entry=None):
    """Compose the per-county body HTML."""
    parts = []

    # ----- Stat grid -----
    next_sale = pick_next_sale(sales_entries)
    next_sale_str = (
        fmt_date_iso(next_sale["date"]) if next_sale
        else "No verified sale date in DeedScout — verify on the official clerk or auction source."
    )
    next_sale_count = next_sale.get("count") if next_sale else None
    next_sale_sub = (
        f"{next_sale_count} parcels listed" if next_sale_count
        else ('Verify on official clerk or auction site '
              + ('<span class="badge warn">Sale-date automation limited</span>' if not next_sale else ''))
    )
    permit_status = (permit_coverage or {}).get("status", "available")
    permit_count = (permit_coverage or {}).get("permitCount", 0) if permit_status in ("active", "stale", "manual") else None
    surplus_link = (surplus_entry or {}).get("url") if surplus_entry else None

    stat_cells = []
    stat_cells.append(f"""
      <div class="stat">
        <div class="lbl">Region</div>
        <div class="val">{html_escape(region or '—')}</div>
        <div class="sub">{html_escape(', '.join(cities[:3]) + ('…' if len(cities) > 3 else ''))}</div>
      </div>
    """)
    stat_cells.append(f"""
      <div class="stat">
        <div class="lbl">Next tax-deed sale</div>
        <div class="val">{html_escape(next_sale_str)}</div>
        <div class="sub">{html_escape(next_sale_sub)}</div>
      </div>
    """)
    permit_label = {
        "active":      ("Cached municipal scrape", "ok"),
        "stale":       ("Cached municipal scrape", "warn"),
        "manual":      ("Manual entries only", ""),
        "available":   ("Portal lookup only", "muted"),
        "unsupported": ("No public portal", "muted"),
    }.get(permit_status, (permit_status, ""))
    scope = (permit_coverage or {}).get("scope") or ""
    scope = re.sub(r"\blive Tyler\b", "cached Tyler", scope, flags=re.I)
    last_updated = (permit_coverage or {}).get("lastUpdated") or ""
    if scope and ("sample" in scope.lower() or "illustrative" in scope.lower() or "not real" in scope.lower()):
        permit_label = ("Sample/demo only", "warn")
    elif permit_status in ("active", "stale") and permit_count:
        permit_label = (f"Cached Tyler · {permit_count:,} records", "ok" if permit_status == "active" else "warn")
    permit_val = "—"
    if permit_label[0] == "Sample/demo only" and permit_count:
        permit_val = f"{permit_count} sample rows — not real permit records"
    elif permit_count is not None:
        permit_val = f"{permit_count:,} cached records"
    stat_cells.append(f"""
      <div class="stat">
        <div class="lbl">Building permits (county)</div>
        <div class="val">{html_escape(permit_val)}<span class="badge {permit_label[1]}">{html_escape(permit_label[0])}</span></div>
        <div class="sub">{'Cached Tyler EnerGov scrape — verify on official portal' if permit_status == 'active' and permit_count else 'Sample/demo only — not real records' if permit_label[0] == 'Sample/demo only' else 'See municipality pages for city permit scrapes'}</div>
      </div>
    """)
    stat_cells.append(f"""
      <div class="stat">
        <div class="lbl">Surplus funds</div>
        <div class="val">{'Available' if surplus_link else '—'}</div>
        <div class="sub">{'County publishes surplus claim resources' if surplus_link else 'No public surplus portal'}</div>
      </div>
    """)
    parts.append(f'<div class="stat-grid">{"".join(stat_cells)}</div>')

    # ----- Data trust -----
    sale_sources = {e.get("source", "scraper") for e in (sales_entries or [])}
    if not sales_entries:
        sales_status = "broken" if sales_source_url else "coming-soon"
    elif sale_sources <= {"cadence"}:
        sales_status = "cached"
    elif "manual" in sale_sources and "scraper" not in sale_sources:
        sales_status = "cached"
    else:
        sales_status = "cached" if sales_entries else "broken"
    sales_badge = {"broken": "warn", "cached": "ok", "coming-soon": "muted"}.get(sales_status, "muted")
    if sales_entries and sale_sources <= {"cadence"}:
        sales_copy = "Dates below reflect documented county sale cadence (scraper offline) — not live parcel counts. Verify on official auction site before bidding."
    elif sales_entries:
        sales_copy = "Dates below are from cached scrapes — verify on official auction site before bidding."
    else:
        sales_copy = "No verified upcoming dates in DeedScout — check clerk/auction links below."
    parts.append(f"""
      <div class="trust-box">
        <h2>Data status</h2>
        <p class="small">DeedScout is a research layer — not a county clerk or auctioneer. Official source required before bidding. Not legal, tax, title, or investment advice.</p>
        <ul class="trust-list">
          <li><strong>Tax deed sales:</strong> <span class="badge {sales_badge}">{html_escape(sales_status.upper())}</span>
            — {html_escape(sales_copy)}</li>
          <li><strong>Permits:</strong> <span class="badge {permit_label[1] or 'muted'}">{html_escape(permit_label[0])}</span>
            {html_escape(' — ' + scope[:140] + ('…' if len(scope) > 140 else '') if scope else '')}</li>
          <li><strong>Last verified / generated:</strong> {html_escape(generated)}{(' · permit file ' + html_escape(last_updated[:10]) if last_updated else '')}</li>
        </ul>
      </div>
    """)

    # ----- Official sources -----
    parts.append("<h2>Official sources</h2><ul class='official-links'>")
    links = county_links_entry or {}
    if (links.get("pa") or {}).get("url"):
        pa = links["pa"]
        parts.append(f'<li><strong>Property appraiser:</strong> <a href="{html_escape(pa["url"])}" target="_blank" rel="noopener">{html_escape(pa.get("label") or pa["url"])}</a></li>')
    if (links.get("clerk") or {}).get("url"):
        ck = links["clerk"]
        parts.append(f'<li><strong>Clerk (tax deeds):</strong> <a href="{html_escape(ck["url"])}" target="_blank" rel="noopener">{html_escape(ck.get("label") or ck["url"])}</a></li>')
    if (links.get("auction") or {}).get("url"):
        au = links["auction"]
        parts.append(f'<li><strong>Tax deed auction:</strong> <a href="{html_escape(au["url"])}" target="_blank" rel="noopener">{html_escape(au.get("label") or au["url"])}</a></li>')
    elif sales_source_url:
        parts.append(f'<li><strong>Tax deed auction:</strong> <a href="{html_escape(sales_source_url)}" target="_blank" rel="noopener">{html_escape(sales_source_url)}</a></li>')
    if (links.get("taxCollector") or {}).get("url"):
        tc = links["taxCollector"]
        parts.append(f'<li><strong>Tax collector:</strong> <a href="{html_escape(tc["url"])}" target="_blank" rel="noopener">{html_escape(tc.get("label") or tc["url"])}</a></li>')
    if surplus_link:
        parts.append(f'<li><strong>Surplus funds:</strong> <a href="{html_escape(surplus_link)}" target="_blank" rel="noopener">County surplus claims portal</a></li>')
    if permit_source_url:
        parts.append(f'<li><strong>Permit portal:</strong> <a href="{html_escape(permit_source_url)}" target="_blank" rel="noopener">{html_escape(permit_source_url)}</a></li>')
    parts.append(f'<li><strong>DeedScout workflow:</strong> <a href="../tax-deeds.html#/county/{html_escape(slug)}">Open {html_escape(county)} in DeedScout Tax Deeds</a></li>')
    if slug in FLOOD_GIS_COUNTIES:
        parts.append(
            f'<li><strong>Flood / Property Intelligence:</strong> '
            f'<a href="../property-intelligence.html?county={html_escape(slug)}&amp;mode=pcn">'
            f'Live flood GIS stamp for {html_escape(county)}</a> '
            f'<span class="badge ok">Live GIS</span></li>'
        )
    else:
        parts.append(
            f'<li><strong>Flood research:</strong> '
            f'<a href="../property-intelligence.html?county={html_escape(slug)}&amp;mode=pcn">'
            f'Property Intelligence + FEMA MSC deep-link</a> '
            f'<span class="badge muted">MSC</span></li>'
        )
    parts.append("</ul>")
    if county.lower() == "palm beach":
        parts.append('<p class="small"><strong>Why WPB has ~4,000 permits but PBC shows 4:</strong> West Palm Beach is a separate Tyler EnerGov scrape (cached, real records). Palm Beach County unincorporated permits are blocked behind reCAPTCHA — DeedScout shows 4 <em>sample illustrative</em> records only.</p>')
    parts.append('<p class="small"><strong>Official source required before bidding.</strong> Not legal, tax, title, or investment advice.</p>')

    # ----- Upcoming sales -----
    parts.append("<h2>Upcoming tax-deed sales</h2>")
    if sales_entries:
        rows = "\n".join(f"<tr><td>{html_escape(fmt_date_iso(s['date']))}</td>"
                         f"<td>{html_escape(str(s.get('count', '—')))}</td>"
                         f"<td>{html_escape(s.get('opening', '—') if isinstance(s.get('opening'), str) else '—')}</td></tr>"
                         for s in sales_entries[:12])
        parts.append(f"""
          <table>
            <thead><tr><th>Date</th><th>Parcels</th><th>Opening / location</th></tr></thead>
            <tbody>{rows}</tbody>
          </table>
        """)
        if sales_source_url:
            parts.append(f'<p class="small">Source: <a href="{html_escape(sales_source_url)}" target="_blank" rel="noopener">{html_escape(sales_source_url)}</a></p>')
    else:
        parts.append(
            f"<p>No verified sale dates in DeedScout for {html_escape(county)} County. "
            f"DeedScout does not confirm live auction schedules — verify on the official clerk or auction source below.</p>"
        )
        parts.append(
            '<p class="small"><span class="badge warn">Sale-date automation limited</span> '
            "The upstream sale-date scraper is not publishing verified dates. "
            "Always confirm the next sale on the clerk or auction portal before bidding.</p>"
        )
        if sales_source_url:
            parts.append(
                f'<p class="small">Official auction source: '
                f'<a href="{html_escape(sales_source_url)}" target="_blank" rel="noopener">'
                f'{html_escape(sales_source_url)}</a></p>'
            )

    # ----- Permits -----
    parts.append("<h2>Building permits</h2>")
    if "sample" in permit_label[0].lower() or "demo" in permit_label[0].lower():
        parts.append(f'<p class="small" style="background:#faecdb;border:1px solid #d8b58a;padding:12px;"><strong>Sample/demo only — not real permit records.</strong> Do not rely on these for outreach or bidding decisions. Use the official portal link above.</p>')
    if permit_status in ("active", "stale", "manual"):
        parts.append(f"<p>{html_escape(str(permit_count) if permit_count else 'Permit')} records in DeedScout for {html_escape(county)} County "
                     f"({html_escape(permit_label[0])}). Scope: {html_escape(scope or 'see source portal')}. "
                     f"This is a <strong>cached research snapshot</strong>, not a live municipal query.</p>")
        if permit_source_url:
            parts.append(f'<p class="small">Source: <a href="{html_escape(permit_source_url)}" target="_blank" rel="noopener">{html_escape(permit_source_url)}</a></p>')
    elif permit_status == "available":
        parts.append(f"<p>{html_escape(county)} County maintains a public permit portal but automated indexing isn't yet built. ")
        if permit_source_url:
            parts.append(f'You can search permits manually at <a href="{html_escape(permit_source_url)}" target="_blank" rel="noopener">{html_escape(permit_source_url)}</a>.</p>')
        else:
            parts.append("</p>")
    else:
        parts.append(f"<p>{html_escape(county)} County does not publish a public permit search portal. Permit history must be requested in person at the building department.</p>")

    # ----- Surplus -----
    if surplus_link:
        parts.append("<h2>Surplus funds (post-sale claim)</h2>")
        parts.append(f"<p>When a tax-deed sale closes above the opening bid, Florida Statute §197.582 requires excess proceeds "
                     f"be paid to the prior titleholder or their lienholders. {html_escape(county)} County publishes its surplus "
                     f"workflow at <a href=\"{html_escape(surplus_link)}\" target=\"_blank\" rel=\"noopener\">{html_escape(surplus_link)}</a>.</p>")

    # ----- Cities served (with municipality permit pages where available) -----
    municipality_slugs = {
        "West Palm Beach": "west-palm-beach",
        "Boca Raton": "boca-raton",
        "Jupiter": "jupiter",
        "Royal Palm Beach": "royal-palm-beach",
        "Boynton Beach": "boynton-beach",
    }
    if cities:
        parts.append("<h2>Cities and municipalities</h2>")
        parts.append('<ul class="cities">')
        for city in sorted(set(cities)):
            mslug = municipality_slugs.get(city)
            if mslug:
                parts.append(
                    f'<li><a href="../municipalities/{html_escape(mslug)}.html">'
                    f'{html_escape(city)}, {html_escape(county)} County</a> — municipal permit coverage</li>'
                )
            else:
                parts.append(f"<li>{html_escape(city)}</li>")
        parts.append("</ul>")

    # ----- How tax-deed sales work in this county -----
    parts.append("<h2>How tax-deed sales work in Florida</h2>")
    parts.append(
        "<p>Florida tax-deed sales follow a uniform statutory framework set by "
        '<a href="https://www.flsenate.gov/Laws/Statutes/2024/Chapter197" target="_blank" rel="noopener">Chapter 197 F.S.</a>, '
        "but the conduct of the sale (online vendor, bid increment, deposit rules) varies by county. "
        f"In {html_escape(county)} County, sales are conducted via "
    )
    if sales_source_url:
        parts.append(f'<a href="{html_escape(sales_source_url)}" target="_blank" rel="noopener">the county auction platform</a>')
    else:
        parts.append("the county auction platform (or in person at the courthouse if not yet online)")
    parts.append(". Bidders should verify auction-day rules with the Tax Collector's office before participating.</p>")

    parts.append(
        "<p>The investor process:</p>"
        "<ol>"
        "<li><strong>Tax certificate sale</strong> (early summer) — investors bid on the right to collect delinquent taxes plus interest.</li>"
        "<li><strong>Two-year hold</strong> — certificate accrues interest while the owner has the chance to redeem.</li>"
        "<li><strong>Application for tax deed</strong> — the certificate holder applies after two years; a public auction is scheduled.</li>"
        "<li><strong>Tax-deed sale</strong> — the property itself is sold to the highest bidder; certificate holder is paid first from proceeds.</li>"
        "<li><strong>Surplus claim</strong> (if applicable) — excess proceeds go to lienholders and the former owner under §197.582.</li>"
        "</ol>"
    )

    parts.append(
        '<p class="small"><strong>DeedScout organizes research.</strong> Always verify with the official county, '
        "clerk, auction, property appraiser, or municipal source before bidding, buying, contacting owners, "
        "or making financial decisions.</p>"
    )

    return "\n".join(parts)


def build_jsonld(county, slug, base_url, region, sales_entries, permit_coverage, lede):
    """Build a Schema.org JSON-LD blob for the page."""
    obj = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": f"{county} County, FL — Tax Deed Sales, Permits & Property Research",
        "description": lede,
        "url": f"{base_url}/counties/{slug}.html" if base_url else f"counties/{slug}.html",
        "about": {
            "@type": "Place",
            "name": f"{county} County, Florida",
            "containedInPlace": {"@type": "State", "name": "Florida"},
        },
        "publisher": {"@type": "Organization", "name": "DeedScout"},
        "datePublished": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
    if sales_entries:
        obj["mentions"] = [{
            "@type": "Event",
            "name": f"{county} County tax-deed sale",
            "startDate": s["date"],
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/MixedEventAttendanceMode",
            "location": {
                "@type": "Place",
                "name": f"{county} County, FL",
            },
        } for s in sales_entries[:5]]
    return json.dumps(obj, indent=2)


def render_cta_block(county, slug, *, index=False):
    msg = """
        <strong>Researching Florida parcels?</strong><br />
        <span class="small">Start with a county, then verify details with the official clerk, property appraiser, or auction source.</span>"""
    if index:
        return f"""
    <div class="cta">
      <div class="cta-msg">{msg}
      </div>
      <a class="btn" href="../tax-deeds.html">Open DeedScout Tax Deeds →</a>
    </div>"""
    county_label = html_escape(county) if county else "this"
    return f"""
    <div class="cta">
      <div class="cta-msg">{msg}
      </div>
      <a class="btn" href="../tax-deeds.html#/county/{html_escape(slug)}">Save {county_label} to watchlist (Pro) →</a>
    </div>"""


def render_page(county, slug, region, cities, sales_entries, surplus_entry,
                permit_coverage, sales_source_url, permit_source_url, base_url,
                county_links_entry=None):
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    lede = (
        f"{county} County is in Florida's {region or 'statewide'} region. "
        f"This page links official clerk, auction, and property appraiser sources for tax-deed research. "
        f"Counts and dates are labeled with data-status badges — verify on official sources before bidding."
    )
    description = f"{county} County, FL tax-deed sales, building permits, and parcel research resources. Updated {today}."
    title = f"{county} County, FL — Tax Deed Sales, Permits & Parcel Research"
    canonical = f"{base_url}/counties/{slug}.html" if base_url else f"counties/{slug}.html"
    body = build_county_body(county, slug, region, cities, sales_entries, surplus_entry,
                             permit_coverage, sales_source_url, permit_source_url, today,
                             county_links_entry=county_links_entry)
    jsonld = build_jsonld(county, slug, base_url, region, sales_entries, permit_coverage, lede)
    return PAGE_TEMPLATE.format(
        title=html_escape(title),
        og_title=html_escape(title),
        description=html_escape(description),
        canonical=html_escape(canonical),
        eyebrow=html_escape(f"Florida → {region or 'County records'}"),
        h1=html_escape(f"{county} County, FL"),
        lede=html_escape(lede),
        body=body,
        cta_block=render_cta_block(county, slug),
        county_name=html_escape(county),
        slug=html_escape(slug),
        generated=html_escape(today),
        jsonld=jsonld,
    )


def permit_source_badge(src, permit_count=None):
    scope = (src.get("scope") or "").lower()
    st = src.get("status") or ""
    if "sample" in scope or st in ("unsupported_paywall", "scaffold"):
        return "Sample/demo", "warn"
    if st == "active" and permit_count:
        return "Cached", "ok"
    if st in ("unsupported_paywall", "scaffold"):
        return "Blocked/manual lookup required", "muted"
    if st == "manual":
        return "Manual source", "muted"
    return "Coming soon", "muted"


def render_index_permit_sections():
    manifest = load_json(PERMIT_MANIFEST, default={"sources": []})
    cov_by = {
        c.get("slug"): c
        for c in (load_json(PERMITS_INDEX, default={"coverage": []}).get("coverage") or [])
    }
    chunks = []

    municipalities = [s for s in manifest.get("sources", []) if s.get("kind") == "municipality"]
    if municipalities:
        rows = []
        for src in sorted(municipalities, key=lambda x: x.get("label", "")):
            slug = slugify(src["label"])
            data_file = src.get("dataFile") or ""
            file_slug = Path(data_file).stem if data_file else slug
            cov = cov_by.get(file_slug) or cov_by.get(slug)
            count = (cov or {}).get("permitCount")
            badge, cls = permit_source_badge(src, count)
            count_txt = f' · {count:,} cached permits' if count and badge == "Cached" else ""
            rows.append(
                f'<li><a href="../municipalities/{html_escape(slug)}.html">'
                f'{html_escape(src["label"])}, {html_escape(src.get("county", ""))} County, FL</a> '
                f'<span class="badge {cls}">Municipality · {html_escape(badge)}</span>{count_txt}</li>'
            )
        chunks.append(
            "<h2>Municipal Permit Sources</h2>"
            "<p class=\"small\">Cities and towns — not Florida counties. Tax deed sales for these areas "
            "are handled by the parent county clerk and auction links.</p>"
            f'<ul class="cities">{"".join(rows)}</ul>'
        )

    regional = [s for s in manifest.get("sources", []) if s.get("kind") == "county"]
    if regional:
        rows = []
        for src in sorted(regional, key=lambda x: x.get("label", "")):
            county_slug = slugify(src.get("county") or src.get("label", ""))
            data_file = src.get("dataFile") or ""
            file_slug = Path(data_file).stem if data_file else county_slug
            cov = cov_by.get(file_slug) or cov_by.get(county_slug)
            count = (cov or {}).get("permitCount")
            badge, cls = permit_source_badge(src, count)
            count_txt = f' · {count} records' if count else ""
            rows.append(
                f'<li><a href="{html_escape(county_slug)}.html">{html_escape(src["label"])}</a> '
                f'· <a href="../permit-search.html?source={html_escape(src.get("id", ""))}">Permit search</a> '
                f'<span class="badge {cls}">Regional permit source · {html_escape(badge)}</span>{count_txt}</li>'
            )
        chunks.append(
            "<h2>Regional / County Permit Sources</h2>"
            "<p class=\"small\">County-level permit portals indexed separately from tax-deed sale pages.</p>"
            f'<ul class="cities">{"".join(rows)}</ul>'
        )

    return "\n".join(chunks)


def render_index_page(counties_data, base_url):
    """Build counties/index.html — region-grouped browse page."""
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    by_region = {}
    for c in counties_data:
        by_region.setdefault(c["region"] or "Other", []).append(c)
    region_order = ["Southeast", "Southwest", "Tampa Bay", "Central", "Northeast", "North Central", "Northwest", "Other"]
    sections = [
        '<h2>Florida Counties</h2>',
        '<p class="small">All 67 official Florida counties for tax-deed research. '
        'Each link opens a county page with clerk, auction, and surplus links — not a city permit page.</p>',
    ]
    for region in region_order:
        items = sorted(by_region.get(region, []), key=lambda x: x["county"])
        if not items:
            continue
        def _row(c):
            permit_suffix = ""
            if c.get("permit_count"):
                permit_suffix = (
                    f' <span class="badge ok">County · Cached · {c["permit_count"]} permits</span>'
                )
            else:
                permit_suffix = ' <span class="badge muted">County · See permit status on page</span>'
            return (
                f'<li><a href="{html_escape(c["slug"])}.html">{html_escape(c["county"])} County, FL</a>'
                f'{permit_suffix}</li>'
            )
        rows = "\n".join(_row(c) for c in items)
        sections.append(f'<h3>{html_escape(region)}</h3><ul class="cities">{rows}</ul>')
    sections.append(render_index_permit_sections())
    body = "\n".join(sections)
    page = PAGE_TEMPLATE.format(
        title="All Florida Counties — DeedScout",
        og_title="Browse all 67 Florida counties — DeedScout",
        description="Tax-deed sale resources, permit coverage, and surplus-funds links for every Florida county. Municipal permit sources listed separately.",
        canonical=f"{base_url}/counties/index.html" if base_url else "counties/index.html",
        eyebrow="Florida → Counties & permit sources",
        h1="Florida Counties Directory",
        lede="Real Florida counties for tax-deed research, plus separate municipal permit sources. Every card shows whether data is cached, sample/demo, or official-link-only.",
        body=body,
        cta_block=render_cta_block("", "", index=True),
        county_name="Florida",
        slug="",
        generated=today,
        jsonld=json.dumps({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Florida Counties — DeedScout",
            "url": f"{base_url}/counties/" if base_url else "counties/",
        }, indent=2),
    )
    return page


def render_sitemap(counties_data, base_url):
    if not base_url:
        base_url = "https://example.com"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = [
        f"{base_url}/",
        f"{base_url}/tax-deeds.html",
        f"{base_url}/parcel-lookup.html",
        f"{base_url}/permit-search.html",
        f"{base_url}/property-intelligence.html",
        f"{base_url}/pricing.html",
        f"{base_url}/about.html",
        f"{base_url}/contact.html",
        f"{base_url}/methodology.html",
        f"{base_url}/data-sources.html",
        f"{base_url}/status.html",
        f"{base_url}/faq.html",
        f"{base_url}/trust.html",
        f"{base_url}/learn/",
        f"{base_url}/learn/florida-tax-deed-sales.html",
        f"{base_url}/learn/florida-surplus-funds.html",
        f"{base_url}/learn/tax-deed-vs-tax-certificate.html",
        f"{base_url}/learn/parcel-research-checklist.html",
        f"{base_url}/municipalities/index.html",
        f"{base_url}/counties/index.html",
    ]
    urls.extend(f"{base_url}/counties/{c['slug']}.html" for c in counties_data)
    body = "\n".join(
        f"  <url><loc>{u}</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq></url>"
        for u in urls
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{body}
</urlset>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="", help="Canonical site root, e.g. https://example.com (no trailing slash)")
    ap.add_argument("--only", help="Comma-separated county names (debug)")
    ap.add_argument("--no-sitemap", action="store_true")
    args = ap.parse_args()

    base_url = (args.base_url or "https://deedscout.netlify.app").rstrip("/")

    sales_doc       = load_json(SALES_PATH, default={"sales": {}})
    surplus_doc     = load_json(SURPLUS_PATH, default={"surplus": {}})
    permits_doc     = load_json(PERMITS_INDEX, default={"coverage": []})
    regions_doc     = load_json(COUNTY_REGIONS, default={"regions": {}, "cityToCounty": {}})
    sales_sources   = load_json(SOURCES_SALES, default={})
    surplus_sources = load_json(SOURCES_SURPLUS, default={})
    permits_sources = load_json(SOURCES_PERMITS, default={})
    county_links    = load_json(COUNTY_LINKS, default={})

    sales_by_county = sales_doc.get("sales") or {}
    surplus_by_county = (surplus_doc.get("surplus") if isinstance(surplus_doc, dict) else {}) or {}
    permits_coverage_by_slug = {c["slug"]: c for c in permits_doc.get("coverage", [])}

    # Build region-of-county lookup
    county_region = {}
    for region, names in (regions_doc.get("regions") or {}).items():
        for n in names:
            county_region[n] = region

    # Build city-of-county inverse
    cities_by_county = {}
    for city, county in (regions_doc.get("cityToCounty") or {}).items():
        cities_by_county.setdefault(county, []).append(city)

    # Universe = official Florida counties only (67). Do not treat municipalities as counties.
    real_counties = set(county_region.keys())
    if county_links:
        real_counties.update(county_links.keys())

    only = set(s.strip() for s in args.only.split(",")) if args.only else None
    if only:
        real_counties = {c for c in real_counties if c in only}

    COUNTIES_DIR.mkdir(parents=True, exist_ok=True)
    counties_data = []
    stats_by_slug = {}
    for county in sorted(real_counties):
        slug = slugify(county)
        region = county_region.get(county) or ""
        cities = cities_by_county.get(county, [])
        sales_entries = sales_by_county.get(county) or []
        surplus_entry = surplus_source_for(county, surplus_by_county, surplus_sources)
        permit_coverage = permits_coverage_by_slug.get(slug)
        sales_src = (sales_sources.get(county) or {}).get("url") if isinstance(sales_sources.get(county), dict) else None
        permit_src = (permits_sources.get(county) or {}).get("portalUrl") if isinstance(permits_sources.get(county), dict) else None
        next_sale = pick_next_sale(sales_entries)

        page_html = render_page(county, slug, region, cities, sales_entries, surplus_entry,
                                permit_coverage, sales_src, permit_src, base_url,
                                county_links_entry=county_links.get(county))
        out = COUNTIES_DIR / f"{slug}.html"
        out.write_text(page_html, encoding="utf-8")
        stats_by_slug[slug] = build_stats_entry(
            county, slug, region, sales_entries, surplus_entry, permit_coverage
        )
        counties_data.append({
            "county": county,
            "slug":   slug,
            "region": region,
            "permit_count": (permit_coverage or {}).get("permitCount"),
            "next_sale": next_sale["date"] if next_sale else None,
        })
        print(f"  wrote counties/{slug}.html  ({region or 'no region'}, "
              f"{len(sales_entries)} sales, "
              f"{(permit_coverage or {}).get('permitCount', 0) if permit_coverage else 0} permits)")

    # Index page + sitemap reflect the FULL universe of counties — only write
    # them when we did a complete run (i.e. no --only filter). With --only the
    # `counties_data` list is partial and would produce a stale/wrong manifest.
    if only:
        print("  (--only) skipped writing counties/index.html, stats.json, and sitemap.xml")
    else:
        index_html = render_index_page(counties_data, base_url)
        (COUNTIES_DIR / "index.html").write_text(index_html, encoding="utf-8")
        print(f"  wrote counties/index.html")

        STATS_PATH.parent.mkdir(parents=True, exist_ok=True)
        stats_doc = {
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "salesGenerated": sales_doc.get("generated"),
            "featuredSlugs": ["palm-beach", "broward", "miami-dade", "orange"],
            "counties": stats_by_slug,
        }
        STATS_PATH.write_text(json.dumps(stats_doc, indent=2), encoding="utf-8")
        print(f"  wrote {STATS_PATH.relative_to(ROOT)}")

        if not args.no_sitemap:
            sitemap = render_sitemap(counties_data, base_url)
            SITEMAP_PATH.write_text(sitemap, encoding="utf-8")
            print(f"  wrote sitemap.xml ({len(counties_data) + 4} urls)")

        # Remove stale municipal pages mistakenly generated under counties/
        valid_slugs = {slugify(c) for c in real_counties}
        orphan_slugs = {
            "west-palm-beach", "boca-raton", "jupiter", "royal-palm-beach",
            "boynton-beach", "st-lucie-county",
        }
        for path in COUNTIES_DIR.glob("*.html"):
            if path.name == "index.html":
                continue
            slug = path.stem
            if slug not in valid_slugs or slug in orphan_slugs:
                path.unlink()
                print(f"  removed stale counties/{path.name}")

    print(f"\nGenerated {len(counties_data)} county pages.")
    if not base_url:
        print("(Tip: pass --base-url https://yoursite.com to bake canonical URLs and sitemap into the output.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
