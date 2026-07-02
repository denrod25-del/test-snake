"""
build_site_fallbacks.py
-----------------------
Inject crawlable/no-JS HTML fallbacks into key DeedScout pages.

Run after data scrapes and inventory build:
    python scripts/build_data_inventory.py
    python scripts/build_site_fallbacks.py
"""

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MAJOR_COUNTIES = {
    "Alachua", "Bay", "Brevard", "Broward", "Collier", "Duval", "Escambia",
    "Hillsborough", "Lee", "Leon", "Martin", "Miami-Dade", "Monroe", "Orange",
    "Palm Beach", "Pasco", "Pinellas", "Polk", "Sarasota", "Seminole",
    "St. Lucie", "Volusia",
}


def load_json(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def infer_format(entry):
    au = entry.get("auction") or {}
    label = (au.get("label") or "").lower()
    url = (au.get("url") or "").lower()
    clerk = ((entry.get("clerk") or {}).get("url") or "").lower()
    if "in-person" in label or "courthouse" in label:
        return "in-person"
    if any(x in url for x in ("realtaxdeed", "lienhub", "bid4assets", "govease", "deedauction")):
        return "online"
    if url and clerk and url != clerk:
        return "online"
    return "in-person"


def fmt_date(iso):
    if not iso:
        return "—"
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%b %d, %Y")
    except ValueError:
        return str(iso)[:10]


def status_badge(status):
    labels = {
        "live": "Live",
        "cached": "Cached",
        "sample": "Sample",
        "blocked": "Blocked",
        "broken": "Broken",
        "coming-soon": "Coming Soon",
    }
    cls = status.replace("coming-soon", "soon")
    return f'<span class="ds-status ds-status-{html.escape(cls)}">{html.escape(labels.get(status, status))}</span>'


def build_county_registry_rows(links):
    rows = []
    for name in sorted(links.keys()):
        e = links[name]
        slug = slugify(name)
        fmt = infer_format(e)
        major = name in MAJOR_COUNTIES
        pa = e.get("pa") or {}
        clerk = e.get("clerk") or {}
        auction = e.get("auction") or {}
        region = e.get("region") or "Florida"
        auction_cell = (
            f'<a href="{html.escape(auction.get("url", ""))}" target="_blank" rel="noopener">{html.escape(auction.get("label") or auction.get("url") or "—")}</a>'
            if fmt == "online" and auction.get("url")
            else f'<span class="secondary">{html.escape(auction.get("label") or "In-Person at Courthouse")}</span>'
        )
        rows.append(
            f'<tr data-name="{html.escape(name.lower())}" data-region="{html.escape(region.lower())}" '
            f'data-format="{fmt}" data-major="{str(major).lower()}" data-upcoming="false" data-county="{html.escape(name.lower())}">'
            f'<td data-label="County"><a class="county-name county-link" href="#/county/{slug}">{html.escape(name)}</a>'
            f'<span class="county-region">{html.escape(region)}</span></td>'
            f'<td data-label="Property Appraiser" class="link-cell"><a href="{html.escape(pa.get("url", ""))}" target="_blank" rel="noopener">{html.escape(pa.get("label") or pa.get("url") or "—")}</a></td>'
            f'<td data-label="Clerk of Court" class="link-cell"><a href="{html.escape(clerk.get("url", ""))}" target="_blank" rel="noopener">{html.escape(clerk.get("label") or clerk.get("url") or "—")}</a></td>'
            f'<td data-label="Online Auction" class="link-cell">{auction_cell}</td>'
            f'<td data-label="Format"><span class="badge {fmt}">{"Online" if fmt == "online" else "In-Person"}</span></td></tr>'
        )
    return "\n          ".join(rows)


def build_inventory_table(inventory):
    head = (
        "<thead><tr><th>Dataset</th><th>Jurisdiction</th><th>Status</th><th>Records</th>"
        "<th>Last success</th><th>Last attempt</th><th>Limitations</th><th>Verify</th></tr></thead>"
    )
    body_rows = []
    for r in inventory.get("rows") or []:
        name = (r.get("category") + " — " if r.get("category") else "") + r.get("name", "")
        src = r.get("sourceUrl") or ""
        body_rows.append(
            "<tr>"
            f'<td><strong>{html.escape(name)}</strong>'
            + (f'<div class="ds-status-sub"><a href="{html.escape(src)}" target="_blank" rel="noopener">{html.escape(src.replace("https://", "").replace("http://", "")[:60])}</a></div>' if src else "")
            + f"</td><td>{html.escape(r.get('jurisdiction') or '—')}</td>"
            f"<td>{status_badge(r.get('status') or 'coming-soon')}</td>"
            f"<td>{html.escape(str(r['count'])) if r.get('count') is not None else '—'}</td>"
            f"<td>{html.escape(fmt_date(r.get('lastSuccess')))}</td>"
            f"<td>{html.escape(fmt_date(r.get('lastAttempt')))}</td>"
            f"<td>{html.escape(r.get('limitations') or '—')}</td>"
            f"<td>{html.escape(r.get('verification') or '—')}</td>"
            "</tr>"
        )
    return (
        f'<p class="ds-status-sub">Inventory generated {html.escape(fmt_date(inventory.get("generated")))} · '
        f'<a href="data/data-inventory.json">JSON</a></p>'
        f'<div class="ds-table-wrap"><table class="ds-source-table ds-dataset-table">{head}<tbody>'
        + "".join(body_rows)
        + "</tbody></table></div>"
    )


def build_calendar_fallback(links):
    online = sorted(n for n in links if infer_format(links[n]) == "online")
    if not online:
        return (
            '<div class="cal-card"><div class="cal-card-head"><div class="cal-when">Auction calendar</div>'
            '<div class="cal-count">Status on Data Sources</div></div>'
            '<div class="cal-counties"><span class="cal-pill">Enable JavaScript for interactive schedule.</span></div></div>'
        )
    preview = online[:12]
    pills = "".join(
        f'<span class="cal-pill">{html.escape(n)}</span>' for n in preview
    )
    more = f'<span class="cal-pill">+{len(online) - len(preview)} more online counties</span>' if len(online) > len(preview) else ""
    return (
        f'<div class="cal-card"><div class="cal-card-head"><div class="cal-when">{len(online)} online auction counties</div>'
        f'<div class="cal-count">Typical weekday schedule in app</div></div>'
        f'<div class="cal-counties">{pills}{more}</div></div>'
    )


def build_upcoming_fallback(inventory):
    rows = inventory.get("rows") or []
    auction = next((r for r in rows if "auction" in (r.get("name") or "").lower()), None)
    if auction and auction.get("status") == "broken":
        return (
            '<p class="calendar-intro" style="padding:24px 0;color:var(--muted);">Automated sale-date scrape is currently unavailable (upstream 403). '
            'Verify dates on each county&apos;s official clerk or auction site — see <a href="data-sources.html">Data Sources</a>.</p>'
        )
    if auction and auction.get("lastSuccess"):
        return (
            f'<p class="calendar-intro">Last successful sale scrape: {html.escape(fmt_date(auction.get("lastSuccess")))}. '
            f'Open the app for upcoming dates or verify on official clerk sites.</p>'
        )
    return (
        '<p class="calendar-intro" style="padding:24px 0;color:var(--muted);">Sale calendar status available on '
        '<a href="data-sources.html">Data Sources</a>. Always verify dates on official clerk sites.</p>'
    )


def build_permit_coverage_fallback(index_doc):
    cov = index_doc.get("coverage") or []
    if not cov:
        return (
            "4 cached Tyler cities · 3 sample sources",
            '<div class="permits-coverage-card is-active"><div class="pcc-name">West Palm Beach</div>'
            '<div class="pcc-status">Cached municipal scrape</div>'
            '<span class="pcc-count">~4,000 permits</span></div>'
            '<div class="permits-coverage-card is-active"><div class="pcc-name">Boca Raton</div>'
            '<div class="pcc-status">Cached municipal scrape</div></div>'
            '<div class="permits-coverage-card is-stale"><div class="pcc-name">Palm Beach (uninc.)</div>'
            '<div class="pcc-status">Sample or stale cache</div>'
            '<span class="pcc-count">4 sample permits</span></div>',
        )
    counts = {}
    for c in cov:
        counts[c.get("status")] = counts.get(c.get("status"), 0) + 1
    active = counts.get("active", 0)
    stale = counts.get("stale", 0)
    meta = f"{active} cached Tyler · {stale} sample/other · updated {fmt_date(index_doc.get('generated'))}"
    cards = []
    status_labels = {
        "active": "Cached municipal scrape",
        "stale": "Sample or stale cache",
        "manual": "Manual entries",
        "available": "Portal lookup only",
        "unsupported": "No public portal",
    }
    for c in sorted(cov, key=lambda x: x.get("county", "")):
        st = c.get("status") or "available"
        cls = f"is-{st}"
        portal = c.get("portalUrl")
        plink = (
            f'<a class="pcc-link" href="{html.escape(portal)}" target="_blank" rel="noopener">Portal →</a>'
            if portal
            else ""
        )
        cnt = ""
        if c.get("permitCount") is not None and st in ("active", "stale", "manual"):
            cnt = f'<span class="pcc-count">{c["permitCount"]} permits</span>'
        cards.append(
            f'<div class="permits-coverage-card {cls}"><div class="pcc-name">{html.escape(c.get("county", ""))}</div>'
            f'<div class="pcc-status">{html.escape(status_labels.get(st, st))}</div>{cnt}{plink}</div>'
        )
    return meta, "".join(cards)


def badge_html(cls, text):
    return f'<span class="county-badge {cls}">{html.escape(text)}</span>'


def county_badges(entry):
    if not entry:
        return badge_html("muted", "Status on Data Sources")
    badges = []
    if entry.get("nextSale") and entry["nextSale"].get("shortLabel"):
        badges.append(badge_html("sale", "Next sale · " + entry["nextSale"]["shortLabel"] + " (verify)"))
    else:
        badges.append(badge_html("muted", "No verified sale date"))
    if entry.get("surplusPortal"):
        badges.append(badge_html("surplus", "Surplus portal linked"))
    return "".join(badges)


def replace_block(text, marker, content):
    pattern = re.compile(
        rf"<!-- @build:{re.escape(marker)}:start -->.*?<!-- @build:{re.escape(marker)}:end -->",
        re.DOTALL,
    )
    block = f"<!-- @build:{marker}:start -->\n{content}\n          <!-- @build:{marker}:end -->"
    if pattern.search(text):
        return pattern.sub(block, text, count=1)
    return text


def main():
    links = load_json(ROOT / "data" / "county-links.json", {})
    inventory = load_json(ROOT / "data" / "data-inventory.json", {"rows": []})
    stats = load_json(ROOT / "data" / "counties" / "stats.json", {})
    permits_index = load_json(ROOT / "data" / "permits" / "index.json", {})

    registry_rows = build_county_registry_rows(links)
    inventory_html = build_inventory_table(inventory)
    permit_meta, permit_cards = build_permit_coverage_fallback(permits_index)
    calendar_html = build_calendar_fallback(links)
    upcoming_html = build_upcoming_fallback(inventory)

    # tax-deeds.html
    td_path = ROOT / "tax-deeds.html"
    td = td_path.read_text(encoding="utf-8")
    td = replace_block(td, "county-registry-tbody", registry_rows)
    td = replace_block(td, "permits-coverage-meta", html.escape(permit_meta))
    td = replace_block(td, "permits-coverage-grid", permit_cards)
    td = replace_block(td, "calendar-grid", calendar_html)
    td = replace_block(td, "upcoming-list", upcoming_html)
    if 'id="permitsCoverageMeta">Loading…</' in td:
        td = td.replace('id="permitsCoverageMeta">Loading…</', f'id="permitsCoverageMeta">{html.escape(permit_meta)}</')
    td_path.write_text(td, encoding="utf-8")

    # data-sources.html
    ds_path = ROOT / "data-sources.html"
    ds = ds_path.read_text(encoding="utf-8")
    ds = replace_block(ds, "inventory-table", inventory_html)
    ds_path.write_text(ds, encoding="utf-8")

    # index.html featured badges + last updated
    idx_path = ROOT / "index.html"
    idx = idx_path.read_text(encoding="utf-8")
    for slug in ("palm-beach", "broward", "miami-dade", "orange"):
        entry = (stats.get("counties") or {}).get(slug)
        badges = county_badges(entry)
        idx = replace_block(idx, f"badges-{slug}", badges)
    last_updated = fmt_date(stats.get("generated")) if stats.get("generated") else "See Data Sources"
    idx = replace_block(idx, "stats-generated", html.escape(last_updated))
    if 'id="stats-generated">Loading…</' in idx:
        idx = idx.replace('id="stats-generated">Loading…</', f'id="stats-generated">{html.escape(last_updated)}</')
    idx_path.write_text(idx, encoding="utf-8")

    # trust.html inventory section
    trust_path = ROOT / "trust.html"
    if trust_path.exists():
        trust = trust_path.read_text(encoding="utf-8")
        trust = replace_block(trust, "inventory-table", inventory_html)
        trust_path.write_text(trust, encoding="utf-8")

    print(f"Injected fallbacks: {len(links)} county rows, {len(inventory.get('rows') or [])} inventory rows")


if __name__ == "__main__":
    main()
