"""SQLite persistence for the lead generator.

Single-file, zero-config storage. Uses raw sqlite3 for minimal dependencies.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterable

DB_PATH = os.getenv("DATABASE_PATH", "leads.db")

VALID_STATUSES = ("new", "contacted", "qualified", "closed", "dead")

_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as c:
        c.executescript(
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
                types              TEXT,            -- JSON list
                services           TEXT,            -- JSON list (from website)
                emails             TEXT,            -- JSON list
                socials            TEXT,            -- JSON dict (fb/ig/etc)
                lat                REAL,
                lng                REAL,
                no_website         INTEGER DEFAULT 0,
                status             TEXT DEFAULT 'new',
                notes              TEXT DEFAULT '',
                created_at         TEXT NOT NULL,
                updated_at         TEXT NOT NULL,
                last_enriched_at   TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads(status);
            CREATE INDEX IF NOT EXISTS idx_leads_no_website ON leads(no_website);
            CREATE INDEX IF NOT EXISTS idx_leads_rating     ON leads(rating);
            """
        )


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    for jf in ("types", "services", "emails"):
        d[jf] = json.loads(d[jf]) if d.get(jf) else []
    d["socials"] = json.loads(d["socials"]) if d.get("socials") else {}
    d["no_website"] = bool(d.get("no_website"))
    return d


def upsert_leads(leads: Iterable[dict[str, Any]]) -> dict[str, int]:
    """Insert leads, skipping ones already in DB. Returns counts."""
    inserted = 0
    skipped = 0
    with _lock, connect() as c:
        for lead in leads:
            place_id = lead.get("place_id")
            if not place_id:
                continue
            existing = c.execute(
                "SELECT 1 FROM leads WHERE place_id = ?", (place_id,)
            ).fetchone()
            if existing:
                skipped += 1
                continue

            now = _now()
            c.execute(
                """
                INSERT INTO leads (
                    place_id, name, address, phone, website, rating, reviews,
                    google_url, business_status, types, services, emails, socials,
                    lat, lng, no_website, status, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    place_id,
                    lead.get("name", ""),
                    lead.get("address", ""),
                    lead.get("phone", ""),
                    lead.get("website", ""),
                    lead.get("rating") or 0,
                    lead.get("reviews") or 0,
                    lead.get("google_url", ""),
                    lead.get("business_status", "OPERATIONAL"),
                    json.dumps(lead.get("types") or []),
                    json.dumps(lead.get("services") or []),
                    json.dumps(lead.get("emails") or []),
                    json.dumps(lead.get("socials") or {}),
                    lead.get("lat"),
                    lead.get("lng"),
                    1 if not lead.get("website") else 0,
                    "new",
                    "",
                    now,
                    now,
                ),
            )
            inserted += 1
    return {"inserted": inserted, "skipped_duplicates": skipped}


def list_leads(
    status: str | None = None,
    no_website_only: bool = False,
    search: str | None = None,
    sort: str = "created_desc",
) -> list[dict[str, Any]]:
    where: list[str] = []
    params: list[Any] = []

    if status and status in VALID_STATUSES:
        where.append("status = ?")
        params.append(status)

    if no_website_only:
        where.append("no_website = 1")

    if search:
        where.append("(LOWER(name) LIKE ? OR LOWER(address) LIKE ?)")
        like = f"%{search.lower()}%"
        params.extend([like, like])

    sort_sql = {
        "created_desc":  "created_at DESC",
        "rating_desc":   "rating DESC, reviews DESC",
        "reviews_desc":  "reviews DESC",
        "name_asc":      "name COLLATE NOCASE ASC",
    }.get(sort, "created_at DESC")

    sql = "SELECT * FROM leads"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += f" ORDER BY {sort_sql}"

    with connect() as c:
        rows = c.execute(sql, params).fetchall()
        return [_row_to_dict(r) for r in rows]


def get_lead(place_id: str) -> dict[str, Any] | None:
    with connect() as c:
        row = c.execute(
            "SELECT * FROM leads WHERE place_id = ?", (place_id,)
        ).fetchone()
        return _row_to_dict(row) if row else None


def update_lead(place_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    """Update mutable fields. Allowed: status, notes, plus enrichment fields."""
    allowed = {
        "status", "notes", "phone", "website",
        "emails", "socials", "services", "last_enriched_at",
    }
    sets: list[str] = []
    params: list[Any] = []

    for k, v in fields.items():
        if k not in allowed:
            continue
        if k == "status" and v not in VALID_STATUSES:
            continue
        if k in ("emails", "services"):
            v = json.dumps(v or [])
        elif k == "socials":
            v = json.dumps(v or {})
        sets.append(f"{k} = ?")
        params.append(v)

    if not sets:
        return get_lead(place_id)

    sets.append("updated_at = ?")
    params.append(_now())
    params.append(place_id)

    if fields.get("website") is not None:
        sets.append("no_website = ?")
        params.insert(-1, 0 if fields["website"] else 1)

    with _lock, connect() as c:
        c.execute(
            f"UPDATE leads SET {', '.join(sets)} WHERE place_id = ?", params
        )
    return get_lead(place_id)


def delete_lead(place_id: str) -> bool:
    with _lock, connect() as c:
        cur = c.execute("DELETE FROM leads WHERE place_id = ?", (place_id,))
        return cur.rowcount > 0


def stats() -> dict[str, Any]:
    with connect() as c:
        total = c.execute("SELECT COUNT(*) AS n FROM leads").fetchone()["n"]
        no_site = c.execute(
            "SELECT COUNT(*) AS n FROM leads WHERE no_website = 1"
        ).fetchone()["n"]
        by_status = {
            r["status"]: r["n"]
            for r in c.execute(
                "SELECT status, COUNT(*) AS n FROM leads GROUP BY status"
            ).fetchall()
        }
    return {
        "total": total,
        "no_website": no_site,
        "by_status": {s: by_status.get(s, 0) for s in VALID_STATUSES},
    }
