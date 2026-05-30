"""SQLite persistence for the water-filtration lead generator.

Tables:
  water_systems   one row per PWSID (SDWIS WATER_SYSTEM)
  service_areas   many-to-many PWSID <-> (ZIP, city) from GEOGRAPHIC_AREA
  violations      one row per violation_id (SDWIS VIOLATION)
  lcr_results     one row per sar_id (LCR 90th-percentile sample result)
  zip_targets     B2C pipeline row, one per ZIP in the target area
  sync_runs       history of /api/sync calls
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterable

DB_PATH = os.getenv("DATABASE_PATH", "water-leads.db")

VALID_STATUSES = (
    "new",
    "researching",
    "campaign_live",
    "converted",
    "skip",
)

_lock = threading.Lock()
_schema_ready = False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect():
    global _schema_ready
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # Self-heal: if the schema has never been created in this process (or the
    # DB file was blown away / is still zero-bytes from a previous run), make
    # sure every required table exists before the caller runs a query.
    if not _schema_ready:
        try:
            row = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='water_systems'"
            ).fetchone()
            if row is None:
                conn.executescript(_SCHEMA_SQL)
                conn.commit()
            _schema_ready = True
        except sqlite3.Error:
            # Fall through; init_db() will surface a better error to the caller.
            pass
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS water_systems (
    pwsid                TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    pws_type             TEXT,
    pws_activity         TEXT,
    population_served    INTEGER DEFAULT 0,
    service_connections  INTEGER DEFAULT 0,
    primary_source       TEXT,
    owner_type           TEXT,
    primacy_agency       TEXT,
    city                 TEXT,
    county               TEXT,
    state                TEXT,
    zip_code             TEXT,
    admin_name           TEXT,
    admin_phone          TEXT,
    admin_email          TEXT,
    counties_served      TEXT,
    cities_served        TEXT,
    lead_risk_tier       TEXT DEFAULT 'unknown',
    pfas_detected        INTEGER DEFAULT 0,
    last_synced_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ws_city   ON water_systems(city);
CREATE INDEX IF NOT EXISTS idx_ws_county ON water_systems(county);

CREATE TABLE IF NOT EXISTS service_areas (
    pwsid      TEXT NOT NULL,
    zip_code   TEXT,
    city       TEXT,
    county     TEXT,
    state      TEXT,
    area_type  TEXT,
    UNIQUE(pwsid, zip_code, city)
);

CREATE INDEX IF NOT EXISTS idx_sa_zip    ON service_areas(zip_code);
CREATE INDEX IF NOT EXISTS idx_sa_pwsid  ON service_areas(pwsid);
CREATE INDEX IF NOT EXISTS idx_sa_city   ON service_areas(city);

CREATE TABLE IF NOT EXISTS violations (
    violation_id       TEXT PRIMARY KEY,
    pwsid              TEXT NOT NULL,
    category           TEXT,
    code               TEXT,
    contaminant_code   TEXT,
    is_health_based    INTEGER DEFAULT 0,
    compliance_status  TEXT,
    begin_date         TEXT,
    end_date           TEXT,
    rtc_date           TEXT,
    rule_code          TEXT,
    rule_group         TEXT,
    viol_measure       REAL,
    unit_of_measure    TEXT,
    state_mcl          REAL
);

CREATE INDEX IF NOT EXISTS idx_v_pwsid    ON violations(pwsid);
CREATE INDEX IF NOT EXISTS idx_v_category ON violations(category);
CREATE INDEX IF NOT EXISTS idx_v_status   ON violations(compliance_status);

CREATE TABLE IF NOT EXISTS lcr_results (
    sar_id              TEXT PRIMARY KEY,
    pwsid               TEXT NOT NULL,
    contaminant_code    TEXT,
    sample_measure      REAL,
    unit_of_measure     TEXT,
    sampling_end_date   TEXT,
    sampling_start_date TEXT,
    result_sign_code    TEXT,
    exceeds_action      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lcr_pwsid ON lcr_results(pwsid);
CREATE INDEX IF NOT EXISTS idx_lcr_exc   ON lcr_results(exceeds_action);

CREATE TABLE IF NOT EXISTS zip_targets (
    zip_code            TEXT PRIMARY KEY,
    city                TEXT,
    county              TEXT,
    state               TEXT,
    pwsids_json         TEXT,
    risk_score          REAL DEFAULT 0,
    opportunity_score   REAL DEFAULT 0,
    population_impacted INTEGER DEFAULT 0,
    top_issue           TEXT,
    top_contaminant     TEXT,
    flags_json          TEXT,
    pfas_detected       INTEGER DEFAULT 0,
    lead_risk_tier      TEXT DEFAULT 'unknown',
    status              TEXT DEFAULT 'new',
    notes               TEXT DEFAULT '',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zt_score  ON zip_targets(risk_score);
CREATE INDEX IF NOT EXISTS idx_zt_status ON zip_targets(status);

CREATE TABLE IF NOT EXISTS sync_runs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    state             TEXT,
    county            TEXT,
    started_at        TEXT,
    finished_at       TEXT,
    systems_count     INTEGER,
    violations_count  INTEGER,
    lcr_count         INTEGER,
    zip_count         INTEGER,
    ucmr_count        INTEGER DEFAULT 0,
    demographics_count INTEGER DEFAULT 0,
    alerts_count      INTEGER DEFAULT 0,
    trigger           TEXT DEFAULT 'manual',
    error             TEXT
);

-- UCMR 5 (PFAS & other unregulated contaminant) occurrence data
CREATE TABLE IF NOT EXISTS ucmr_results (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    pwsid               TEXT NOT NULL,
    contaminant         TEXT,
    contaminant_code    TEXT,
    analytical_method   TEXT,
    sample_measure      REAL,
    unit_of_measure     TEXT,
    mrl                 REAL,
    collection_date     TEXT,
    sample_point        TEXT,
    facility_name       TEXT,
    exceeds_mcl         INTEGER DEFAULT 0,
    exceeds_ha          INTEGER DEFAULT 0,
    ucmr_cycle          TEXT DEFAULT 'UCMR5',
    UNIQUE(pwsid, contaminant, collection_date, sample_point)
);

CREATE INDEX IF NOT EXISTS idx_ucmr_pwsid   ON ucmr_results(pwsid);
CREATE INDEX IF NOT EXISTS idx_ucmr_contam  ON ucmr_results(contaminant);
CREATE INDEX IF NOT EXISTS idx_ucmr_exc_mcl ON ucmr_results(exceeds_mcl);

-- Lead Service Line Inventory rows (LCRR, Oct 2024+). Currently populated
-- from CSV uploads; schema stubbed now so the UI can always surface it.
CREATE TABLE IF NOT EXISTS lsl_inventory (
    pwsid              TEXT PRIMARY KEY,
    lead_lines         INTEGER DEFAULT 0,
    galvanized_lines   INTEGER DEFAULT 0,
    unknown_lines      INTEGER DEFAULT 0,
    non_lead_lines     INTEGER DEFAULT 0,
    total_lines        INTEGER DEFAULT 0,
    reported_date      TEXT,
    data_source        TEXT,
    notes              TEXT
);

-- ACS 5-year demographics keyed by ZIP (ZCTA) for buyer targeting
CREATE TABLE IF NOT EXISTS zip_demographics (
    zip_code                 TEXT PRIMARY KEY,
    population               INTEGER,
    households               INTEGER,
    median_household_income  INTEGER,
    median_home_value        INTEGER,
    owner_occupied_pct       REAL,
    pre_1980_housing_pct     REAL,
    last_synced_at           TEXT
);

-- Geocoded ZIP centroids for the map view. Populated lazily via Nominatim.
CREATE TABLE IF NOT EXISTS zip_centroids (
    zip_code        TEXT PRIMARY KEY,
    lat             REAL,
    lon             REAL,
    display_name    TEXT,
    source          TEXT,
    resolved_at     TEXT,
    failed_attempts INTEGER DEFAULT 0
);

-- Scheduler + alert rows. alert_type: new_mcl / new_lcr / new_pfas / new_tt
CREATE TABLE IF NOT EXISTS sync_alerts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type      TEXT NOT NULL,
    severity        TEXT DEFAULT 'info',
    pwsid           TEXT,
    zip_code        TEXT,
    title           TEXT,
    details         TEXT,
    created_at      TEXT NOT NULL,
    seen            INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_alerts_seen ON sync_alerts(seen);
CREATE INDEX IF NOT EXISTS idx_alerts_zip  ON sync_alerts(zip_code);
"""


