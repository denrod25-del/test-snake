"""FastAPI app for the water-filtration lead generator.

B2C focused: the user pulls EPA SDWIS data for Palm Beach County, FL,
the app flags systems with active MCL or Lead & Copper Rule issues, rolls
those up to ZIP-level 'target areas', and generates homeowner outreach
copy that cites the public EPA record.
"""
from __future__ import annotations

import asyncio
import base64
import csv
import io
import logging
import os
import secrets
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

import census_client
import db
import geocode
import scoring
import sdwis
from templates_data import BRAND, render_zip_templates

load_dotenv()
log = logging.getLogger("water-leads")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

TARGET_STATE = os.getenv("TARGET_STATE", "FL").strip().upper()
TARGET_COUNTY = os.getenv("TARGET_COUNTY", "PALM BEACH").strip().upper()
SCHEDULE_ENABLED = os.getenv("ENABLE_SCHEDULED_SYNC", "true").lower() in ("1", "true", "yes")
SCHEDULE_INTERVAL_HOURS = float(os.getenv("SCHEDULE_INTERVAL_HOURS", "168"))  # weekly default
ALERT_WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL", "").strip()

# --- Optional HTTP Basic (set both) when listening beyond localhost. ---
AQUA_BASICAUTH_USER = os.getenv("AQUA_LEADS_BASICAUTH_USER", "").strip()
AQUA_BASICAUTH_PASS = os.getenv("AQUA_LEADS_BASICAUTH_PASS", "").strip()
AQUA_BASICAUTH_ENABLED = bool(AQUA_BASICAUTH_USER and AQUA_BASICAUTH_PASS)
LISTEN_HOST = os.getenv("LISTEN_HOST", "127.0.0.1").strip() or "127.0.0.1"
LISTEN_PORT = int(os.getenv("LISTEN_PORT", "8000") or 8000)
AQUA_RELOAD = os.getenv("AQUA_LEADS_RELOAD", "1").lower() in ("1", "true", "yes")

db.init_db()

_scheduler_task: asyncio.Task | None = None


