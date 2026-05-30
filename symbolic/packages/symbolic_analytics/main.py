"""Event-log microservice.

Records search impressions and clicks. Exposes aggregations used by the
console and the LTR training script.

Run: uvicorn symbolic_analytics.main:app --port 8002
"""
from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

DATA_DIR = Path(os.getenv("SYMBOLIC_DATA_DIR", "./data")).resolve()
DB_PATH = DATA_DIR / "events.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS impressions (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      REAL NOT NULL,
    query   TEXT NOT NULL,
    doc_ids TEXT NOT NULL    -- JSON array
);
CREATE INDEX IF NOT EXISTS idx_imp_query ON impressions(query);

CREATE TABLE IF NOT EXISTS clicks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         REAL NOT NULL,
    query      TEXT NOT NULL,
    doc_id     INTEGER NOT NULL,
    position   INTEGER NOT NULL,
    session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_clk_query ON clicks(query);
"""


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(DB_PATH))
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    return c


app = FastAPI(title="SYMBOLIC Analytics", version="0.1.0")


class ImpressionEvent(BaseModel):
    query: str
    doc_ids: list[int]


class ClickEvent(BaseModel):
    query: str
    doc_id: int
    position: int
    session_id: str | None = None


@app.post("/event/impression")
def log_impression(e: ImpressionEvent) -> dict:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO impressions (ts, query, doc_ids) VALUES (?, ?, ?)",
            (time.time(), e.query, json.dumps(e.doc_ids)),
        )
        conn.commit()
    return {"ok": True}


@app.post("/event/click")
def log_click(e: ClickEvent) -> dict:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO clicks (ts, query, doc_id, position, session_id) VALUES (?, ?, ?, ?, ?)",
            (time.time(), e.query, e.doc_id, e.position, e.session_id),
        )
        conn.commit()
    return {"ok": True}


@app.get("/top/queries")
def top_queries(limit: int = 20) -> dict:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT query, COUNT(*) AS c FROM impressions GROUP BY query ORDER BY c DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return {"queries": [{"query": r["query"], "impressions": r["c"]} for r in rows]}


@app.get("/top/clicked")
def top_clicked(limit: int = 20) -> dict:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT doc_id, COUNT(*) AS c FROM clicks GROUP BY doc_id ORDER BY c DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return {"docs": [{"doc_id": r["doc_id"], "clicks": r["c"]} for r in rows]}


@app.get("/training/pairs")
def training_pairs(min_impressions: int = 1) -> dict:
    """Yield rows joining each impression with which of its docs were clicked.

    Used by scripts/train_ltr.py to assemble (query, doc, label) tuples.
    """
    pairs = []
    with _conn() as conn:
        imps = conn.execute("SELECT * FROM impressions ORDER BY id").fetchall()
        # Build a (query, doc_id) -> click_count lookup
        click_counts: dict[tuple[str, int], int] = {}
        for r in conn.execute("SELECT query, doc_id, COUNT(*) AS c FROM clicks GROUP BY query, doc_id"):
            click_counts[(r["query"], int(r["doc_id"]))] = int(r["c"])
        for imp in imps:
            try:
                ids = json.loads(imp["doc_ids"])
            except Exception:
                continue
            if not ids:
                continue
            group = []
            for d in ids:
                clicks = click_counts.get((imp["query"], int(d)), 0)
                label = 2 if clicks >= 2 else (1 if clicks == 1 else 0)
                group.append({"doc_id": int(d), "label": label})
            if any(g["label"] > 0 for g in group):
                pairs.append({"query": imp["query"], "ts": imp["ts"], "docs": group})
    return {"pairs": pairs}


@app.get("/health")
def health() -> dict:
    with _conn() as conn:
        i = conn.execute("SELECT COUNT(*) FROM impressions").fetchone()[0]
        c = conn.execute("SELECT COUNT(*) FROM clicks").fetchone()[0]
    return {"status": "ok", "impressions": int(i), "clicks": int(c), "db": str(DB_PATH)}