_MIGRATIONS: list[tuple[str, str]] = [
    ("water_systems",   "ALTER TABLE water_systems ADD COLUMN lead_risk_tier TEXT DEFAULT 'unknown'"),
    ("water_systems",   "ALTER TABLE water_systems ADD COLUMN pfas_detected INTEGER DEFAULT 0"),
    ("zip_targets",     "ALTER TABLE zip_targets ADD COLUMN opportunity_score REAL DEFAULT 0"),
    ("zip_targets",     "ALTER TABLE zip_targets ADD COLUMN pfas_detected INTEGER DEFAULT 0"),
    ("zip_targets",     "ALTER TABLE zip_targets ADD COLUMN lead_risk_tier TEXT DEFAULT 'unknown'"),
    ("sync_runs",       "ALTER TABLE sync_runs ADD COLUMN ucmr_count INTEGER DEFAULT 0"),
    ("sync_runs",       "ALTER TABLE sync_runs ADD COLUMN demographics_count INTEGER DEFAULT 0"),
    ("sync_runs",       "ALTER TABLE sync_runs ADD COLUMN alerts_count INTEGER DEFAULT 0"),
    ("sync_runs",       "ALTER TABLE sync_runs ADD COLUMN trigger TEXT DEFAULT 'manual'"),
]


def _run_migrations(conn: sqlite3.Connection) -> None:
    """Apply idempotent ALTER TABLE migrations for schemas older than current."""
    for table, ddl in _MIGRATIONS:
        col = ddl.split("ADD COLUMN", 1)[1].strip().split()[0]
        existing = {
            r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()
        }
        if col not in existing:
            try:
                conn.execute(ddl)
            except sqlite3.OperationalError:
                pass


def init_db() -> None:
    global _schema_ready
    with connect() as c:
        c.executescript(_SCHEMA_SQL)
        _run_migrations(c)
    _schema_ready = True


# ---------- helpers ----------


def _to_int(v: Any) -> int:
    if v is None or v == "":
        return 0
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def _to_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _yn(v: Any) -> int:
    if v is None:
        return 0
    s = str(v).strip().upper()
    return 1 if s in ("Y", "YES", "TRUE", "1") else 0


# ---------- bulk upserts used by sync ----------