async def _scheduled_sync_loop() -> None:
    """Kick off a sync on an interval when ENABLE_SCHEDULED_SYNC is true."""
    interval_seconds = max(60, int(SCHEDULE_INTERVAL_HOURS * 3600))
    first = db.last_sync()
    if first is None:
        await asyncio.sleep(10)
        try:
            await _run_sync(TARGET_STATE, TARGET_COUNTY, trigger="bootstrap")
        except Exception as e:
            log.warning("Bootstrap sync failed: %s", e)

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            log.info("Running scheduled sync for %s, %s", TARGET_COUNTY, TARGET_STATE)
            await _run_sync(TARGET_STATE, TARGET_COUNTY, trigger="scheduled")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning("Scheduled sync errored: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler_task
    if SCHEDULE_ENABLED:
        _scheduler_task = asyncio.create_task(_scheduled_sync_loop())
        log.info(
            "Scheduled sync enabled (interval=%.1f hours)",
            SCHEDULE_INTERVAL_HOURS,
        )
    try:
        yield
    finally:
        if _scheduler_task:
            _scheduler_task.cancel()
            try:
                await _scheduler_task
            except (asyncio.CancelledError, Exception):
                pass


app = FastAPI(title="Water Filtration Leads", version="1.0.0", lifespan=lifespan)


def _basic_auth_ok(request: Request) -> bool:
    if not AQUA_BASICAUTH_ENABLED:
        return True
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Basic "):
        return False
    try:
        raw = base64.b64decode(auth[6:].encode("ascii")).decode("utf-8")
    except (OSError, ValueError, UnicodeDecodeError):
        return False
    if ":" not in raw:
        return False
    user, pw = raw.split(":", 1)
    u_ok = (
        len(user) == len(AQUA_BASICAUTH_USER)
        and secrets.compare_digest(user, AQUA_BASICAUTH_USER)
    )
    p_ok = (
        len(pw) == len(AQUA_BASICAUTH_PASS)
        and secrets.compare_digest(pw, AQUA_BASICAUTH_PASS)
    )
    return u_ok and p_ok


def _basic_challenge() -> Response:
    return Response(
        status_code=401,
        headers={"WWW-Authenticate": 'Basic realm="AquaLeads"'},
        content="Authentication required",
    )


class _BasicAuthMiddleware(BaseHTTPMiddleware):
    """Protect the whole app when AQUA_LEADS_BASICAUTH_* are set. Skips
    :path:`/api/health` so Docker / tunnel probes can run without a password."""

    async def dispatch(self, request: Request, call_next):
        if not AQUA_BASICAUTH_ENABLED:
            return await call_next(request)
        p = request.url.path
        if p in ("/api/health", "/api/health/"):
            return await call_next(request)
        if not _basic_auth_ok(request):
            return _basic_challenge()
        return await call_next(request)


if AQUA_BASICAUTH_ENABLED:
    app.add_middleware(_BasicAuthMiddleware)
    log.warning(
        "HTTP Basic auth is enabled. Use HTTPS (reverse proxy or tunnel) "
        "if you expose the app to the public internet."
    )


# ---------- models ----------


class SyncRequest(BaseModel):
    state: str = Field(default=TARGET_STATE)
    county: str = Field(default=TARGET_COUNTY)


class UpdateZipRequest(BaseModel):
    status: str | None = None
    notes: str | None = None


# ---------- sync logic ----------


def _augment_service_areas(
    geo_rows: list[dict[str, Any]],
    water_systems: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Fill in missing zip_code_served using the water system's own zip_code.

    EPA's GEOGRAPHIC_AREA table often has null zip_code_served for FL
    (at least in the current dataset). We synthesize one extra row per
    PWSID using WATER_SYSTEM.zip_code so the ZIP pipeline has something
    to roll up by.
    """
    have_zip_for: set[str] = {
        r["pwsid"] for r in geo_rows
        if r.get("pwsid") and r.get("zip_code_served")
    }
    ws_index = {ws.get("pwsid"): ws for ws in water_systems if ws.get("pwsid")}

    augmented = list(geo_rows)
    for pwsid, ws in ws_index.items():
        if pwsid in have_zip_for:
            continue
        zip_code = (ws.get("zip_code") or "").split("-", 1)[0].strip()
        if not zip_code:
            continue
        augmented.append({
            "pwsid": pwsid,
            "zip_code_served": zip_code,
            "city_served": ws.get("city_name"),
            "county_served": ws.get("counties_served") or ws.get("county"),
            "state_served": ws.get("state_code"),
            "area_type_code": "WS_ZIP",
        })
    return augmented


async def _diff_and_alert(
    prev_violation_ids: set[str],
    prev_lcr_keys: set[tuple[str, str]],
    prev_pfas: set[str],
) -> int:
    """Emit alert rows for any new health-based violation / LCR exceedance /
    PFAS detection that appeared since the previous sync. Returns count."""
    alerts: list[dict[str, Any]] = []

    current_ids = db.snapshot_violation_ids()
    new_ids = list(current_ids - prev_violation_ids)
    if new_ids:
        new_rows = db.get_violations_by_ids(new_ids[:200])
        zip_lookup = db.zip_codes_for_pwsids([r["pwsid"] for r in new_rows])
        for v in new_rows:
            cat = (v.get("category") or "").upper()
            if cat not in ("MCL", "MRDL", "TT"):
                continue
            is_health = bool(v.get("is_health_based"))
            zips = zip_lookup.get(v["pwsid"]) or [None]
            for zc in zips:
                alerts.append({
                    "alert_type": "new_mcl" if cat in ("MCL", "MRDL") else "new_tt",
                    "severity": "high" if is_health else "medium",
                    "pwsid": v["pwsid"],
                    "zip_code": zc,
                    "title": (
                        f"New {cat} violation at {v.get('system_name') or v['pwsid']}"
                    ),
                    "details": {
                        "violation_id": v.get("violation_id"),
                        "code": v.get("code"),
                        "contaminant_code": v.get("contaminant_code"),
                        "begin_date": v.get("begin_date"),
                        "is_health_based": is_health,
                    },
                })

    current_lcr_keys = db.snapshot_lcr_exceedance_keys()
    new_lcr = current_lcr_keys - prev_lcr_keys
    if new_lcr:
        zip_lookup = db.zip_codes_for_pwsids(list({p for p, _ in new_lcr}))
        for pwsid, sar in list(new_lcr)[:100]:
            zips = zip_lookup.get(pwsid) or [None]
            for zc in zips:
                alerts.append({
                    "alert_type": "new_lcr",
                    "severity": "high",
                    "pwsid": pwsid,
                    "zip_code": zc,
                    "title": f"Lead or copper exceedance at {pwsid}",
                    "details": {"sar_id": sar},
                })

    current_pfas = db.pfas_pwsids()
    new_pfas = current_pfas - prev_pfas
    if new_pfas:
        zip_lookup = db.zip_codes_for_pwsids(list(new_pfas))
        for pwsid in list(new_pfas)[:100]:
            zips = zip_lookup.get(pwsid) or [None]
            for zc in zips:
                alerts.append({
                    "alert_type": "new_pfas",
                    "severity": "high",
                    "pwsid": pwsid,
                    "zip_code": zc,
                    "title": f"PFAS detected at {pwsid} (UCMR 5)",
                    "details": {},
                })

    if alerts:
        db.insert_alerts(alerts)
        if ALERT_WEBHOOK_URL:
            try:
                async with httpx.AsyncClient(timeout=10.0) as c:
                    await c.post(ALERT_WEBHOOK_URL, json={"alerts": alerts[:50]})
            except httpx.HTTPError as e:
                log.warning("Alert webhook delivery failed: %s", e)
    return len(alerts)


def _rescore_from_db(pwsids: list[str]) -> tuple[int, dict[str, str]]:
    """Rebuild zip_targets + water_system flags from whatever's currently in
    the DB. Used by /api/sync after a fresh EPA pull, and by UCMR/LSL
    imports which mutate risk inputs without re-pulling SDWIS."""
    systems_for_scoring: list[dict[str, Any]] = []
    violations_by: dict[str, list[dict[str, Any]]] = defaultdict(list)
    lcr_by: dict[str, list[dict[str, Any]]] = defaultdict(list)
    ucmr_by: dict[str, list[dict[str, Any]]] = defaultdict(list)
    service_area_rows: list[dict[str, Any]] = []

    with db.connect() as c:
        for pwsid in pwsids:
            sys_row = c.execute(
                "SELECT * FROM water_systems WHERE pwsid = ?", (pwsid,)
            ).fetchone()
            if sys_row:
                systems_for_scoring.append(dict(sys_row))
            for v in c.execute(
                "SELECT * FROM violations WHERE pwsid = ?", (pwsid,)
            ).fetchall():
                violations_by[pwsid].append(dict(v))
            for l in c.execute(
                "SELECT * FROM lcr_results WHERE pwsid = ?", (pwsid,)
            ).fetchall():
                lcr_by[pwsid].append(dict(l))
            for u in c.execute(
                "SELECT * FROM ucmr_results WHERE pwsid = ?", (pwsid,)
            ).fetchall():
                ucmr_by[pwsid].append(dict(u))
            for sa in c.execute(
                "SELECT * FROM service_areas WHERE pwsid = ?", (pwsid,)
            ).fetchall():
                service_area_rows.append(dict(sa))

    demographics_by_zip = db.all_demographics()
    system_scores: dict[str, dict[str, Any]] = {}
    targets = scoring.build_zip_targets(
        systems_for_scoring,
        violations_by,
        lcr_by,
        service_area_rows,
        ucmr_by_pwsid=ucmr_by,
        demographics_by_zip=demographics_by_zip,
        out_system_scores=system_scores,
    )
    zip_n = db.replace_zip_targets(targets)

    # Persist PER-SYSTEM lead tier from each utility's OWN LCR + violations +
    # housing age. Never inherit from the aggregated ZIP — a large ZIP may
    # be served by multiple utilities with very different risk profiles, and
    # mis-attributing a neighbor's lead exceedance to a clean system would
    # undermine the sales pitch when a prospect verifies it in EPA records.
    with db.connect() as c:
        c.execute("UPDATE water_systems SET lead_risk_tier = 'unknown'")
    tier_by_pwsid: dict[str, str] = {}
    for pwsid, sc in system_scores.items():
        tier = sc.get("lead_risk_tier") or "unknown"
        tier_by_pwsid[pwsid] = tier
        db.update_lead_risk_tier(pwsid, tier)

    db.update_pfas_flag(db.pfas_pwsids())
    return zip_n, tier_by_pwsid


async def _run_sync(state: str, county: str, trigger: str = "manual") -> dict[str, Any]:
    state = state.strip().upper()
    county = county.strip().upper()

    prev_violation_ids = db.snapshot_violation_ids()
    prev_lcr_keys = db.snapshot_lcr_exceedance_keys()
    prev_pfas_pwsids = db.pfas_pwsids()

    run_id = db.record_sync_start(state, county)
    try:
        with db.connect() as c:
            c.execute(
                "UPDATE sync_runs SET trigger = ? WHERE id = ?",
                (trigger, run_id),
            )

        pulled = await sdwis.sync_county(state=state, county=county)

        pwsids = pulled["pwsids"]
        systems_n = db.upsert_water_systems(pulled["water_systems"])

        # Fill in missing zip_code_served before persisting service areas.
        geo_augmented = _augment_service_areas(
            pulled["geographic_areas"], pulled["water_systems"]
        )
        areas_n = db.replace_service_areas(pwsids, geo_augmented)
        viol_n = db.replace_violations(pwsids, pulled["violations"])
        lcr_n = db.replace_lcr(pwsids, pulled["lcr_results"])
        # Only wipe+replace UCMR if the sync source returned something. EPA
        # Envirofacts does not currently expose UCMR 5; those rows come in
        # via /api/ucmr/import and we don't want a sync to destroy them.
        ucmr_rows = pulled.get("ucmr_results") or []
        ucmr_n = db.replace_ucmr(pwsids, ucmr_rows) if ucmr_rows else 0
        if not ucmr_rows:
            with db.connect() as _c:
                ucmr_n = _c.execute(
                    "SELECT COUNT(*) AS n FROM ucmr_results WHERE pwsid IN "
                    f"({','.join('?' * len(pwsids))})",
                    pwsids,
                ).fetchone()["n"] if pwsids else 0

        # Stamp pfas_detected flag on water_systems from UCMR hits.
        db.update_pfas_flag(db.pfas_pwsids())

        # Pull ACS demographics for every ZIP we care about.
        zip_set = {
            r.get("zip_code_served") for r in geo_augmented
            if r.get("zip_code_served")
        }
        demographics_n = 0
        if zip_set:
            try:
                async with httpx.AsyncClient() as cli:
                    demo_rows = await census_client.fetch_acs_for_zips(
                        cli, sorted(zip_set)
                    )
                demographics_n = db.upsert_demographics(demo_rows)
            except httpx.HTTPError as e:
                log.warning("ACS fetch failed (continuing sync): %s", e)

        zip_n, _ = _rescore_from_db(pwsids)

        alerts_n = await _diff_and_alert(
            prev_violation_ids, prev_lcr_keys, prev_pfas_pwsids
        )

        db.record_sync_finish(run_id, systems_n, viol_n, lcr_n, zip_n)
        with db.connect() as c:
            c.execute(
                "UPDATE sync_runs SET ucmr_count = ?, demographics_count = ?, "
                "alerts_count = ? WHERE id = ?",
                (ucmr_n, demographics_n, alerts_n, run_id),
            )

        return {
            "state": state,
            "county": county,
            "pwsids": len(pwsids),
            "water_systems": systems_n,
            "service_areas": areas_n,
            "violations": viol_n,
            "lcr_results": lcr_n,
            "ucmr_results": ucmr_n,
            "demographics": demographics_n,
            "zip_targets": zip_n,
            "alerts": alerts_n,
            "trigger": trigger,
        }
    except Exception as e:
        db.record_sync_finish(run_id, 0, 0, 0, 0, error=str(e))
        raise


# ---------- API ----------


@app.get("/api/health", response_model=None)
def get_health() -> dict[str, Any]:
    """Liveness: always unauthenticated. Use for Docker, tunnels, and uptime checks."""
    try:
        with db.connect() as c:
            c.execute("SELECT 1")
        s = db.stats()
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"ok": False, "database": f"unavailable: {e}"},
        )
    return {
        "ok": True,
        "database": "ok",
        "basic_auth": AQUA_BASICAUTH_ENABLED,
        "stats": s,
    }


@app.get("/api/config")
def get_config() -> dict[str, Any]:
    last = db.last_sync()
    return {
        "target": {"state": TARGET_STATE, "county": TARGET_COUNTY},
        "brand": BRAND,
        "last_sync": last,
        "stats": db.stats(),
        "basic_auth_enabled": AQUA_BASICAUTH_ENABLED,
    }


@app.post("/api/sync")
async def api_sync(req: SyncRequest | None = None) -> dict[str, Any]:
    req = req or SyncRequest()
    try:
        # Guard against the huge call blocking forever if EPA is slow:
        result = await asyncio.wait_for(
            _run_sync(req.state, req.county), timeout=600
        )
    except sdwis.SdwisError as e:
        raise HTTPException(status_code=502, detail=f"EPA Envirofacts error: {e}")
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504, detail="EPA sync timed out after 10 minutes."
        )
    return {"ok": True, "result": result, "stats": db.stats()}


@app.get("/api/systems")
def api_list_systems(
    flagged_only: bool = Query(default=False),
    issue_type: str | None = Query(default=None),
    min_pop: int = Query(default=0, ge=0),
    search: str | None = Query(default=None),
) -> dict[str, Any]:
    rows = db.list_systems(
        flagged_only=flagged_only,
        issue_type=issue_type,
        min_pop=min_pop,
        search=search,
    )
    return {"count": len(rows), "systems": rows}


@app.get("/api/systems/{pwsid}")
def api_get_system(pwsid: str) -> dict[str, Any]:
    result = db.get_system(pwsid)
    if not result:
        raise HTTPException(status_code=404, detail="Water system not found")
    result["envirofacts_url"] = (
        "https://enviro.epa.gov/envirofacts/sdwis/search/form"
        f"?pwsid={pwsid}"
    )
    result["ucmr_results"] = db.ucmr_for_pwsid(pwsid)
    result["lsl_inventory"] = db.lsl_for_pwsid(pwsid)
    return result


@app.get("/api/zips")
def api_list_zips(
    status: str | None = Query(default=None),
    flagged_only: bool = Query(default=False),
    search: str | None = Query(default=None),
    sort: str = Query(default="score_desc"),
) -> dict[str, Any]:
    rows = db.list_zip_targets(
        status=status, flagged_only=flagged_only, search=search, sort=sort,
    )
    return {"count": len(rows), "zips": rows, "stats": db.stats()}


@app.get("/api/zips/{zip_code}")
def api_get_zip(zip_code: str) -> dict[str, Any]:
    z = db.get_zip_target(zip_code)
    if not z:
        raise HTTPException(status_code=404, detail="ZIP target not found")
    z["templates"] = render_zip_templates(z)
    return z


@app.patch("/api/zips/{zip_code}")
def api_update_zip(zip_code: str, req: UpdateZipRequest) -> dict[str, Any]:
    fields = {k: v for k, v in req.model_dump().items() if v is not None}
    z = db.update_zip_target(zip_code, fields)
    if not z:
        raise HTTPException(status_code=404, detail="ZIP target not found")
    return z


@app.get("/api/zips/{zip_code}/templates")
def api_zip_templates(zip_code: str) -> dict[str, Any]:
    z = db.get_zip_target(zip_code)
    if not z:
        raise HTTPException(status_code=404, detail="ZIP target not found")
    return {"templates": render_zip_templates(z)}


@app.get("/api/alerts")
def api_alerts(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    alerts = db.list_alerts(unread_only=unread_only, limit=limit)
    return {"count": len(alerts), "alerts": alerts}


class MarkAlertsRequest(BaseModel):
    ids: list[int] | None = None


@app.post("/api/alerts/mark-read")
def api_mark_alerts(req: MarkAlertsRequest | None = None) -> dict[str, Any]:
    req = req or MarkAlertsRequest()
    n = db.mark_alerts_read(req.ids)
    return {"ok": True, "updated": n}


@app.get("/api/map")
async def api_map(
    flagged_only: bool = Query(default=True),
    max_new_lookups: int = Query(default=20, ge=0, le=60),
) -> dict[str, Any]:
    """Return ZIP centroids + risk metadata for map rendering.

    On first load for a given target area, centroid lookups are slow (one
    per second per Nominatim policy) and will trickle in across multiple
    requests — the frontend can call this endpoint repeatedly.
    """
    zips = db.list_zip_targets(flagged_only=flagged_only, sort="score_desc")
    zip_codes = [z["zip_code"] for z in zips]
    cached = db.centroids_for_zips(zip_codes)
    missing = [
        z for z in zip_codes
        if z not in cached or cached[z].get("lat") is None
        and (cached[z].get("failed_attempts") or 0) < geocode.MAX_FAILURES
    ]
    resolved = 0
    if missing and max_new_lookups > 0:
        resolved = await geocode.resolve_missing(missing, max_new=max_new_lookups)
        cached = db.centroids_for_zips(zip_codes)

    features: list[dict[str, Any]] = []
    for z in zips:
        c = cached.get(z["zip_code"]) or {}
        if c.get("lat") is None or c.get("lon") is None:
            continue
        features.append({
            "zip_code": z["zip_code"],
            "city": z.get("city"),
            "lat": c["lat"],
            "lon": c["lon"],
            "risk_score": z.get("risk_score", 0),
            "opportunity_score": z.get("opportunity_score", 0),
            "population": z.get("population_impacted", 0),
            "status": z.get("status"),
            "flags": z.get("flags") or {},
            "pfas_detected": z.get("pfas_detected"),
            "lead_risk_tier": z.get("lead_risk_tier"),
            "top_issue": z.get("top_issue"),
            "median_household_income": z.get("median_household_income"),
        })

    return {
        "features": features,
        "pending_lookups": max(0, len(missing) - resolved),
        "total_zips": len(zips),
    }


@app.post("/api/ucmr/import")
async def api_import_ucmr(file: UploadFile = File(...)) -> dict[str, Any]:
    """Import UCMR 5 occurrence data from EPA's downloadable text file.

    Download the pipe-delimited UCMR5_All.txt (or the regional files) from
    https://www.epa.gov/dwucmr/occurrence-data-unregulated-contaminant-monitoring-rule
    and upload it here. We filter to PWSIDs already in our DB so storage
    stays bounded to the target area.
    """
    raw = await file.read()
    # EPA's UCMR text files are Windows-1252 (µ = \xb5). UTF-8 with replace
    # mangles the unit column which we depend on for PFAS MCL comparisons.
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252", errors="replace")

    # EPA text files are tab-delimited; some exports are pipe. Detect.
    delim = "\t"
    first = text.splitlines()[0] if text else ""
    if "|" in first and "\t" not in first:
        delim = "|"

    with db.connect() as c:
        known = {r["pwsid"] for r in c.execute("SELECT pwsid FROM water_systems").fetchall()}

    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    rows: list[dict[str, Any]] = []
    seen_pwsids: set[str] = set()
    for row in reader:
        norm = {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        pwsid = norm.get("pwsid") or norm.get("pws_id") or norm.get("pws id")
        if not pwsid:
            continue
        if known and pwsid not in known:
            continue
        seen_pwsids.add(pwsid)
        rows.append({
            "pwsid": pwsid,
            "contaminant": norm.get("contaminant"),
            "contaminant_code": norm.get("contaminant_code"),
            "analytical_method": norm.get("methodid")
                or norm.get("analyticalmethodid") or norm.get("analytical_method"),
            "sample_measure": norm.get("analyticalresultvalue")
                or norm.get("analyticalresultsvalue")
                or norm.get("analytical_result_value")
                or norm.get("analytical_results_value")
                or norm.get("result"),
            "analytical_results_sign": norm.get("analyticalresultssign")
                or norm.get("analyticalresultsign")
                or norm.get("analytical_results_sign"),
            "unit_of_measure": norm.get("units") or norm.get("unit")
                or norm.get("analyticalresultsunits"),
            "mrl": norm.get("mrl"),
            "collection_date": norm.get("collectiondate") or norm.get("collection_date"),
            "sample_point_name": norm.get("samplepointname"),
            "sample_point_id": norm.get("samplepointid"),
            "facility_name": norm.get("facilityname") or norm.get("fac_name"),
            "ucmr_cycle": "UCMR5",
        })

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="No rows matched. Check the file has a pwsid column and "
                   "contains utilities in your current target area.",
        )

    n = db.replace_ucmr(list(seen_pwsids), rows)
    db.update_pfas_flag(db.pfas_pwsids())
    # Rebuild ZIP targets so the PFAS flags propagate into risk + opportunity
    # scoring immediately — otherwise the user would need a full EPA re-sync.
    with db.connect() as c:
        all_pwsids = [r["pwsid"] for r in c.execute("SELECT pwsid FROM water_systems").fetchall()]
    zip_n, _ = _rescore_from_db(all_pwsids)
    return {
        "ok": True, "imported": n, "pwsids": len(seen_pwsids),
        "zip_targets_rebuilt": zip_n,
    }


class LslRow(BaseModel):
    pwsid: str
    lead_lines: int | None = 0
    galvanized_lines: int | None = 0
    unknown_lines: int | None = 0
    non_lead_lines: int | None = 0
    total_lines: int | None = 0
    reported_date: str | None = None
    data_source: str | None = "manual"
    notes: str | None = None


class LslImportRequest(BaseModel):
    rows: list[LslRow]


@app.post("/api/lsl/import")
def api_import_lsl(req: LslImportRequest) -> dict[str, Any]:
    n = db.upsert_lsl_inventory([r.model_dump() for r in req.rows])
    with db.connect() as c:
        all_pwsids = [r["pwsid"] for r in c.execute("SELECT pwsid FROM water_systems").fetchall()]
    zip_n, _ = _rescore_from_db(all_pwsids)
    return {"ok": True, "imported": n, "zip_targets_rebuilt": zip_n}


@app.post("/api/rescore")
def api_rescore() -> dict[str, Any]:
    """Re-run scoring from current DB state without hitting EPA.
    Useful after imports or scoring-logic tweaks."""
    with db.connect() as c:
        all_pwsids = [r["pwsid"] for r in c.execute("SELECT pwsid FROM water_systems").fetchall()]
    zip_n, tiers = _rescore_from_db(all_pwsids)
    return {"ok": True, "zip_targets": zip_n, "systems_retiered": len(tiers)}


@app.get("/api/export.csv")
def api_export_csv() -> StreamingResponse:
    zips = db.list_zip_targets(sort="score_desc")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "ZIP", "City", "County", "State",
        "Risk Score", "Opportunity Score", "Population Impacted",
        "Median HH Income", "Median Home Value", "Owner-Occupied %", "Pre-1980 Housing %",
        "Top Issue", "Top Contaminant",
        "MCL", "TT", "Lead (LCR)", "Copper (LCR)", "PFAS", "PFAS > MCL",
        "Lead Risk Tier", "PWSIDs", "Status", "Notes", "Updated",
    ])
    for z in zips:
        flags = z.get("flags") or {}
        w.writerow([
            z.get("zip_code", ""),
            z.get("city") or "",
            z.get("county") or "",
            z.get("state") or "",
            z.get("risk_score", 0),
            z.get("opportunity_score", 0),
            z.get("population_impacted", 0),
            z.get("median_household_income") or "",
            z.get("median_home_value") or "",
            z.get("owner_occupied_pct") or "",
            z.get("pre_1980_housing_pct") or "",
            z.get("top_issue") or "",
            z.get("top_contaminant") or "",
            "Y" if flags.get("mcl") else "",
            "Y" if flags.get("tt") else "",
            "Y" if flags.get("lcr_lead") else "",
            "Y" if flags.get("lcr_copper") else "",
            "Y" if z.get("pfas_detected") else "",
            "Y" if flags.get("pfas_mcl") else "",
            z.get("lead_risk_tier") or "unknown",
            "; ".join(z.get("pwsids") or []),
            z.get("status", ""),
            (z.get("notes") or "").replace("\n", " "),
            z.get("updated_at", ""),
        ])
    buf.seek(0)
    county_slug = TARGET_COUNTY.lower().replace(" ", "-")
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition":
                f'attachment; filename="{county_slug}-water-filter-leads.csv"'
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
    if AQUA_BASICAUTH_ENABLED and LISTEN_HOST in ("0.0.0.0", "::"):
        log.info(
            "Listening on all interfaces with Basic auth. Prefer a reverse "
            "proxy (HTTPS) or a private tunnel if exposing beyond LAN."
        )
    log.info("Listening on http://%s:%s (reload=%s)", LISTEN_HOST, LISTEN_PORT, AQUA_RELOAD)
    uvicorn.run(
        "main:app",
        host=LISTEN_HOST,
        port=LISTEN_PORT,
        reload=AQUA_RELOAD,
    )
