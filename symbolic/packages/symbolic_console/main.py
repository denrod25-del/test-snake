"""Admin console — kicks off crawls, shows index health, top queries, ad campaigns.

Run: uvicorn symbolic_console.main:app --port 8003
"""
from __future__ import annotations

import os

import httpx
from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

API_URL = os.getenv("SYMBOLIC_API_URL", "http://localhost:8000")
ADS_URL = os.getenv("SYMBOLIC_ADS_URL", "http://localhost:8001")
ANALYTICS_URL = os.getenv("SYMBOLIC_ANALYTICS_URL", "http://localhost:8002")

app = FastAPI(title="SYMBOLIC Console", version="0.1.0")


PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>SYMBOLIC Console</title>
<style>
body{{background:#0e0f12;color:#e7e9ee;font-family:-apple-system,Segoe UI,Inter,sans-serif;margin:0;padding:24px;max-width:1100px;margin:auto;}}
h1{{font-size:28px;margin:0 0 4px;background:linear-gradient(90deg,#7c5cff,#4ad6ff);-webkit-background-clip:text;background-clip:text;color:transparent;}}
h2{{font-size:16px;color:#aab1c0;margin-top:32px;border-bottom:1px solid #232631;padding-bottom:6px;text-transform:uppercase;letter-spacing:1px;}}
.row{{display:grid;grid-template-columns:1fr 1fr;gap:24px;}}
.card{{background:#15171c;border:1px solid #232631;border-radius:10px;padding:18px;}}
.kv{{display:grid;grid-template-columns:160px 1fr;gap:6px 12px;font-size:13px;}}
.kv b{{color:#8b91a0;font-weight:500;}}
form input, form textarea{{width:100%;background:#0e0f12;color:#e7e9ee;border:1px solid #232631;border-radius:6px;padding:8px;font-family:inherit;font-size:13px;margin-bottom:8px;box-sizing:border-box;}}
form button{{background:linear-gradient(90deg,#7c5cff,#4ad6ff);color:#0b0c10;border:0;border-radius:6px;padding:9px 16px;font-weight:600;cursor:pointer;}}
table{{width:100%;border-collapse:collapse;font-size:13px;}}
td,th{{padding:6px 8px;border-bottom:1px solid #232631;text-align:left;}}
th{{color:#8b91a0;font-weight:500;}}
.tag{{display:inline-block;font-size:10px;letter-spacing:1px;color:#4ad6ff;border:1px solid #4ad6ff;border-radius:3px;padding:1px 5px;}}
a{{color:#9ec5ff;}}
.error{{color:#ff7b7b;font-size:13px;margin-top:8px;}}
</style></head><body>
<h1>SYMBOLIC Console</h1>
<p style="color:#8b91a0;margin:0 0 28px">Admin · v0.1.0 · <a href="/" >refresh</a> · <a href="{api}" target="_blank">api</a> · <a href="{api}/" target="_blank">search ui</a></p>

<h2>Index health</h2>
<div class="card"><div class="kv">{health_kv}</div></div>

<h2>New crawl</h2>
<div class="card">
  <form method="post" action="/crawl">
    <label style="font-size:12px;color:#8b91a0">Seed URLs (one per line)</label>
    <textarea name="seeds" rows="4" placeholder="https://en.wikipedia.org/wiki/PageRank"></textarea>
    <div class="row">
      <div><label style="font-size:12px;color:#8b91a0">Max depth</label><input type="number" name="max_depth" value="2"/></div>
      <div><label style="font-size:12px;color:#8b91a0">Max pages</label><input type="number" name="max_pages" value="40"/></div>
    </div>
    <label style="font-size:12px;color:#8b91a0"><input type="checkbox" name="same_host_only" value="1"/> same-host only</label>
    <br/><br/>
    <button type="submit">Start crawl</button>
  </form>
  {crawl_msg}
</div>

<div class="row" style="margin-top:24px">
  <div>
    <h2>Top queries</h2>
    <div class="card"><table><tr><th>Query</th><th>Imp.</th></tr>{top_queries}</table></div>
  </div>
  <div>
    <h2>Top clicked docs</h2>
    <div class="card"><table><tr><th>Doc id</th><th>Clicks</th></tr>{top_clicked}</table></div>
  </div>
</div>

<h2>Ad campaigns</h2>
<div class="card">
  <form method="post" action="/ad" style="margin-bottom:16px">
    <div class="row">
      <input name="advertiser" placeholder="advertiser"/>
      <input name="title" placeholder="ad title"/>
    </div>
    <div class="row">
      <input name="url" placeholder="https://target.example"/>
      <input name="keywords" placeholder="keywords (space separated)"/>
    </div>
    <input name="description" placeholder="description"/>
    <input name="bid_cents" type="number" value="100" placeholder="bid (cents)"/>
    <button type="submit">Create campaign</button>
  </form>
  <table><tr><th>ID</th><th>Adv.</th><th>Title</th><th>Keywords</th><th>Bid¢</th></tr>{campaigns}</table>
</div>

</body></html>
"""


def _kv_rows(d: dict) -> str:
    out = []
    for k, v in d.items():
        out.append(f"<b>{k}</b><span>{v}</span>")
    return "".join(out)


async def _safe_get(url: str, params=None) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=2.0) as c:
            r = await c.get(url, params=params)
            if r.status_code == 200:
                return r.json()
    except Exception:
        return None
    return None


@app.get("/", response_class=HTMLResponse)
async def home(msg: str | None = None) -> HTMLResponse:
    health = await _safe_get(f"{API_URL}/health") or {"status": "API offline"}
    top_q = (await _safe_get(f"{ANALYTICS_URL}/top/queries") or {}).get("queries", [])
    top_c = (await _safe_get(f"{ANALYTICS_URL}/top/clicked") or {}).get("docs", [])
    camps = (await _safe_get(f"{ADS_URL}/campaigns") or {}).get("campaigns", [])

    return HTMLResponse(
        PAGE.format(
            api=API_URL,
            health_kv=_kv_rows(
                {
                    "status": health.get("status", "?"),
                    "documents": health.get("documents", 0),
                    "vectors": health.get("vectors", 0),
                    "embedding model": health.get("embedding_model", "?"),
                    "embedding dim": health.get("embedding_dim", 0),
                    "ltr trained": health.get("ltr_trained", False),
                    "frontier": health.get("frontier", {}),
                    "data dir": health.get("data_dir", "?"),
                }
            ),
            crawl_msg=f'<div class="error">{msg}</div>' if msg else "",
            top_queries="".join(
                f"<tr><td>{q['query']}</td><td>{q['impressions']}</td></tr>" for q in top_q
            )
            or "<tr><td colspan=2 style='color:#8b91a0'>(none yet)</td></tr>",
            top_clicked="".join(
                f"<tr><td>{c['doc_id']}</td><td>{c['clicks']}</td></tr>" for c in top_c
            )
            or "<tr><td colspan=2 style='color:#8b91a0'>(none yet)</td></tr>",
            campaigns="".join(
                f"<tr><td>{c['id']}</td><td>{c['advertiser']}</td><td>{c['title']}</td><td>{c['keywords']}</td><td>{c['bid_cents']}</td></tr>"
                for c in camps
            )
            or "<tr><td colspan=5 style='color:#8b91a0'>(no campaigns)</td></tr>",
        )
    )


@app.post("/crawl")
async def start_crawl(
    seeds: str = Form(""),
    max_depth: int = Form(2),
    max_pages: int = Form(40),
    same_host_only: str | None = Form(None),
) -> RedirectResponse:
    seed_list = [s.strip() for s in seeds.splitlines() if s.strip()]
    if not seed_list:
        return RedirectResponse("/?msg=Please+enter+at+least+one+seed+URL", status_code=303)
    try:
        async with httpx.AsyncClient(timeout=300.0) as c:
            r = await c.post(
                f"{API_URL}/crawl",
                json={
                    "seeds": seed_list,
                    "max_depth": max_depth,
                    "max_pages": max_pages,
                    "same_host_only": bool(same_host_only),
                },
            )
            if r.status_code != 200:
                return RedirectResponse(f"/?msg=Crawl+failed:+{r.status_code}", status_code=303)
            data = r.json()
            return RedirectResponse(
                f"/?msg=Crawl+done:+{data['fetched']}+pages+(total+{data['documents']})",
                status_code=303,
            )
    except Exception as e:
        return RedirectResponse(f"/?msg=Crawl+error:+{e}", status_code=303)


@app.post("/ad")
async def create_ad(
    advertiser: str = Form(...),
    title: str = Form(...),
    url: str = Form(...),
    description: str = Form(""),
    keywords: str = Form(...),
    bid_cents: int = Form(100),
) -> RedirectResponse:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(
                f"{ADS_URL}/campaign",
                json={
                    "advertiser": advertiser,
                    "title": title,
                    "url": url,
                    "description": description,
                    "keywords": keywords,
                    "bid_cents": bid_cents,
                },
            )
            if r.status_code != 200:
                raise HTTPException(500, f"ads service error: {r.status_code}")
    except Exception as e:
        return RedirectResponse(f"/?msg=Ad+create+failed:+{e}", status_code=303)
    return RedirectResponse("/", status_code=303)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