def replace_service_areas(pwsids: Iterable[str], geo_rows: list[dict[str, Any]]) -> int:
    """Clear service_areas for the given PWSIDs, then re-insert from geo_rows."""
    pwsids = list(pwsids)
    count = 0
    with _lock, connect() as c:
        if pwsids:
            placeholders = ",".join("?" * len(pwsids))
            c.execute(
                f"DELETE FROM service_areas WHERE pwsid IN ({placeholders})",
                pwsids,
            )
        seen: set[tuple[str, str, str]] = set()
        for r in geo_rows:
            pwsid = r.get("pwsid")
            if not pwsid:
                continue
            key = (pwsid, r.get("zip_code_served") or "", r.get("city_served") or "")
            if key in seen:
                continue
            seen.add(key)
            c.execute(
                """
                INSERT OR IGNORE INTO service_areas
                    (pwsid, zip_code, city, county, state, area_type)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    pwsid,
                    r.get("zip_code_served") or None,
                    r.get("city_served") or None,
                    r.get("county_served") or None,
                    r.get("state_served") or None,
                    r.get("area_type_code") or None,
                ),
            )
            count += 1
    return count


def upsert_water_systems(rows: list[dict[str, Any]]) -> int:
    now = _now()
    n = 0
    with _lock, connect() as c:
        for r in rows:
            pwsid = r.get("pwsid")
            if not pwsid:
                continue
            c.execute(
                """
                INSERT INTO water_systems (
                    pwsid, name, pws_type, pws_activity, population_served,
                    service_connections, primary_source, owner_type, primacy_agency,
                    city, county, state, zip_code,
                    admin_name, admin_phone, admin_email,
                    counties_served, cities_served, last_synced_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pwsid) DO UPDATE SET
                    name=excluded.name,
                    pws_type=excluded.pws_type,
                    pws_activity=excluded.pws_activity,
                    population_served=excluded.population_served,
                    service_connections=excluded.service_connections,
                    primary_source=excluded.primary_source,
                    owner_type=excluded.owner_type,
                    primacy_agency=excluded.primacy_agency,
                    city=excluded.city,
                    county=excluded.county,
                    state=excluded.state,
                    zip_code=excluded.zip_code,
                    admin_name=excluded.admin_name,
                    admin_phone=excluded.admin_phone,
                    admin_email=excluded.admin_email,
                    counties_served=excluded.counties_served,
                    cities_served=excluded.cities_served,
                    last_synced_at=excluded.last_synced_at
                """,
                (
                    pwsid,
                    r.get("pws_name") or r.get("name") or pwsid,
                    r.get("pws_type_code"),
                    r.get("pws_activity_code"),
                    _to_int(r.get("population_served_count")),
                    _to_int(r.get("service_connections_count")),
                    r.get("gw_sw_code") or r.get("primary_source_code"),
                    r.get("owner_type_code"),
                    r.get("primacy_agency_code"),
                    r.get("city_name") or r.get("city"),
                    r.get("county") or r.get("counties_served"),
                    r.get("state_code") or r.get("state"),
                    r.get("zip_code"),
                    r.get("admin_name") or r.get("contact_name") or r.get("org_name"),
                    r.get("phone_number") or r.get("admin_phone"),
                    r.get("email_addr") or r.get("admin_email"),
                    r.get("counties_served"),
                    r.get("cities_served"),
                    now,
                ),
            )
            n += 1
    return n


def replace_violations(pwsids: Iterable[str], rows: list[dict[str, Any]]) -> int:
    pwsids = list(pwsids)
    n = 0
    with _lock, connect() as c:
        if pwsids:
            placeholders = ",".join("?" * len(pwsids))
            c.execute(
                f"DELETE FROM violations WHERE pwsid IN ({placeholders})",
                pwsids,
            )
        for r in rows:
            vid = r.get("violation_id")
            pwsid = r.get("pwsid")
            if not vid or not pwsid:
                continue
            c.execute(
                """
                INSERT OR REPLACE INTO violations (
                    violation_id, pwsid, category, code, contaminant_code,
                    is_health_based, compliance_status,
                    begin_date, end_date, rtc_date,
                    rule_code, rule_group, viol_measure, unit_of_measure, state_mcl
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    vid,
                    pwsid,
                    r.get("violation_category_code"),
                    r.get("violation_code"),
                    r.get("contaminant_code"),
                    _yn(r.get("is_health_based_ind")),
                    r.get("compliance_status_code"),
                    r.get("compl_per_begin_date") or r.get("non_compl_per_begin_date"),
                    r.get("compl_per_end_date") or r.get("non_compl_per_end_date"),
                    r.get("rtc_date"),
                    r.get("rule_code"),
                    r.get("rule_group_code"),
                    _to_float(r.get("viol_measure")),
                    r.get("unit_of_measure"),
                    _to_float(r.get("state_mcl")),
                ),
            )
            n += 1
    return n


