"""FastAPI app for the Palm Beach Plumbing Lead Generator."""
from __future__ import annotations

import csv
import io
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import db
from enrich import enrich_website
from places import PlacesError, geocode, search_text
from templates_data import render_templates

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()

app = FastAPI(title="Palm Beach Plumbing Leads", version="1.0.0")

db.init_db()


# ---------- request models ----------

class SearchRequest(BaseModel):
    location: str = Field(default="West Palm Beach, FL")
    radius_miles: float = Field(default=15.0, ge=1, le=31)  # 31mi ≈ 50km API max
    keyword: str = Field(default="plumber")
    min_rating: float = Field(default=0.0, ge=0, le=5)
    max_results: int = Field(default=60, ge=1, le=60)
    save: bool = Field(default=True)


class UpdateLeadRequest(BaseModel):
    status: str | None = None
    notes: str | None = None
    phone: str | None = None
    website: str | None = None


# ---------- API routes ----------

@app.get("/api/config")
def get_config() -> dict[str, Any]:
    return {
        "has_api_key": bool(API_KEY),
        "broker": {
            "company": os.getenv("BROKER_COMPANY_NAME", "PalmLeads"),
            "name": os.getenv("BROKER_CONTACT_NAME", "Alex"),
            "phone": os.getenv("BROKER_PHONE", "(561) 555-0100"),
        },
    }


@app.post("/api/search")
async def api_search(req: SearchRequest) -> dict[str, Any]:
    if not API_KEY:
        raise HTTPException(
            status_code=400,
            detail="GOOGLE_API_KEY is not configured on the server. Add it to .env.",
        )
    try:
        lat, lng = await geocode(req.location, API_KEY)
        radius_meters = req.radius_miles * 1609.34
        text_query = f"{req.keyword} in {req.location}"
        results = await search_text(
            text_query=text_query,
            lat=lat,
            lng=lng,
            radius_meters=radius_meters,
            api_key=API_KEY,
            max_results=req.max_results,
            min_rating=req.min_rating,
        )
    except PlacesError as e:
        raise HTTPException(status_code=502, detail=str(e))

    db_stats = {"inserted": 0, "skipped_duplicates": 0}
    if req.save and results:
        db_stats = db.upsert_leads(results)

    return {
        "count": len(results),
        "geocoded": {"lat": lat, "lng": lng},
        "results": results,
        "db": db_stats,
    }


@app.get("/api/leads")
def api_list_leads(
    status: str | None = Query(default=None),
    no_website_only: bool = Query(default=False),
    search: str | None = Query(default=None),
    sort: str = Query(default="created_desc"),
) -> dict[str, Any]:
    leads = db.list_leads(
        status=status, no_website_only=no_website_only,
        search=search, sort=sort,
    )
    return {"count": len(leads), "leads": leads, "stats": db.stats()}


@app.get("/api/leads/{place_id}")
def api_get_lead(place_id: str) -> dict[str, Any]:
    lead = db.get_lead(place_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"lead": lead, "templates": render_templates(lead)}


@app.patch("/api/leads/{place_id}")
def api_update_lead(place_id: str, req: UpdateLeadRequest) -> dict[str, Any]:
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    lead = db.update_lead(place_id, fields)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"lead": lead}


@app.delete("/api/leads/{place_id}")
def api_delete_lead(place_id: str) -> dict[str, Any]:
    if not db.delete_lead(place_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}


@app.post("/api/leads/{place_id}/enrich")
async def api_enrich(place_id: str) -> dict[str, Any]:
    lead = db.get_lead(place_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    data = await enrich_website(lead.get("website") or "")
    from datetime import datetime, timezone
    updated = db.update_lead(place_id, {
        "emails": data["emails"],
        "socials": data["socials"],
        "services": data["services"],
        "last_enriched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    })
    return {"lead": updated, "enrichment": data}


@app.get("/api/leads/{place_id}/templates")
def api_templates(place_id: str) -> dict[str, Any]:
    lead = db.get_lead(place_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"templates": render_templates(lead)}


@app.get("/api/export.csv")
def api_export_csv(
    status: str | None = Query(default=None),
    no_website_only: bool = Query(default=False),
) -> StreamingResponse:
    leads = db.list_leads(status=status, no_website_only=no_website_only)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Name", "Status", "Rating", "Reviews", "Phone", "Address",
        "Website", "Emails", "Facebook", "Instagram", "Services",
        "No Website", "Google Maps", "Place ID", "Notes",
        "Created", "Updated",
    ])
    for L in leads:
        w.writerow([
            L["name"], L["status"], L.get("rating") or "",
            L.get("reviews") or "", L.get("phone") or "",
            L.get("address") or "", L.get("website") or "",
            "; ".join(L.get("emails") or []),
            (L.get("socials") or {}).get("facebook", ""),
            (L.get("socials") or {}).get("instagram", ""),
            "; ".join(L.get("services") or []),
            "Yes" if L.get("no_website") else "No",
            L.get("google_url") or "", L.get("place_id"),
            (L.get("notes") or "").replace("\n", " "),
            L.get("created_at"), L.get("updated_at"),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="palm-beach-plumbing-leads.csv"'
        },
    )


# ---------- static frontend ----------

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
