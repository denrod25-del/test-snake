#!/usr/bin/env python3
"""
Build an outreach-ready lead list from the Florida contractor spreadsheet.

Focus: Family-Owned + Independent shops in priority counties, enriched with
phone/website from data/companies.json where names match.

Outputs (data/florida-contractors/outreach/):
  - call-ready.csv          — has phone; ready to dial
  - research-queue.csv      — priority counties, no phone yet
  - plumbing-leads-import.json — shape for plumbing-leads SQLite import
  - outreach-board.html     — browse + copy SMS/email scripts
  - README.md

Usage:
  python scripts/build_outreach_leads.py
  python scripts/build_outreach_leads.py --import-plumbing-leads plumbing-leads/leads.db
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

PRIORITY_COUNTIES = [
    "Palm Beach",
    "Broward",
    "Miami-Dade",
    "Martin",
    "St. Lucie",
    "Lee",
    "Collier",
    "Hillsborough",
    "Pinellas",
    "Orange",
    "Duval",
    "Sarasota",
    "Manatee",
    "Pasco",
]

STOP = {
    "LLC",
    "INC",
    "INCORPORATED",
    "CORP",
    "CORPORATION",
    "CO",
    "LTD",
    "PLLC",
    "PA",
    "PC",
    "THE",
    "AND",
    "OF",
    "FLORIDA",
    "FL",
    "PLUMBING",
    "PLUMBER",
    "AIR",
    "HEATING",
    "COOLING",
    "HVAC",
    "CONDITIONING",
    "ELECTRICAL",
    "ELECTRIC",
    "SERVICES",
    "SERVICE",
}


def normalize(name: str) -> str:
    s = (name or "").upper()
    s = re.sub(r"[^A-Z0-9\s&]", " ", s)
    s = re.sub(r"\b(" + "|".join(STOP) + r")\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(name: str) -> set[str]:
    return {t for t in normalize(name).split() if len(t) >= 3}


def load_maps(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data.get("companies") or []


def index_maps(companies: list[dict]):
    by_norm: dict[str, dict] = {}
    by_tok: dict[str, list] = defaultdict(list)
    for c in companies:
        key = normalize(c.get("name") or "")
        if not key:
            continue
        reviews = ((c.get("platforms") or {}).get("google") or {}).get("reviews") or 0
        prev = by_norm.get(key)
        if not prev or reviews >= (((prev.get("platforms") or {}).get("google") or {}).get("reviews") or 0):
            by_norm[key] = c
        for tok in tokens(c.get("name") or ""):
            if len(tok) >= 4:
                by_tok[tok].append(c)
    return by_norm, by_tok


def same_place(row: dict, maps: dict) -> bool:
    rc = (row.get("county") or "").lower()
    mc = (maps.get("county") or "").lower()
    if rc and mc and rc == mc:
        return True
    rcity = (row.get("city") or "").lower()
    mcity = (maps.get("city") or "").lower()
    if rcity and mcity and (rcity == mcity or rcity in mcity or mcity in rcity):
        return True
    return False


def match_maps(row: dict, by_norm, by_tok) -> tuple[dict | None, str]:
    key = normalize(row["company_name"])
    hit = by_norm.get(key)
    if hit:
        return hit, "exact_name"
    rt = tokens(row["company_name"])
    if len(rt) < 2:
        return None, ""
    cands: dict[int, dict] = {}
    for tok in rt:
        if len(tok) < 4:
            continue
        for c in by_tok.get(tok, []):
            cands[id(c)] = c
    best = None
    best_score = 0.0
    for c in cands.values():
        ct = tokens(c.get("name") or "")
        if not ct:
            continue
        inter = len(rt & ct)
        union = len(rt | ct)
        score = inter / union if union else 0.0
        if score < 0.75 or inter < 2:
            continue
        if not same_place(row, c):
            continue
        if score > best_score:
            best_score = score
            best = c
    if best:
        return best, f"fuzzy_{best_score:.2f}"
    return None, ""


def ownership_ok(row: dict) -> bool:
    o = row.get("ownership_type") or ""
    return o == "Family-Owned" or o.startswith("Independent")


def trade_ok(row: dict) -> bool:
    t = (row.get("trade") or "").lower()
    # Prefer plumbing or plumbing+hvac for PalmLeads-style outreach; keep HVAC too.
    return True


def lead_tier(row: dict, has_phone: bool) -> str:
    county = row.get("county") or ""
    ownership = row.get("ownership_type") or ""
    if has_phone and ownership == "Family-Owned" and county in PRIORITY_COUNTIES:
        return "A — Family + phone + priority county"
    if has_phone and county in PRIORITY_COUNTIES:
        return "B — Phone + priority county"
    if has_phone:
        return "C — Phone (other FL county)"
    if county in PRIORITY_COUNTIES:
        return "D — Priority county, needs phone research"
    return "E — Other"


def build_leads(contractor_csv: Path, companies_json: Path) -> list[dict]:
    rows = [
        r
        for r in csv.DictReader(contractor_csv.open(encoding="utf-8"))
        if ownership_ok(r) and trade_ok(r) and (r.get("county") or "") != "Out of State"
    ]
    maps = load_maps(companies_json)
    by_norm, by_tok = index_maps(maps)

    leads = []
    for r in rows:
        maps_hit, how = match_maps(r, by_norm, by_tok)
        phone = (r.get("phone") or "").strip()
        website = (r.get("website") or "").strip()
        rating = r.get("google_rating") or ""
        reviews = r.get("google_reviews") or ""
        place_id = ""
        google_url = ""
        services = r.get("maps_services") or ""
        match_note = r.get("enrichment_source") or ""

        if maps_hit:
            phone = phone or (maps_hit.get("phone") or "")
            website = website or (maps_hit.get("website") or "").split("?")[0].rstrip("/")
            g = (maps_hit.get("platforms") or {}).get("google") or {}
            rating = rating or g.get("rating") or ""
            reviews = reviews or g.get("reviews") or ""
            place_id = maps_hit.get("_googlePlaceId") or maps_hit.get("id") or ""
            google_url = maps_hit.get("_googleUrl") or ""
            if not services:
                services = ", ".join(maps_hit.get("services") or [])
            if not r.get("address") and maps_hit.get("address"):
                r["address"] = maps_hit["address"]
            match_note = f"companies.json ({how})"

        has_phone = bool(phone)
        # Keep priority-county rows even without phone; drop non-priority with no phone
        # to keep the outreach file focused.
        county = r.get("county") or ""
        if not has_phone and county not in PRIORITY_COUNTIES:
            continue

        tier = lead_tier(r, has_phone)
        leads.append(
            {
                "tier": tier,
                "company_name": r["company_name"],
                "trade": r.get("trade") or "",
                "ownership_type": r.get("ownership_type") or "",
                "ownership_confidence": r.get("ownership_confidence") or "",
                "county": county,
                "city": r.get("city") or "",
                "zip": r.get("zip") or "",
                "address": r.get("address") or "",
                "phone": phone,
                "website": website,
                "google_rating": rating,
                "google_reviews": reviews,
                "google_place_id": place_id,
                "google_url": google_url,
                "services": services,
                "license_types": r.get("license_types") or "",
                "license_numbers": r.get("license_numbers") or "",
                "active_license_count": r.get("active_license_count") or "",
                "parent_company_or_notes": r.get("parent_company_or_notes") or "",
                "match_source": match_note,
                "status": "new",
                "notes": "",
            }
        )

    def sort_key(L):
        tier_rank = L["tier"][:1]
        try:
            reviews = int(float(L["google_reviews"] or 0))
        except ValueError:
            reviews = 0
        return (tier_rank, 0 if L["county"] in PRIORITY_COUNTIES else 1, -reviews, L["company_name"].upper())

    leads.sort(key=sort_key)
    return leads


OUTREACH_COLUMNS = [
    "tier",
    "company_name",
    "trade",
    "ownership_type",
    "county",
    "city",
    "zip",
    "address",
    "phone",
    "website",
    "google_rating",
    "google_reviews",
    "services",
    "license_types",
    "license_numbers",
    "status",
    "notes",
    "match_source",
    "google_place_id",
    "google_url",
    "ownership_confidence",
    "parent_company_or_notes",
    "active_license_count",
]


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUTREACH_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in OUTREACH_COLUMNS})


def to_plumbing_leads_shape(leads: list[dict]) -> list[dict]:
    out = []
    for i, L in enumerate(leads):
        if not L.get("phone"):
            continue
        place_id = L.get("google_place_id") or f"dbpr-{normalize(L['company_name'])[:40]}-{i}"
        out.append(
            {
                "place_id": place_id,
                "name": L["company_name"],
                "address": L.get("address") or f"{L.get('city','')}, FL {L.get('zip','')}".strip(),
                "phone": L.get("phone") or "",
                "website": L.get("website") or "",
                "rating": float(L["google_rating"]) if L.get("google_rating") not in ("", None) else None,
                "reviews": int(float(L["google_reviews"])) if L.get("google_reviews") not in ("", None) else 0,
                "google_url": L.get("google_url") or "",
                "business_status": "OPERATIONAL",
                "types": [L.get("trade") or "Plumber"],
                "lat": None,
                "lng": None,
                "no_website": 0 if L.get("website") else 1,
                "status": "new",
                "notes": f"{L.get('tier','')} | {L.get('ownership_type','')} | {L.get('county','')}",
            }
        )
    return out


def import_plumbing_leads(db_path: Path, leads: list[dict]) -> dict:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    shaped = to_plumbing_leads_shape(leads)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS leads (
            place_id           TEXT PRIMARY KEY,
            name               TEXT NOT NULL,
            address            TEXT,
            phone              TEXT,
            website            TEXT,
            rating             REAL,
            reviews            INTEGER,
            google_url         TEXT,
            business_status    TEXT,
            types              TEXT,
            services           TEXT,
            emails             TEXT,
            socials            TEXT,
            lat                REAL,
            lng                REAL,
            no_website         INTEGER DEFAULT 0,
            status             TEXT DEFAULT 'new',
            notes              TEXT DEFAULT '',
            created_at         TEXT NOT NULL,
            updated_at         TEXT NOT NULL,
            last_enriched_at   TEXT
        );
        """
    )
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    inserted = skipped = 0
    for lead in shaped:
        exists = conn.execute(
            "SELECT 1 FROM leads WHERE place_id = ?", (lead["place_id"],)
        ).fetchone()
        if exists:
            skipped += 1
            continue
        conn.execute(
            """
            INSERT INTO leads (
              place_id, name, address, phone, website, rating, reviews,
              google_url, business_status, types, services, emails, socials,
              lat, lng, no_website, status, notes, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                lead["place_id"],
                lead["name"],
                lead["address"],
                lead["phone"],
                lead["website"],
                lead["rating"],
                lead["reviews"],
                lead["google_url"],
                lead["business_status"],
                json.dumps(lead["types"]),
                "[]",
                "[]",
                "{}",
                lead["lat"],
                lead["lng"],
                lead["no_website"],
                lead["status"],
                lead["notes"],
                now,
                now,
            ),
        )
        inserted += 1
    conn.commit()
    conn.close()
    return {"inserted": inserted, "skipped_duplicates": skipped, "candidates": len(shaped)}


def render_templates(lead: dict) -> dict[str, str]:
    name = lead.get("company_name") or "there"
    first = name.split()[0]
    city = lead.get("city") or lead.get("county") or "your area"
    rating = lead.get("google_rating")
    reviews = lead.get("google_reviews") or 0
    try:
        rating_f = float(rating) if rating not in ("", None) else None
    except ValueError:
        rating_f = None
    try:
        reviews_i = int(float(reviews)) if reviews not in ("", None) else 0
    except ValueError:
        reviews_i = 0
    rating_line = (
        f"Saw your {rating_f:.1f}★ ({reviews_i:,} reviews) on Google — "
        if rating_f
        else ""
    )
    no_site = (
        " I noticed you don't have a website yet, so this could be a simple extra job channel."
        if not lead.get("website")
        else ""
    )
    return {
        "sms": (
            f"Hi {first} — this is Alex with PalmLeads. We send {city} homeowners "
            f"who need a plumber/HVAC tech NOW to local family shops. No upfront fee — "
            f"you only pay for qualified leads. Open to a 5-min call this week?"
        ),
        "email_subject": f"Ready-to-call homeowner leads in {city} (no upfront cost)",
        "email": (
            f"Hi {first},\n\n"
            f"{rating_line}looks like {name} is a solid local shop in {city}.\n\n"
            f"I run PalmLeads. We capture homeowners actively searching for plumbing "
            f"or HVAC help and route them to one local pro.{no_site}\n\n"
            f"How it works:\n"
            f"  • No setup fees / no monthly retainer\n"
            f"  • Pay per qualified lead only\n"
            f"  • Pause anytime\n\n"
            f"Worth a 10-minute call this week?\n\n"
            f"Thanks,\nAlex\nPalmLeads\n"
        ),
    }


def write_html(path: Path, call_ready: list[dict], summary: dict) -> None:
    # Embed call-ready only (keeps file usable). Cap display at 800 for speed.
    display = call_ready[:800]
    payload = []
    for L in display:
        t = render_templates(L)
        payload.append(
            {
                **{k: L.get(k, "") for k in (
                    "tier", "company_name", "trade", "ownership_type", "county",
                    "city", "phone", "website", "google_rating", "google_reviews",
                    "address", "services",
                )},
                "sms": t["sms"],
                "email_subject": t["email_subject"],
                "email": t["email"],
            }
        )
    data = json.dumps({"summary": summary, "leads": payload}, ensure_ascii=False)
    data = data.replace("<", "\\u003c").replace(">", "\\u003e")
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FL Outreach Board — Family / Independent</title>
<style>
  :root {{ --bg:#eef3ef; --ink:#17231c; --muted:#5b6b62; --panel:#fff; --line:#d5e0d8; --go:#0f6b4c; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:"Segoe UI",system-ui,sans-serif; background:linear-gradient(180deg,#e7f0ea,#eef3ef 30%); color:var(--ink); }}
  header,main {{ max-width:1100px; margin:0 auto; padding:20px; }}
  h1 {{ margin:0 0 6px; font-size:1.6rem; }}
  .sub {{ color:var(--muted); }}
  .stats {{ display:flex; flex-wrap:wrap; gap:8px; margin:14px 0; }}
  .stat {{ background:var(--panel); border:1px solid var(--line); padding:8px 12px; }}
  .stat b {{ display:block; font-size:1.2rem; }}
  .controls {{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }}
  input,select {{ padding:9px 10px; border:1px solid var(--line); background:#fff; font:inherit; }}
  input[type=search] {{ flex:1; min-width:200px; }}
  .card {{ background:var(--panel); border:1px solid var(--line); padding:14px; margin-bottom:10px; }}
  .card h3 {{ margin:0 0 4px; font-size:1.05rem; }}
  .meta {{ color:var(--muted); font-size:0.9rem; margin-bottom:8px; }}
  .tier {{ display:inline-block; font-size:0.78rem; border:1px solid var(--go); color:var(--go); padding:1px 7px; margin-right:6px; }}
  .row {{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }}
  a {{ color:var(--go); }}
  button {{ border:1px solid var(--ink); background:var(--ink); color:#fff; padding:7px 10px; cursor:pointer; font:inherit; }}
  button.secondary {{ background:#fff; color:var(--ink); }}
  pre {{ white-space:pre-wrap; background:#f4f7f5; border:1px solid var(--line); padding:10px; font-size:0.88rem; display:none; }}
  pre.show {{ display:block; }}
</style>
</head>
<body>
<header>
  <h1>Outreach board — family / independent FL shops</h1>
  <p class="sub">Call-ready leads (have a phone). Corporate and franchise brands are excluded. Copy SMS/email scripts per shop.</p>
  <div class="stats" id="stats"></div>
</header>
<main>
  <div class="controls">
    <input id="q" type="search" placeholder="Search name, city, county, phone…" />
    <select id="county"><option value="">All priority counties</option></select>
    <select id="tier"><option value="">All tiers</option></select>
  </div>
  <div id="list"></div>
  <p class="sub" id="cap"></p>
</main>
<script>
const DATA = {data};
const counties = [...new Set(DATA.leads.map(l => l.county).filter(Boolean))].sort();
const tiers = [...new Set(DATA.leads.map(l => l.tier))].sort();
const countySel = document.getElementById('county');
const tierSel = document.getElementById('tier');
counties.forEach(c => {{ const o=document.createElement('option'); o.value=c; o.textContent=c; countySel.appendChild(o); }});
tiers.forEach(t => {{ const o=document.createElement('option'); o.value=t; o.textContent=t; tierSel.appendChild(o); }});
document.getElementById('stats').innerHTML = Object.entries(DATA.summary).map(([k,v]) =>
  `<div class="stat"><b>${{typeof v==='number'?v.toLocaleString():v}}</b><span>${{k}}</span></div>`
).join('');
function esc(s){{return String(s||'').replace(/[&<>"']/g,c=>({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c]));}}
async function copyText(text, btn){{
  await navigator.clipboard.writeText(text);
  const old=btn.textContent; btn.textContent='Copied'; setTimeout(()=>btn.textContent=old,1200);
}}
function render(){{
  const q=(document.getElementById('q').value||'').toLowerCase();
  const county=countySel.value; const tier=tierSel.value;
  let rows=DATA.leads.filter(l => {{
    if(county && l.county!==county) return false;
    if(tier && l.tier!==tier) return false;
    if(!q) return true;
    return (l.company_name+' '+l.city+' '+l.county+' '+l.phone+' '+l.website).toLowerCase().includes(q);
  }});
  document.getElementById('cap').textContent = `Showing ${{rows.length}} of ${{DATA.leads.length}} embedded call-ready leads (capped for browser speed). Full CSVs are in this folder.`;
  document.getElementById('list').innerHTML = rows.map((l,i) => `
    <div class="card">
      <h3><span class="tier">${{esc(l.tier)}}</span>${{esc(l.company_name)}}</h3>
      <div class="meta">${{esc(l.ownership_type)}} · ${{esc(l.trade)}} · ${{esc(l.city)}}, ${{esc(l.county)}} ${{esc(l.google_rating)?`· ★${{esc(l.google_rating)}} (${{esc(l.google_reviews)}})`:''}}</div>
      <div class="meta">${{esc(l.address)}}</div>
      <div class="row">
        <strong>${{esc(l.phone)}}</strong>
        ${{l.website?`<a href="${{l.website.startsWith('http')?l.website:'https://'+l.website}}" target="_blank" rel="noopener">${{esc(l.website)}}</a>`:'<em>no website</em>'}}
        <button type="button" data-copy="sms" data-i="${{i}}">Copy SMS</button>
        <button type="button" class="secondary" data-toggle="${{i}}">Show email</button>
      </div>
      <pre id="email-${{i}}"><strong>${{esc(l.email_subject)}}</strong>\\n\\n${{esc(l.email)}}</pre>
    </div>
  `).join('');
  // rebinding uses current filtered order — store on element via closure map
  window._rows = rows;
  document.querySelectorAll('button[data-copy]').forEach(btn => {{
    btn.onclick = () => copyText(window._rows[+btn.dataset.i].sms, btn);
  }});
  document.querySelectorAll('button[data-toggle]').forEach(btn => {{
    btn.onclick = () => document.getElementById('email-'+btn.dataset.toggle).classList.toggle('show');
  }});
}}
['q','county','tier'].forEach(id => document.getElementById(id).addEventListener('input', render));
countySel.addEventListener('change', render); tierSel.addEventListener('change', render);
render();
</script>
</body>
</html>
"""
    path.write_text(html, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--contractors",
        type=Path,
        default=Path("data/florida-contractors/florida-plumbing-hvac-companies.csv"),
    )
    ap.add_argument("--companies", type=Path, default=Path("data/companies.json"))
    ap.add_argument("--out-dir", type=Path, default=Path("data/florida-contractors/outreach"))
    ap.add_argument("--import-plumbing-leads", type=Path, default=None)
    args = ap.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    leads = build_leads(args.contractors, args.companies)
    call_ready = [L for L in leads if L.get("phone")]
    research = [L for L in leads if not L.get("phone")]

    write_csv(args.out_dir / "call-ready.csv", call_ready)
    write_csv(args.out_dir / "research-queue.csv", research)
    # Priority-county call-ready only (best starting list)
    prio_ready = [L for L in call_ready if L.get("county") in PRIORITY_COUNTIES]
    write_csv(args.out_dir / "call-ready-priority-counties.csv", prio_ready)

    shaped = to_plumbing_leads_shape(call_ready)
    (args.out_dir / "plumbing-leads-import.json").write_text(
        json.dumps(shaped, indent=2), encoding="utf-8"
    )

    summary = {
        "call_ready_with_phone": len(call_ready),
        "priority_counties_call_ready": len(prio_ready),
        "research_queue_no_phone": len(research),
        "family_owned_call_ready": sum(1 for L in call_ready if L["ownership_type"] == "Family-Owned"),
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
    }
    # county breakdown for call-ready priority
    by_county = Counter(L["county"] for L in prio_ready)
    summary_txt = dict(summary)
    for c, n in by_county.most_common():
        summary_txt[f"ready:{c}"] = n

    write_html(args.out_dir / "outreach-board.html", prio_ready or call_ready, summary_txt)

    readme = f"""# Outreach lead lists (Family / Independent)

Generated: **{summary['generated_utc']}** UTC

Corporate and franchise brands are **excluded**. These lists are for pitching local shops.

## Start here

1. Open **`outreach-board.html`** in your browser (double-click).
2. Filter to **Palm Beach** / **Broward** / etc.
3. Click **Copy SMS** and call/text the phone number shown.

## Files

| File | Use |
| --- | --- |
| `call-ready-priority-counties.csv` | Best dial list (phone + priority counties) — **{len(prio_ready)}** leads |
| `call-ready.csv` | All FL family/independent with a phone — **{len(call_ready)}** |
| `research-queue.csv` | Priority-county shops still needing a phone lookup — **{len(research)}** |
| `outreach-board.html` | Click-to-copy SMS/email board |
| `plumbing-leads-import.json` | Import into the `plumbing-leads` app |

## Priority counties

{', '.join(PRIORITY_COUNTIES)}

## Tier key

- **A** — Family-owned + phone + priority county (call first)
- **B** — Independent + phone + priority county
- **C** — Has phone, other Florida county
- **D** — Priority county, no phone yet (research)

## Import into plumbing-leads

```bash
cd plumbing-leads
python -c "import sys; sys.path.insert(0,'..'); ..."
# or:
python ../scripts/build_outreach_leads.py --import-plumbing-leads leads.db
python main.py
# open http://127.0.0.1:8000
```

## Honesty

Phones/websites come from matching `data/companies.json` (Google Maps scrape) onto DBPR license names. Matches are exact-name or high-confidence fuzzy with same city/county. Unmatched priority-county shops are in `research-queue.csv`.
"""
    (args.out_dir / "README.md").write_text(readme, encoding="utf-8")

    print("Summary:", summary)
    print("Priority county call-ready breakdown:", by_county.most_common())
    print("Wrote:", sorted(p.name for p in args.out_dir.iterdir()))

    if args.import_plumbing_leads:
        stats = import_plumbing_leads(args.import_plumbing_leads, call_ready)
        print("plumbing-leads import:", stats)


if __name__ == "__main__":
    main()