def replace_lcr(pwsids: Iterable[str], rows: list[dict[str, Any]]) -> int:
    pwsids = list(pwsids)
    n = 0
    with _lock, connect() as c:
        if pwsids:
            placeholders = ",".join("?" * len(pwsids))
            c.execute(
                f"DELETE FROM lcr_results WHERE pwsid IN ({placeholders})",
                pwsids,
            )
        for r in rows:
            sar = r.get("sar_id")
            pwsid = r.get("pwsid")
            if not sar or not pwsid:
                continue
            measure = _to_float(r.get("sample_measure"))
            contam = (r.get("contaminant_code") or "").upper()
            exceeds = 0
            if measure is not None:
                # PB5 = Lead (action level 0.015 mg/L = 15 ug/L)
                # CU2 = Copper (action level 1.3 mg/L = 1300 ug/L)
                # Envirofacts often stores mg/L for LCR samples.
                if "PB" in contam or "LEAD" in contam:
                    exceeds = 1 if measure >= 0.015 else 0
                elif "CU" in contam or "COPPER" in contam:
                    exceeds = 1 if measure >= 1.3 else 0
            c.execute(
                """
                INSERT OR REPLACE INTO lcr_results (
                    sar_id, pwsid, contaminant_code, sample_measure,
                    unit_of_measure, sampling_end_date, sampling_start_date,
                    result_sign_code, exceeds_action
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sar,
                    pwsid,
                    r.get("contaminant_code"),
                    measure,
                    r.get("unit_of_measure"),
                    r.get("sampling_end_date"),
                    r.get("sampling_start_date"),
                    r.get("result_sign_code"),
                    exceeds,
                ),
            )
            n += 1
    return n


# ---------- read helpers ----------


def list_systems(
    flagged_only: bool = False,
    issue_type: str | None = None,
    min_pop: int = 0,
    search: str | None = None,
) -> list[dict[str, Any]]:
    with connect() as c:
        sql = """
            SELECT ws.*,
                   (SELECT COUNT(*) FROM violations v
                     WHERE v.pwsid = ws.pwsid
                       AND UPPER(COALESCE(v.compliance_status, '')) IN ('O','K','U')
                   ) AS open_violations,
                   (SELECT COUNT(*) FROM violations v
                     WHERE v.pwsid = ws.pwsid
                       AND UPPER(COALESCE(v.compliance_status, '')) IN ('O','K','U')
                       AND UPPER(COALESCE(v.category,'')) IN ('MCL','MRDL')
                   ) AS open_mcl,
                   (SELECT COUNT(*) FROM violations v
                     WHERE v.pwsid = ws.pwsid
                       AND UPPER(COALESCE(v.compliance_status, '')) IN ('O','K','U')
                       AND UPPER(COALESCE(v.category,'')) = 'TT'
                   ) AS open_tt,
                   (SELECT COUNT(*) FROM lcr_results l
                     WHERE l.pwsid = ws.pwsid AND l.exceeds_action = 1
                   ) AS lcr_exceedances
            FROM water_systems ws
        """
        where: list[str] = []
        params: list[Any] = []

        if min_pop > 0:
            where.append("ws.population_served >= ?")
            params.append(min_pop)

        if search:
            where.append("(LOWER(ws.name) LIKE ? OR LOWER(ws.pwsid) LIKE ? "
                         "OR LOWER(COALESCE(ws.city,'')) LIKE ?)")
            like = f"%{search.lower()}%"
            params.extend([like, like, like])

        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY ws.population_served DESC"

        rows = [dict(r) for r in c.execute(sql, params).fetchall()]

    if flagged_only:
        rows = [
            r for r in rows
            if r["open_mcl"] or r["open_tt"] or r["lcr_exceedances"]
        ]
    if issue_type == "mcl":
        rows = [r for r in rows if r["open_mcl"]]
    elif issue_type == "lcr":
        rows = [r for r in rows if r["lcr_exceedances"]]
    elif issue_type == "tt":
        rows = [r for r in rows if r["open_tt"]]

    return rows


def get_system(pwsid: str) -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute(
            "SELECT * FROM water_systems WHERE pwsid = ?", (pwsid,)
        ).fetchone()
        if not row:
            return None
        system = dict(row)

        violations = [
            dict(r) for r in c.execute(
                "SELECT * FROM violations WHERE pwsid = ? "
                "ORDER BY COALESCE(begin_date,'') DESC",
                (pwsid,),
            ).fetchall()
        ]
        lcr = [
            dict(r) for r in c.execute(
                "SELECT * FROM lcr_results WHERE pwsid = ? "
                "ORDER BY COALESCE(sampling_end_date,'') DESC",
                (pwsid,),
            ).fetchall()
        ]
        areas = [
            dict(r) for r in c.execute(
                "SELECT * FROM service_areas WHERE pwsid = ?", (pwsid,)
            ).fetchall()
        ]
    return {
        "system": system,
        "violations": violations,
        "lcr_results": lcr,
        "service_areas": areas,
    }


def _row_to_zip(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["pwsids"] = json.loads(d.get("pwsids_json") or "[]")
    d["flags"] = json.loads(d.get("flags_json") or "{}")
    d.pop("pwsids_json", None)
    d.pop("flags_json", None)
    return d


def list_zip_targets(
    status: str | None = None,
    flagged_only: bool = False,
    search: str | None = None,
    sort: str = "score_desc",
) -> list[dict[str, Any]]:
    where: list[str] = []
    params: list[Any] = []

    if status and status in VALID_STATUSES:
        where.append("status = ?")
        params.append(status)
    if flagged_only:
        where.append("risk_score > 0")
    if search:
        where.append("(LOWER(zip_code) LIKE ? OR LOWER(COALESCE(city,'')) LIKE ?)")
        like = f"%{search.lower()}%"
        params.extend([like, like])

    sort_sql = {
        "score_desc":       "risk_score DESC, population_impacted DESC",
        "opportunity_desc": "opportunity_score DESC, risk_score DESC",
        "population":       "population_impacted DESC",
        "zip_asc":          "zip_code ASC",
        "updated_desc":     "updated_at DESC",
        "income_desc":      "(SELECT median_household_income FROM zip_demographics d "
                            "WHERE d.zip_code = zip_targets.zip_code) DESC",
    }.get(sort, "risk_score DESC, population_impacted DESC")

    sql = "SELECT * FROM zip_targets"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += f" ORDER BY {sort_sql}"

    with connect() as c:
        rows = c.execute(sql, params).fetchall()
        out = [_row_to_zip(r) for r in rows]
        demos = all_demographics()
    for z in out:
        d = demos.get(z["zip_code"]) or {}
        z["median_household_income"] = d.get("median_household_income")
        z["median_home_value"] = d.get("median_home_value")
        z["owner_occupied_pct"] = d.get("owner_occupied_pct")
        z["pre_1980_housing_pct"] = d.get("pre_1980_housing_pct")
    return out


def get_zip_target(zip_code: str) -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute(
            "SELECT * FROM zip_targets WHERE zip_code = ?", (zip_code,)
        ).fetchone()
        if not row:
            return None
        target = _row_to_zip(row)
        systems: list[dict[str, Any]] = []
        for pwsid in target["pwsids"]:
            sr = c.execute(
                "SELECT * FROM water_systems WHERE pwsid = ?", (pwsid,)
            ).fetchone()
            if sr:
                s = dict(sr)
                open_v = c.execute(
                    "SELECT COUNT(*) AS n FROM violations v WHERE v.pwsid = ? "
                    "AND UPPER(COALESCE(v.compliance_status,'')) IN ('O','K','U')",
                    (pwsid,),
                ).fetchone()["n"]
                open_health = c.execute(
                    "SELECT COUNT(*) AS n FROM violations v WHERE v.pwsid = ? "
                    "AND UPPER(COALESCE(v.compliance_status,'')) IN ('O','K','U') "
                    "AND UPPER(COALESCE(v.category,'')) IN ('MCL','MRDL','TT')",
                    (pwsid,),
                ).fetchone()["n"]
                lcr_x = c.execute(
                    "SELECT COUNT(*) AS n FROM lcr_results "
                    "WHERE pwsid = ? AND exceeds_action = 1",
                    (pwsid,),
                ).fetchone()["n"]
                lcr_worst = c.execute(
                    "SELECT sample_measure, unit_of_measure, sampling_end_date "
                    "FROM lcr_results WHERE pwsid = ? "
                    "AND UPPER(COALESCE(contaminant_code,'')) IN ('PB90','LEAD') "
                    "ORDER BY sample_measure DESC LIMIT 1",
                    (pwsid,),
                ).fetchone()
                s["open_violations"] = open_v
                s["open_health_violations"] = open_health
                s["lcr_exceedances"] = lcr_x
                if lcr_worst and lcr_worst["sample_measure"] is not None:
                    s["worst_lead_sample"] = {
                        "value": lcr_worst["sample_measure"],
                        "unit": lcr_worst["unit_of_measure"] or "mg/L",
                        "date": lcr_worst["sampling_end_date"],
                    }
                # Service cities specific to this system (used to name sub-areas).
                cities = [
                    r["city"] for r in c.execute(
                        "SELECT DISTINCT city FROM service_areas "
                        "WHERE pwsid = ? AND zip_code = ? AND city IS NOT NULL AND city != ''",
                        (pwsid, target["zip_code"]),
                    ).fetchall()
                ]
                s["service_cities"] = cities
                systems.append(s)
        target["systems"] = systems

        flagged_contaminants: list[dict[str, Any]] = []
        seen = set()
        for pwsid in target["pwsids"]:
            for r in c.execute(
                "SELECT pwsid, contaminant_code, category, code, begin_date "
                "FROM violations WHERE pwsid = ? "
                "AND UPPER(COALESCE(compliance_status,'')) IN ('O','K','U') "
                "AND UPPER(COALESCE(category,'')) IN ('MCL','MRDL','TT')",
                (pwsid,),
            ).fetchall():
                key = (r["pwsid"], r["contaminant_code"], r["category"])
                if key in seen:
                    continue
                seen.add(key)
                flagged_contaminants.append(dict(r))
        target["flagged_contaminants"] = flagged_contaminants

        pfas_hits: list[dict[str, Any]] = []
        for pwsid in target["pwsids"]:
            for r in c.execute(
                "SELECT * FROM ucmr_results WHERE pwsid = ? "
                "AND UPPER(COALESCE(contaminant,'')) LIKE '%PF%' "
                "AND COALESCE(sample_measure, 0) > 0 "
                "ORDER BY exceeds_mcl DESC, sample_measure DESC LIMIT 20",
                (pwsid,),
            ).fetchall():
                pfas_hits.append(dict(r))
        target["pfas_results"] = pfas_hits

        lsl_rows: list[dict[str, Any]] = []
        for pwsid in target["pwsids"]:
            r = c.execute(
                "SELECT * FROM lsl_inventory WHERE pwsid = ?", (pwsid,)
            ).fetchone()
            if r:
                lsl_rows.append(dict(r))
        target["lsl_inventory"] = lsl_rows

    demo = demographics_for_zip(target["zip_code"]) or {}
    target["demographics"] = {
        "median_household_income": demo.get("median_household_income"),
        "median_home_value": demo.get("median_home_value"),
        "owner_occupied_pct": demo.get("owner_occupied_pct"),
        "pre_1980_housing_pct": demo.get("pre_1980_housing_pct"),
        "population": demo.get("population"),
        "households": demo.get("households"),
    }
    centroid = get_centroid(target["zip_code"]) or {}
    if centroid.get("lat") is not None:
        target["centroid"] = {"lat": centroid["lat"], "lon": centroid["lon"]}
    return target


def update_zip_target(zip_code: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {"status", "notes"}
    sets: list[str] = []
    params: list[Any] = []
    for k, v in fields.items():
        if k not in allowed:
            continue
        if k == "status" and v not in VALID_STATUSES:
            continue
        sets.append(f"{k} = ?")
        params.append(v)
    if not sets:
        return get_zip_target(zip_code)

    sets.append("updated_at = ?")
    params.append(_now())
    params.append(zip_code)

    with _lock, connect() as c:
        c.execute(
            f"UPDATE zip_targets SET {', '.join(sets)} WHERE zip_code = ?",
            params,
        )
    return get_zip_target(zip_code)


def replace_zip_targets(targets: list[dict[str, Any]]) -> int:
    """Rebuild zip_targets table. Preserves user-set status/notes per ZIP."""
    now = _now()
    n = 0
    with _lock, connect() as c:
        existing = {
            r["zip_code"]: (r["status"], r["notes"], r["created_at"])
            for r in c.execute(
                "SELECT zip_code, status, notes, created_at FROM zip_targets"
            ).fetchall()
        }
        c.execute("DELETE FROM zip_targets")
        for t in targets:
            zip_code = t.get("zip_code")
            if not zip_code:
                continue
            prev_status, prev_notes, prev_created = existing.get(
                zip_code, ("new", "", now)
            )
            c.execute(
                """
                INSERT INTO zip_targets (
                    zip_code, city, county, state, pwsids_json,
                    risk_score, opportunity_score, population_impacted,
                    top_issue, top_contaminant, flags_json,
                    pfas_detected, lead_risk_tier,
                    status, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    zip_code,
                    t.get("city"),
                    t.get("county"),
                    t.get("state"),
                    json.dumps(t.get("pwsids") or []),
                    float(t.get("risk_score") or 0),
                    float(t.get("opportunity_score") or 0),
                    int(t.get("population_impacted") or 0),
                    t.get("top_issue"),
                    t.get("top_contaminant"),
                    json.dumps(t.get("flags") or {}),
                    1 if t.get("pfas_detected") else 0,
                    t.get("lead_risk_tier") or "unknown",
                    prev_status,
                    prev_notes,
                    prev_created,
                    now,
                ),
            )
            n += 1
    return n


