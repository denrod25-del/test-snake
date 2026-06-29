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
PERMITS_INDEX   = DATA_DIR / "permits" / "index.json"
COUNTY_REGIONS  = DATA_DIR / "county-regions.json"
SALES_PATH      = ROOT / "sales.json"
SURPLUS_PATH    = ROOT / "surplus.json"
SOURCES_SALES   = ROOT / "scraper" / "sources.json"
SOURCES_SURPLUS = ROOT / "scraper" / "sources_surplus.json"
SOURCES_PERMITS = ROOT / "scraper" / "sources_permits.json"
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
        }
    return stats


def html_escape(s):
    if s is None:
        return ""
    return (str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#39;"))


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
<script type="application/ld+json">
{jsonld}
</script>
<style>
  :root {{
    --paper:    #fbf6ec;
    --paper-2:  #f4ede0;
    --ink:      #1f1a13;
    --accent-ink: #7a6240;
    --accent:   #8b5a2b;
    --rule:     #b3a17e;
    --rule-soft:#d8cdb4;
    --muted:    #6e6147;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 16px;
    line-height: 1.55;
  }}
  a {{ color: var(--accent-ink); text-decoration: none; border-bottom: 1px solid rgba(122,98,64,.3); }}
  a:hover {{ color: var(--accent); border-bottom-color: var(--accent); }}
  h1, h2, h3 {{ font-family: 'Cormorant Garamond', serif; font-weight: 600; color: var(--accent-ink); }}
  h1 {{ font-size: 38px; margin: 0 0 8px; line-height: 1.15; letter-spacing: -0.01em; }}
  h2 {{ font-size: 26px; margin: 36px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--rule-soft); }}
  h3 {{ font-size: 19px; margin: 24px 0 6px; }}
  p  {{ margin: 0 0 14px; }}
  .topbar {{
    background: var(--paper-2);
    border-bottom: 1px solid var(--rule);
    padding: 12px 28px;
    font-size: 12px;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }}
  .topbar a {{ color: var(--accent-ink); border: 0; }}
  main {{ max-width: 920px; margin: 0 auto; padding: 36px 28px 80px; }}
  .eyebrow {{
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 8px;
  }}
  .lede {{
    font-family: 'Cormorant Garamond', serif;
    font-size: 21px;
    color: var(--ink);
    line-height: 1.45;
    margin: 0 0 28px;
    max-width: 660px;
  }}
  .stat-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin: 24px 0 32px;
  }}
  .stat {{
    padding: 16px 18px;
    background: var(--paper-2);
    border: 1px solid var(--rule-soft);
    border-left: 3px solid var(--accent-ink);
    border-radius: 2px;
  }}
  .stat .lbl {{
    font-family: 'Inter', sans-serif;
    font-size: 10px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 6px;
  }}
  .stat .val {{
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 600;
    color: var(--accent-ink);
    font-variant-numeric: tabular-nums;
  }}
  .stat .sub {{
    font-size: 11.5px;
    color: var(--muted);
    margin-top: 4px;
  }}
  table {{ border-collapse: collapse; width: 100%; margin: 12px 0 18px; }}
  th, td {{ padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--rule-soft); font-size: 14px; }}
  th {{
    font-family: 'Inter', sans-serif;
    font-size: 10.5px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
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
    background: var(--paper-2);
    border: 1px solid var(--rule);
    border-radius: 2px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }}
  .cta .cta-msg {{ flex: 1 1 380px; }}
  .cta .cta-msg strong {{ font-family: 'Cormorant Garamond', serif; font-size: 18px; color: var(--accent-ink); }}
  .btn {{
    display: inline-block;
    padding: 10px 20px;
    background: var(--accent-ink);
    color: var(--paper);
    border: 0;
    text-decoration: none;
    border-bottom: 0;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
    border-radius: 2px;
  }}
  .btn:hover {{ background: var(--ink); color: var(--paper); border-bottom-color: transparent; }}
  footer {{
    border-top: 1px solid var(--rule-soft);
    padding: 32px 28px;
    text-align: center;
    font-size: 12px;
    color: var(--muted);
  }}
  .small {{ font-size: 12.5px; color: var(--muted); }}
  .badge {{
    display: inline-block;
    padding: 2px 8px;
    background: var(--paper-2);
    border: 1px solid var(--rule-soft);
    border-radius: 10px;
    font-size: 10.5px;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--accent-ink);
    margin-left: 6px;
  }}
  .badge.ok {{ background: #ecf2e6; border-color: #aac199; color: #2f4a2a; }}
  .badge.warn {{ background: #faecdb; border-color: #d8b58a; color: #6b3e1f; }}
  .badge.muted {{ opacity: .6; }}
</style>
</head>
<body>
  <div class="topbar">
    <span><a href="../index.html">Florida Tax Deed Registry</a></span>
    <span><a href="../tax-deeds.html">Registry &amp; tools →</a></span>
  </div>

  <main>
    <p class="eyebrow">{eyebrow}</p>
    <h1>{h1}</h1>
    <p class="lede">{lede}</p>

    {body}

    <div class="cta">
      <div class="cta-msg">
        <strong>Researching parcels in {county_name} County?</strong><br />
        <span class="small">Open the live registry for upcoming auctions, statute references, and a personal research notebook.</span>
      </div>
      <a class="btn" href="../tax-deeds.html#/county/{slug}">Open registry →</a>
    </div>
  </main>

  <footer>
    <p>
      Generated {generated} from public county data.
      <a href="../tax-deeds.html">Live tools</a> ·
      <a href="../parcel-lookup.html">Palm Beach parcel lookup</a> ·
      <a href="index.html">All counties</a>
    </p>
    <p class="small">
      This is an information resource, not legal advice. Tax-deed investing carries real risk; always verify
      current statute text at <a href="https://www.flsenate.gov/Laws/Statutes/2024/Chapter197" target="_blank" rel="noopener">flsenate.gov</a>
      and consult an attorney before bidding.
    </p>
  </footer>
</body>
</html>
"""


def build_county_body(county, region, cities, sales_entries, surplus_entry,
                      permit_coverage, sales_source_url, permit_source_url):
    """Compose the per-county body HTML."""
    parts = []

    # ----- Stat grid -----
    next_sale = pick_next_sale(sales_entries)
    next_sale_str = fmt_date_iso(next_sale["date"]) if next_sale else "Not currently scheduled"
    next_sale_count = next_sale.get("count") if next_sale else None
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
        <div class="sub">{html_escape(f'{next_sale_count} parcels' if next_sale_count else 'Date from public auction site')}</div>
      </div>
    """)
    permit_label = {
        "active":      ("Live · daily scrape", "ok"),
        "stale":       ("Cached · scrape pending refresh", "warn"),
        "manual":      ("Manual entries only", ""),
        "available":   ("Portal lookup only", "muted"),
        "unsupported": ("No public portal", "muted"),
    }.get(permit_status, (permit_status, ""))
    stat_cells.append(f"""
      <div class="stat">
        <div class="lbl">Building permits</div>
        <div class="val">{html_escape(str(permit_count) if permit_count is not None else '—')}<span class="badge {permit_label[1]}">{html_escape(permit_label[0])}</span></div>
        <div class="sub">{'Indexed by parcel ID for instant lookup' if permit_count else 'Use county portal for ad-hoc lookups'}</div>
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
        parts.append(f"<p>No upcoming sales currently published for {html_escape(county)} County. "
                     f"This usually means the county hasn't posted the next batch yet, or sales are conducted in person at the courthouse.")
        if sales_source_url:
            parts.append(f' Check the official auction site: <a href="{html_escape(sales_source_url)}" target="_blank" rel="noopener">{html_escape(sales_source_url)}</a>.</p>')
        else:
            parts.append("</p>")

    # ----- Permits -----
    parts.append("<h2>Building permits</h2>")
    if permit_status in ("active", "stale", "manual"):
        scope = (permit_coverage or {}).get("scope", "Recent permits")
        parts.append(f"<p>{html_escape(str(permit_count) if permit_count else 'Permit')} records on file for {html_escape(county)} County, "
                     f"scope: {html_escape(scope)}. Permits are indexed by parcel ID and surface automatically inside the "
                     f'<a href="../tax-deeds.html#/county/{slugify(county)}">research notebook</a> when you enter a PCN.</p>')
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

    # ----- Cities served -----
    if cities:
        parts.append("<h2>Cities and municipalities</h2>")
        parts.append('<ul class="cities">')
        for city in sorted(set(cities)):
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
        "publisher": {"@type": "Organization", "name": "Florida Tax Deed Registry"},
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


def render_page(county, slug, region, cities, sales_entries, surplus_entry,
                permit_coverage, sales_source_url, permit_source_url, base_url):
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    lede = (
        f"{county} County is in the {region or 'Florida'} region of Florida. "
        f"This page aggregates the public records relevant to tax-deed investors: "
        f"upcoming auction dates, building-permit history, and surplus-funds resources."
    )
    description = f"{county} County, FL tax-deed sales, building permits, and parcel research resources. Updated {today}."
    title = f"{county} County, FL — Tax Deed Sales, Permits & Parcel Research"
    canonical = f"{base_url}/counties/{slug}.html" if base_url else f"counties/{slug}.html"
    body = build_county_body(county, region, cities, sales_entries, surplus_entry,
                             permit_coverage, sales_source_url, permit_source_url)
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
        county_name=html_escape(county),
        slug=html_escape(slug),
        generated=html_escape(today),
        jsonld=jsonld,
    )


def render_index_page(counties_data, base_url):
    """Build counties/index.html — region-grouped browse page."""
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    by_region = {}
    for c in counties_data:
        by_region.setdefault(c["region"] or "Other", []).append(c)
    region_order = ["Southeast", "Southwest", "Tampa Bay", "Central", "Northeast", "North Central", "Northwest", "Other"]
    sections = []
    for region in region_order:
        items = sorted(by_region.get(region, []), key=lambda x: x["county"])
        if not items:
            continue
        def _row(c):
            permit_suffix = ""
            if c.get("permit_count"):
                permit_suffix = f' <span class="small">· {c["permit_count"]} permits</span>'
            return (f'<li><a href="{html_escape(c["slug"])}.html">'
                    f'{html_escape(c["county"])}</a>{permit_suffix}</li>')
        rows = "\n".join(_row(c) for c in items)
        sections.append(f'<h2>{html_escape(region)}</h2><ul class="cities">{rows}</ul>')
    body = "\n".join(sections)
    page = PAGE_TEMPLATE.format(
        title="All Florida Counties — Tax Deed Registry",
        og_title="Browse all 67 Florida counties",
        description="Tax-deed sale dates, permit records, and surplus-funds resources for every Florida county. Updated daily.",
        canonical=f"{base_url}/counties/index.html" if base_url else "counties/index.html",
        eyebrow="Florida → Browse by region",
        h1="All Florida Counties",
        lede="Public-record summaries for every Florida county, organized by region. Each county page aggregates upcoming tax-deed sales, building-permit coverage, and surplus-funds links.",
        body=body,
        county_name="Florida",
        slug="",
        generated=today,
        jsonld=json.dumps({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Florida Counties — Tax Deed Registry",
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

    base_url = (args.base_url or "").rstrip("/")

    sales_doc       = load_json(SALES_PATH, default={"sales": {}})
    surplus_doc     = load_json(SURPLUS_PATH, default={"surplus": {}})
    permits_doc     = load_json(PERMITS_INDEX, default={"coverage": []})
    regions_doc     = load_json(COUNTY_REGIONS, default={"regions": {}, "cityToCounty": {}})
    sales_sources   = load_json(SOURCES_SALES, default={})
    surplus_sources = load_json(SOURCES_SURPLUS, default={})
    permits_sources = load_json(SOURCES_PERMITS, default={})

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

    # Universe of all counties = union of regions + permits coverage + sales-sources.
    # permits_coverage_by_slug keys are slugs ("alachua"), regions/sales/permit-sources
    # keys are human names ("Alachua"). Normalize everything to the canonical
    # human-readable name before deduping.
    real_counties = set()

    def _add(name_or_slug):
        if not name_or_slug or str(name_or_slug).startswith("_"):
            return
        # If it looks like a slug and has a coverage entry, use the human name.
        coverage = permits_coverage_by_slug.get(name_or_slug)
        if coverage and coverage.get("county"):
            real_counties.add(coverage["county"])
        else:
            real_counties.add(name_or_slug)

    for x in county_region.keys():        _add(x)
    for x in permits_coverage_by_slug:    _add(x)
    for x in sales_sources.keys():        _add(x)
    for x in permits_sources.keys():      _add(x)

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
                                permit_coverage, sales_src, permit_src, base_url)
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

    print(f"\nGenerated {len(counties_data)} county pages.")
    if not base_url:
        print("(Tip: pass --base-url https://yoursite.com to bake canonical URLs and sitemap into the output.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
