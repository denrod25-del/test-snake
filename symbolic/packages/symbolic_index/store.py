"""SQLite-backed document store and crawl state."""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Iterator

from symbolic_core.types import Document


SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    doc_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT UNIQUE NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL DEFAULT '',
    host        TEXT NOT NULL DEFAULT '',
    crawled_at  REAL NOT NULL DEFAULT 0,
    inlinks     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_documents_host ON documents(host);

CREATE TABLE IF NOT EXISTS frontier (
    url       TEXT PRIMARY KEY,
    host      TEXT NOT NULL,
    depth     INTEGER NOT NULL DEFAULT 0,
    status    TEXT NOT NULL DEFAULT 'pending',  -- pending|done|failed
    added_at  REAL NOT NULL,
    fetched_at REAL
);
CREATE INDEX IF NOT EXISTS idx_frontier_status ON frontier(status);
CREATE INDEX IF NOT EXISTS idx_frontier_host ON frontier(host);

CREATE TABLE IF NOT EXISTS edges (
    src TEXT NOT NULL,
    dst TEXT NOT NULL,
    PRIMARY KEY (src, dst)
);
"""


class DocumentStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    # ---------- Documents ----------

    def upsert_document(
        self,
        url: str,
        title: str,
        text: str,
        host: str,
        inlinks: int = 0,
    ) -> int:
        """Insert or update by url; returns the doc_id."""
        now = time.time()
        cur = self._conn.execute(
            """
            INSERT INTO documents (url, title, text, host, crawled_at, inlinks)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
                title=excluded.title,
                text=excluded.text,
                host=excluded.host,
                crawled_at=excluded.crawled_at,
                inlinks=excluded.inlinks
            RETURNING doc_id
            """,
            (url, title, text, host, now, inlinks),
        )
        row = cur.fetchone()
        self._conn.commit()
        return int(row[0])

    def get_document(self, doc_id: int) -> Document | None:
        row = self._conn.execute(
            "SELECT * FROM documents WHERE doc_id=?", (doc_id,)
        ).fetchone()
        return _row_to_doc(row) if row else None

    def get_document_by_url(self, url: str) -> Document | None:
        row = self._conn.execute(
            "SELECT * FROM documents WHERE url=?", (url,)
        ).fetchone()
        return _row_to_doc(row) if row else None

    def iter_documents(self) -> Iterator[Document]:
        for row in self._conn.execute("SELECT * FROM documents ORDER BY doc_id"):
            yield _row_to_doc(row)

    def count_documents(self) -> int:
        return int(self._conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0])

    # ---------- Frontier ----------

    def enqueue(self, url: str, host: str, depth: int = 0) -> bool:
        """Add a URL to the frontier if not already present. Returns True if newly added."""
        try:
            self._conn.execute(
                "INSERT INTO frontier (url, host, depth, status, added_at) VALUES (?, ?, ?, 'pending', ?)",
                (url, host, depth, time.time()),
            )
            self._conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def next_pending(self, batch: int = 32) -> list[tuple[str, str, int]]:
        rows = self._conn.execute(
            "SELECT url, host, depth FROM frontier WHERE status='pending' ORDER BY added_at LIMIT ?",
            (batch,),
        ).fetchall()
        return [(r["url"], r["host"], r["depth"]) for r in rows]

    def mark_fetched(self, url: str, ok: bool) -> None:
        self._conn.execute(
            "UPDATE frontier SET status=?, fetched_at=? WHERE url=?",
            ("done" if ok else "failed", time.time(), url),
        )
        self._conn.commit()

    def frontier_stats(self) -> dict[str, int]:
        rows = self._conn.execute(
            "SELECT status, COUNT(*) AS c FROM frontier GROUP BY status"
        ).fetchall()
        return {r["status"]: int(r["c"]) for r in rows}

    # ---------- Edges (in-link graph) ----------

    def add_edge(self, src: str, dst: str) -> None:
        try:
            self._conn.execute(
                "INSERT INTO edges (src, dst) VALUES (?, ?)", (src, dst)
            )
            self._conn.commit()
        except sqlite3.IntegrityError:
            pass

    def inlink_count(self, url: str) -> int:
        row = self._conn.execute(
            "SELECT COUNT(*) FROM edges WHERE dst=?", (url,)
        ).fetchone()
        return int(row[0])

    def close(self) -> None:
        self._conn.close()


def _row_to_doc(row: sqlite3.Row) -> Document:
    return Document(
        doc_id=int(row["doc_id"]),
        url=row["url"],
        title=row["title"],
        text=row["text"],
        host=row["host"],
        crawled_at=float(row["crawled_at"]),
        inlinks=int(row["inlinks"]),
    )