# ---------- sync_runs ----------


def record_sync_start(state: str, county: str) -> int:
    with _lock, connect() as c:
        cur = c.execute(
            "INSERT INTO sync_runs (state, county, started_at) VALUES (?, ?, ?)",
            (state, county, _now()),
        )
        return cur.lastrowid


def record_sync_finish(
    run_id: int,
    systems_count: int,
    violations_count: int,
    lcr_count: int,
    zip_count: int,
    error: str | None = None,
) -> None:
    with _lock, connect() as c:
        c.execute(
            "UPDATE sync_runs SET finished_at = ?, systems_count = ?, "
            "violations_count = ?, lcr_count = ?, zip_count = ?, error = ? "
            "WHERE id = ?",
            (_now(), systems_count, violations_count, lcr_count, zip_count, error, run_id),
        )


def last_sync() -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute(
            "SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return dict(row) if row else None


def stats() -> dict[str, Any]:
    with connect() as c:
        total_ws = c.execute("SELECT COUNT(*) AS n FROM water_systems").fetchone()["n"]
        total_zip = c.execute("SELECT COUNT(*) AS n FROM zip_targets").fetchone()["n"]
        flagged_zip = c.execute(
            "SELECT COUNT(*) AS n FROM zip_targets WHERE risk_score > 0"
        ).fetchone()["n"]
        open_mcl = c.execute(
            "SELECT COUNT(*) AS n FROM violations "
            "WHERE UPPER(COALESCE(compliance_status,'')) IN ('O','K','U') "
            "AND UPPER(COALESCE(category,'')) IN ('MCL','MRDL')"
        ).fetchone()["n"]
        lcr_x = c.execute(
            "SELECT COUNT(*) AS n FROM lcr_results WHERE exceeds_action = 1"
        ).fetchone()["n"]
        pop = c.execute(
            "SELECT COALESCE(SUM(population_served),0) AS n FROM water_systems"
        ).fetchone()["n"]
        pfas_zips = c.execute(
            "SELECT COUNT(*) AS n FROM zip_targets WHERE pfas_detected = 1"
        ).fetchone()["n"]
        lead_high_zips = c.execute(
            "SELECT COUNT(*) AS n FROM zip_targets WHERE lead_risk_tier = 'high'"
        ).fetchone()["n"]
        ucmr_rows = c.execute("SELECT COUNT(*) AS n FROM ucmr_results").fetchone()["n"]
        unread_alerts = c.execute(
            "SELECT COUNT(*) AS n FROM sync_alerts WHERE seen = 0"
        ).fetchone()["n"]
        by_status = {
            r["status"]: r["n"]
            for r in c.execute(
                "SELECT status, COUNT(*) AS n FROM zip_targets GROUP BY status"
            ).fetchall()
        }
    return {
        "water_systems": total_ws,
        "zip_targets": total_zip,
        "flagged_zips": flagged_zip,
        "open_mcl_violations": open_mcl,
        "lcr_exceedances": lcr_x,
        "total_population": pop,
        "pfas_zips": pfas_zips,
        "lead_high_zips": lead_high_zips,
        "ucmr_rows": ucmr_rows,
        "unread_alerts": unread_alerts,
        "by_status": {s: by_status.get(s, 0) for s in VALID_STATUSES},
    }


# ---------- UCMR 5 ----------


def replace_ucmr(pwsids: Iterable[str], rows: list[dict[str, Any]]) -> int:
    """Clear UCMR 5 rows for a set of PWSIDs and re-insert the fresh pull."""
    pwsids = list(pwsids)
    n = 0
    with _lock, connect() as c:
        if pwsids:
            placeholders = ",".join("?" * len(pwsids))
            c.execute(
                f"DELETE FROM ucmr_results WHERE pwsid IN ({placeholders})",
                pwsids,
            )
        for r in rows:
            pwsid = r.get("pwsid")
            contaminant = r.get("contaminant") or r.get("analyte") or r.get("contaminant_name")
            if not pwsid or not contaminant:
                continue
            measure = _to_float(
                r.get("sample_measure")
                or r.get("analytical_results_value")
                or r.get("analytical_results_sign")
            )
            mrl = _to_float(r.get("mrl") or r.get("reporting_limit"))
            contam_upper = contaminant.upper().strip()
            exceeds_mcl = 0
            exceeds_ha = 0
            if measure is not None:
                # EPA 2024 MCLs for PFAS (ng/L). UCMR reports in ug/L often;
                # treat values liberally — a detection >= MCL regardless of unit
                # gets flagged. Unit normalization is best-effort.
                unit = (r.get("unit_of_measure") or "").lower().strip()
                # µg/L, ug/L, mcg/L all == ppb == 1000 ng/L.
                is_ugl = unit in ("ug/l", "ppb", "mcg/l", "µg/l", "\xb5g/l")
                m_ngl = measure * 1000 if is_ugl else measure
                thresholds = {
                    "PFOA": 4.0, "PFOS": 4.0, "PFHXS": 10.0, "PFNA": 10.0,
                    "HFPO-DA": 10.0, "GENX": 10.0,
                }
                for key, mcl in thresholds.items():
                    if key in contam_upper and m_ngl >= mcl:
                        exceeds_mcl = 1
                        break
                # Any non-zero PFAS detection is sales-relevant
                if "PF" in contam_upper and m_ngl > 0:
                    exceeds_ha = 1 if not exceeds_mcl else exceeds_ha
            c.execute(
                """
                INSERT OR IGNORE INTO ucmr_results (
                    pwsid, contaminant, contaminant_code, analytical_method,
                    sample_measure, unit_of_measure, mrl, collection_date,
                    sample_point, facility_name, exceeds_mcl, exceeds_ha, ucmr_cycle
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pwsid,
                    contaminant,
                    r.get("contaminant_code"),
                    r.get("analytical_method") or r.get("method"),
                    measure,
                    r.get("unit_of_measure") or r.get("unit"),
                    mrl,
                    r.get("collection_date") or r.get("sample_collection_date"),
                    r.get("sample_point_name") or r.get("sample_point_id"),
                    r.get("facility_name") or r.get("fac_name"),
                    exceeds_mcl,
                    exceeds_ha,
                    r.get("ucmr_cycle") or "UCMR5",
                ),
            )
            n += 1
    return n


def pfas_pwsids() -> set[str]:
    """PWSIDs with any PFAS detection in UCMR 5."""
    with connect() as c:
        rows = c.execute(
            "SELECT DISTINCT pwsid FROM ucmr_results "
            "WHERE UPPER(contaminant) LIKE '%PF%' AND COALESCE(sample_measure,0) > 0"
        ).fetchall()
    return {r["pwsid"] for r in rows}


def ucmr_for_pwsid(pwsid: str) -> list[dict[str, Any]]:
    with connect() as c:
        rows = c.execute(
            "SELECT * FROM ucmr_results WHERE pwsid = ? "
            "ORDER BY exceeds_mcl DESC, exceeds_ha DESC, "
            "COALESCE(sample_measure,0) DESC LIMIT 200",
            (pwsid,),
        ).fetchall()
        return [dict(r) for r in rows]


# ---------- LSL inventory ----------


def upsert_lsl_inventory(rows: list[dict[str, Any]]) -> int:
    n = 0
    with _lock, connect() as c:
        for r in rows:
            pwsid = r.get("pwsid")
            if not pwsid:
                continue
            c.execute(
                """
                INSERT INTO lsl_inventory (
                    pwsid, lead_lines, galvanized_lines, unknown_lines,
                    non_lead_lines, total_lines, reported_date, data_source, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pwsid) DO UPDATE SET
                    lead_lines=excluded.lead_lines,
                    galvanized_lines=excluded.galvanized_lines,
                    unknown_lines=excluded.unknown_lines,
                    non_lead_lines=excluded.non_lead_lines,
                    total_lines=excluded.total_lines,
                    reported_date=excluded.reported_date,
                    data_source=excluded.data_source,
                    notes=excluded.notes
                """,
                (
                    pwsid,
                    _to_int(r.get("lead_lines")),
                    _to_int(r.get("galvanized_lines")),
                    _to_int(r.get("unknown_lines")),
                    _to_int(r.get("non_lead_lines")),
                    _to_int(r.get("total_lines")),
                    r.get("reported_date"),
                    r.get("data_source") or "csv_upload",
                    r.get("notes"),
                ),
            )
            n += 1
    return n


def lsl_for_pwsid(pwsid: str) -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute(
            "SELECT * FROM lsl_inventory WHERE pwsid = ?", (pwsid,)
        ).fetchone()
    return dict(row) if row else None


def update_lead_risk_tier(pwsid: str, tier: str) -> None:
    with _lock, connect() as c:
        c.execute(
            "UPDATE water_systems SET lead_risk_tier = ? WHERE pwsid = ?",
            (tier, pwsid),
        )


def update_pfas_flag(pwsids: set[str]) -> None:
    if not pwsids:
        with _lock, connect() as c:
            c.execute("UPDATE water_systems SET pfas_detected = 0")
        return
    placeholders = ",".join("?" * len(pwsids))
    with _lock, connect() as c:
        c.execute("UPDATE water_systems SET pfas_detected = 0")
        c.execute(
            f"UPDATE water_systems SET pfas_detected = 1 "
            f"WHERE pwsid IN ({placeholders})",
            list(pwsids),
        )


# ---------- zip_demographics ----------


def upsert_demographics(rows: list[dict[str, Any]]) -> int:
    now = _now()
    n = 0
    with _lock, connect() as c:
        for r in rows:
            zip_code = r.get("zip_code")
            if not zip_code:
                continue
            c.execute(
                """
                INSERT INTO zip_demographics (
                    zip_code, population, households,
                    median_household_income, median_home_value,
                    owner_occupied_pct, pre_1980_housing_pct, last_synced_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(zip_code) DO UPDATE SET
                    population=excluded.population,
                    households=excluded.households,
                    median_household_income=excluded.median_household_income,
                    median_home_value=excluded.median_home_value,
                    owner_occupied_pct=excluded.owner_occupied_pct,
                    pre_1980_housing_pct=excluded.pre_1980_housing_pct,
                    last_synced_at=excluded.last_synced_at
                """,
                (
                    zip_code,
                    _to_int(r.get("population")),
                    _to_int(r.get("households")),
                    _to_int(r.get("median_household_income")),
                    _to_int(r.get("median_home_value")),
                    r.get("owner_occupied_pct"),
                    r.get("pre_1980_housing_pct"),
                    now,
                ),
            )
            n += 1
    return n


def demographics_for_zip(zip_code: str) -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute(
            "SELECT * FROM zip_demographics WHERE zip_code = ?", (zip_code,)
        ).fetchone()
    return dict(row) if row else None


def all_demographics() -> dict[str, dict[str, Any]]:
    with connect() as c:
        rows = c.execute("SELECT * FROM zip_demographics").fetchall()
    return {r["zip_code"]: dict(r) for r in rows}


# ---------- zip_centroids ----------


def get_centroid(zip_code: str) -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute(
            "SELECT * FROM zip_centroids WHERE zip_code = ?", (zip_code,)
        ).fetchone()
    return dict(row) if row else None


def put_centroid(
    zip_code: str,
    lat: float | None,
    lon: float | None,
    display_name: str | None = None,
    source: str = "nominatim",
) -> None:
    with _lock, connect() as c:
        existing = c.execute(
            "SELECT failed_attempts FROM zip_centroids WHERE zip_code = ?",
            (zip_code,),
        ).fetchone()
        prev_fail = existing["failed_attempts"] if existing else 0
        fail = prev_fail + 1 if lat is None or lon is None else 0
        c.execute(
            """
            INSERT INTO zip_centroids
                (zip_code, lat, lon, display_name, source, resolved_at, failed_attempts)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(zip_code) DO UPDATE SET
                lat=excluded.lat,
                lon=excluded.lon,
                display_name=COALESCE(excluded.display_name, zip_centroids.display_name),
                source=excluded.source,
                resolved_at=excluded.resolved_at,
                failed_attempts=excluded.failed_attempts
            """,
            (zip_code, lat, lon, display_name, source, _now(), fail),
        )


def centroids_for_zips(zips: list[str]) -> dict[str, dict[str, Any]]:
    if not zips:
        return {}
    placeholders = ",".join("?" * len(zips))
    with connect() as c:
        rows = c.execute(
            f"SELECT * FROM zip_centroids WHERE zip_code IN ({placeholders})",
            zips,
        ).fetchall()
    return {r["zip_code"]: dict(r) for r in rows}


# ---------- alerts ----------


def insert_alerts(alerts: list[dict[str, Any]]) -> int:
    n = 0
    now = _now()
    with _lock, connect() as c:
        for a in alerts:
            c.execute(
                """
                INSERT INTO sync_alerts
                    (alert_type, severity, pwsid, zip_code, title, details, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    a.get("alert_type", "info"),
                    a.get("severity", "info"),
                    a.get("pwsid"),
                    a.get("zip_code"),
                    a.get("title"),
                    json.dumps(a.get("details") or {}),
                    now,
                ),
            )
            n += 1
    return n


def list_alerts(unread_only: bool = False, limit: int = 100) -> list[dict[str, Any]]:
    sql = "SELECT * FROM sync_alerts"
    if unread_only:
        sql += " WHERE seen = 0"
    sql += " ORDER BY id DESC LIMIT ?"
    with connect() as c:
        rows = c.execute(sql, (limit,)).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        try:
            d["details"] = json.loads(d.get("details") or "{}")
        except json.JSONDecodeError:
            d["details"] = {}
        out.append(d)
    return out


def mark_alerts_read(ids: list[int] | None = None) -> int:
    with _lock, connect() as c:
        if ids:
            placeholders = ",".join("?" * len(ids))
            cur = c.execute(
                f"UPDATE sync_alerts SET seen = 1 WHERE id IN ({placeholders})",
                ids,
            )
        else:
            cur = c.execute("UPDATE sync_alerts SET seen = 1 WHERE seen = 0")
        return cur.rowcount


def snapshot_violation_ids() -> set[str]:
    with connect() as c:
        rows = c.execute("SELECT violation_id FROM violations").fetchall()
    return {r["violation_id"] for r in rows}


def snapshot_lcr_exceedance_keys() -> set[tuple[str, str]]:
    with connect() as c:
        rows = c.execute(
            "SELECT pwsid, sar_id FROM lcr_results WHERE exceeds_action = 1"
        ).fetchall()
    return {(r["pwsid"], r["sar_id"]) for r in rows}


def get_violations_by_ids(ids: list[str]) -> list[dict[str, Any]]:
    if not ids:
        return []
    placeholders = ",".join("?" * len(ids))
    with connect() as c:
        rows = c.execute(
            f"SELECT v.*, ws.name AS system_name FROM violations v "
            f"LEFT JOIN water_systems ws ON ws.pwsid = v.pwsid "
            f"WHERE v.violation_id IN ({placeholders})",
            ids,
        ).fetchall()
    return [dict(r) for r in rows]


def zip_codes_for_pwsids(pwsids: list[str]) -> dict[str, list[str]]:
    if not pwsids:
        return {}
    placeholders = ",".join("?" * len(pwsids))
    with connect() as c:
        rows = c.execute(
            f"SELECT pwsid, zip_code FROM service_areas "
            f"WHERE pwsid IN ({placeholders}) AND zip_code IS NOT NULL",
            pwsids,
        ).fetchall()
    out: dict[str, list[str]] = {}
    for r in rows:
        out.setdefault(r["pwsid"], []).append(r["zip_code"])
    return out
