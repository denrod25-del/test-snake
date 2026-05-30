"""SQLite-backed storage for documents, the link graph, and judged relevance.

Schema is intentionally simple. Indexes are kept on disk in a separate JSON
blob (see indexer.py) since SQLite full-text isn't the focus of this lab.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .config import DEFAULT_DB_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS corpus (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT UNIQUE NOT NULL,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

CREATE TABLE IF NOT EXISTS document (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    corpus_id   INTEGER NOT NULL REFERENCES corpus(id) ON DELETE CASCADE,
    url         TEXT,
    title       TEXT,
    body        TEXT NOT NULL,
    UNIQUE (corpus_id, url)
);
CREATE INDEX IF NOT EXISTS idx_document_corpus ON document(corpus_id);

CREATE TABLE IF NOT EXISTS link (
    corpus_id   INTEGER NOT NULL REFERENCES corpus(id) ON DELETE CASCADE,
    src_id      INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    dst_id      INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    PRIMARY KEY (corpus_id, src_id, dst_id)
);
CREATE INDEX IF NOT EXISTS idx_link_corpus ON link(corpus_id);

CREATE TABLE IF NOT EXISTS judgment (
    corpus_id   INTEGER NOT NULL REFERENCES corpus(id) ON DELETE CASCADE,
    query       TEXT NOT NULL,
    doc_id      INTEGER NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    relevance   INTEGER NOT NULL,
    PRIMARY KEY (corpus_id, query, doc_id)
);

CREATE TABLE IF NOT EXISTS experiment (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    corpus_id   INTEGER NOT NULL REFERENCES corpus(id) ON DELETE CASCADE,
    algo_a      TEXT NOT NULL,
    algo_b      TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


class Storage:
    def __init__(self, db_path: Path | str = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)
        self._init()

    def _init(self) -> None:
        with self.connect() as cx:
            cx.executescript(SCHEMA)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        cx = sqlite3.connect(self.db_path)
        cx.row_factory = sqlite3.Row
        cx.execute("PRAGMA foreign_keys = ON")
        try:
            yield cx
            cx.commit()
        finally:
            cx.close()

    # ---- corpus ---------------------------------------------------------
    def create_corpus(self, name: str, description: str = "") -> int:
        with self.connect() as cx:
            cur = cx.execute(
                "INSERT INTO corpus(name, description) VALUES(?, ?)",
                (name, description),
            )
            return int(cur.lastrowid)

    def get_or_create_corpus(self, name: str, description: str = "") -> int:
        with self.connect() as cx:
            row = cx.execute("SELECT id FROM corpus WHERE name=?", (name,)).fetchone()
            if row:
                return int(row["id"])
        return self.create_corpus(name, description)

    def list_corpora(self) -> list[dict]:
        with self.connect() as cx:
            rows = cx.execute(
                """SELECT c.id, c.name, c.description, c.created_at,
                          (SELECT COUNT(*) FROM document d WHERE d.corpus_id=c.id) AS docs,
                          (SELECT COUNT(*) FROM link l WHERE l.corpus_id=c.id) AS links
                   FROM corpus c ORDER BY c.id DESC"""
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_corpus(self, corpus_id: int) -> None:
        with self.connect() as cx:
            cx.execute("DELETE FROM corpus WHERE id=?", (corpus_id,))

    # ---- documents ------------------------------------------------------
    def add_document(
        self,
        corpus_id: int,
        body: str,
        *,
        url: str | None = None,
        title: str | None = None,
    ) -> int:
        with self.connect() as cx:
            cur = cx.execute(
                "INSERT OR IGNORE INTO document(corpus_id, url, title, body) VALUES(?,?,?,?)",
                (corpus_id, url, title, body),
            )
            if cur.lastrowid:
                return int(cur.lastrowid)
            row = cx.execute(
                "SELECT id FROM document WHERE corpus_id=? AND url=?",
                (corpus_id, url),
            ).fetchone()
            return int(row["id"])

    def list_documents(self, corpus_id: int) -> list[dict]:
        with self.connect() as cx:
            rows = cx.execute(
                "SELECT id, url, title, body FROM document WHERE corpus_id=? ORDER BY id",
                (corpus_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_document(self, doc_id: int) -> dict | None:
        with self.connect() as cx:
            row = cx.execute(
                "SELECT id, corpus_id, url, title, body FROM document WHERE id=?",
                (doc_id,),
            ).fetchone()
        return dict(row) if row else None

    # ---- links ----------------------------------------------------------
    def add_link(self, corpus_id: int, src_id: int, dst_id: int) -> None:
        if src_id == dst_id:
            return
        with self.connect() as cx:
            cx.execute(
                "INSERT OR IGNORE INTO link(corpus_id, src_id, dst_id) VALUES(?,?,?)",
                (corpus_id, src_id, dst_id),
            )

    def list_links(self, corpus_id: int) -> list[tuple[int, int]]:
        with self.connect() as cx:
            rows = cx.execute(
                "SELECT src_id, dst_id FROM link WHERE corpus_id=?", (corpus_id,)
            ).fetchall()
        return [(int(r["src_id"]), int(r["dst_id"])) for r in rows]

    # ---- judgments ------------------------------------------------------
    def add_judgment(self, corpus_id: int, query: str, doc_id: int, relevance: int) -> None:
        with self.connect() as cx:
            cx.execute(
                """INSERT INTO judgment(corpus_id, query, doc_id, relevance)
                   VALUES(?,?,?,?)
                   ON CONFLICT(corpus_id, query, doc_id) DO UPDATE SET relevance=excluded.relevance""",
                (corpus_id, query.lower().strip(), doc_id, relevance),
            )

    def get_judgments(self, corpus_id: int, query: str) -> dict[int, int]:
        with self.connect() as cx:
            rows = cx.execute(
                "SELECT doc_id, relevance FROM judgment WHERE corpus_id=? AND query=?",
                (corpus_id, query.lower().strip()),
            ).fetchall()
        return {int(r["doc_id"]): int(r["relevance"]) for r in rows}

    def list_judged_queries(self, corpus_id: int) -> list[str]:
        with self.connect() as cx:
            rows = cx.execute(
                "SELECT DISTINCT query FROM judgment WHERE corpus_id=? ORDER BY query",
                (corpus_id,),
            ).fetchall()
        return [r["query"] for r in rows]

    # ---- experiments ----------------------------------------------------
    def save_experiment(
        self,
        name: str,
        corpus_id: int,
        algo_a: str,
        algo_b: str,
        payload: dict,
    ) -> int:
        with self.connect() as cx:
            cur = cx.execute(
                """INSERT INTO experiment(name, corpus_id, algo_a, algo_b, payload)
                   VALUES(?,?,?,?,?)""",
                (name, corpus_id, algo_a, algo_b, json.dumps(payload)),
            )
            return int(cur.lastrowid)

    def list_experiments(self) -> list[dict]:
        with self.connect() as cx:
            rows = cx.execute(
                """SELECT id, name, corpus_id, algo_a, algo_b, created_at
                   FROM experiment ORDER BY id DESC LIMIT 100"""
            ).fetchall()
        return [dict(r) for r in rows]

    def get_experiment(self, exp_id: int) -> dict | None:
        with self.connect() as cx:
            row = cx.execute(
                "SELECT * FROM experiment WHERE id=?", (exp_id,)
            ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["payload"] = json.loads(d["payload"])
        return d
