"""Tiny sponsored-results microservice.

Storage: SQLite. Targeting: keyword overlap with bid-weighted scoring.
Run:  uvicorn symbolic_ads.main:app --port 8001
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from symbolic_core.text import tokenize

DATA_DIR = Path(os.getenv("SYMBOLIC_DATA_DIR", "./data")).resolve()
DB_PATH = DATA_DIR / "ads.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS campaigns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    advertiser  TEXT NOT NULL,
    title       TEXT NOT NULL,
    url         TEXT NOT NULL,
    description TEXT NOT NULL,
    keywords    TEXT NOT NULL,        -- space-separated tokens
    bid_cents   INTEGER NOT NULL DEFAULT 100,
    active      INTEGER NOT NULL DEFAULT 1
);
"""


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(DB_PATH))
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    return c


app = FastAPI(title="SYMBOLIC Ads", version="0.1.0")


class Campaign(BaseModel):
    advertiser: str
    title: str
    url: str
    description: str
    keywords: str = Field(..., description="Space-separated targeting keywords")
    bid_cents: int = 100


@app.post("/campaign")
def create_campaign(c: Campaign) -> dict:
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO campaigns (advertiser,title,url,description,keywords,bid_cents,active) VALUES (?,?,?,?,?,?,1)",
            (c.advertiser, c.title, c.url, c.description, c.keywords.lower(), c.bid_cents),
        )
        conn.commit()
        return {"id": cur.lastrowid}


@app.get("/campaigns")
def list_campaigns() -> dict:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM campaigns ORDER BY id DESC").fetchall()
        return {"campaigns": [dict(r) for r in rows]}


@app.delete("/campaign/{cid}")
def delete_campaign(cid: int) -> dict:
    with _conn() as conn:
        conn.execute("DELETE FROM campaigns WHERE id=?", (cid,))
        conn.commit()
    return {"ok": True}


@app.get("/ads")
def get_ads(q: str, max_n: int = 2) -> dict:
    """Return up to `max_n` ads scored by keyword-overlap × bid."""
    if not q.strip():
        return {"ads": []}
    q_tokens = set(tokenize(q))
    if not q_tokens:
        return {"ads": []}
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM campaigns WHERE active=1").fetchall()
    scored = []
    for r in rows:
        kw = set(tokenize(r["keywords"]))
        if not kw:
            continue
        overlap = len(q_tokens & kw) / len(kw)
        if overlap == 0:
            continue
        score = overlap * (r["bid_cents"] / 100.0)
        scored.append((score, r))
    scored.sort(key=lambda x: x[0], reverse=True)
    ads = []
    for score, r in scored[:max_n]:
        ads.append(
            {
                "id": r["id"],
                "advertiser": r["advertiser"],
                "title": r["title"],
                "url": r["url"],
                "description": r["description"],
                "score": round(score, 4),
            }
        )
    return {"ads": ads}


@app.get("/health")
def health() -> dict:
    with _conn() as conn:
        n = conn.execute("SELECT COUNT(*) FROM campaigns").fetchone()[0]
    return {"status": "ok", "campaigns": int(n), "db": str(DB_PATH)}
