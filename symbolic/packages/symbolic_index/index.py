"""Unified facade over the doc store, BM25 index, and vector index."""
from __future__ import annotations

import os
from pathlib import Path

from symbolic_core import BM25, Embedder

from .store import DocumentStore
from .vector_index import VectorIndex


def _data_dir() -> Path:
    return Path(os.getenv("SYMBOLIC_DATA_DIR", "./data")).resolve()


class Index:
    """Bundles the three index components and handles cross-coordinated writes."""

    def __init__(self, data_dir: str | Path | None = None) -> None:
        self.data_dir = Path(data_dir) if data_dir else _data_dir()
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.store = DocumentStore(self.data_dir / "symbolic.db")
        self.embedder = Embedder()

        bm25_path = self.data_dir / "bm25.pkl"
        if bm25_path.exists():
            self.bm25 = BM25.load(bm25_path)
        else:
            self.bm25 = BM25()

        self.vec_index = VectorIndex(self.embedder.dim, self.data_dir / "vectors.faiss")

    def add_document(
        self, url: str, title: str, text: str, host: str, inlinks: int = 0
    ) -> int:
        doc_id = self.store.upsert_document(url, title, text, host, inlinks)
        # Refresh BM25
        self.bm25.remove(doc_id)
        # We want title boost in BM25 — duplicate the title once into the indexed text.
        self.bm25.add(doc_id, f"{title} {title} {text}")
        # Embed title + first 1500 chars of body (typical web search practice).
        body_for_embed = (title + ". " + text)[:1500]
        vec = self.embedder.encode(body_for_embed)
        self.vec_index.add(doc_id, vec)
        return doc_id

    def add_documents(self, docs: list[dict]) -> list[int]:
        """Bulk add. Each dict needs url/title/text/host (+ optional inlinks)."""
        ids: list[int] = []
        embed_texts: list[str] = []
        for d in docs:
            doc_id = self.store.upsert_document(
                d["url"], d.get("title", ""), d.get("text", ""), d.get("host", ""),
                int(d.get("inlinks", 0)),
            )
            ids.append(doc_id)
            self.bm25.remove(doc_id)
            self.bm25.add(doc_id, f"{d.get('title','')} {d.get('title','')} {d.get('text','')}")
            embed_texts.append((d.get("title", "") + ". " + d.get("text", ""))[:1500])
        vecs = self.embedder.encode(embed_texts)
        self.vec_index.add_batch(ids, vecs)
        return ids

    def persist(self) -> None:
        self.bm25.save(self.data_dir / "bm25.pkl")
        self.vec_index.save()

    # --- ranker hooks ---

    def search_vectors(self, q_vec, top_k: int):
        return self.vec_index.search(q_vec, top_k)

    def fetch_doc(self, doc_id: int):
        return self.store.get_document(doc_id)

    def fetch_doc_vec(self, doc_id: int):
        return self.vec_index.get(doc_id)

    def health(self) -> dict:
        return {
            "documents": self.store.count_documents(),
            "vectors": self.vec_index.size(),
            "bm25_docs": self.bm25.n_docs(),
            "frontier": self.store.frontier_stats(),
            "embedding_dim": self.embedder.dim,
            "embedding_model": self.embedder.model_name,
            "data_dir": str(self.data_dir),
        }
