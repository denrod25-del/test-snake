"""FAISS-backed vector index keyed by doc_id.

Uses IndexFlatIP over L2-normalized vectors (so inner product == cosine sim),
wrapped in IndexIDMap2 so we can address by doc_id directly.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np


class VectorIndex:
    def __init__(self, dim: int, path: str | Path | None = None) -> None:
        import faiss

        self.dim = dim
        self.path = Path(path) if path else None
        self._faiss = faiss
        if self.path and self.path.exists():
            self._index = faiss.read_index(str(self.path))
        else:
            base = faiss.IndexFlatIP(dim)
            self._index = faiss.IndexIDMap2(base)

    def add(self, doc_id: int, vec: np.ndarray) -> None:
        if vec.ndim == 1:
            vec = vec.reshape(1, -1)
        ids = np.asarray([doc_id], dtype=np.int64)
        # Replace if id exists, then add.
        try:
            self._index.remove_ids(self._faiss.IDSelectorArray(ids))
        except Exception:
            pass
        self._index.add_with_ids(vec.astype(np.float32, copy=False), ids)

    def add_batch(self, doc_ids: list[int], vecs: np.ndarray) -> None:
        if not doc_ids:
            return
        ids = np.asarray(doc_ids, dtype=np.int64)
        try:
            self._index.remove_ids(self._faiss.IDSelectorArray(ids))
        except Exception:
            pass
        self._index.add_with_ids(vecs.astype(np.float32, copy=False), ids)

    def search(self, vec: np.ndarray, top_k: int = 50) -> list[tuple[int, float]]:
        if self._index.ntotal == 0:
            return []
        if vec.ndim == 1:
            vec = vec.reshape(1, -1)
        vec = vec.astype(np.float32, copy=False)
        scores, ids = self._index.search(vec, top_k)
        out: list[tuple[int, float]] = []
        for i, s in zip(ids[0], scores[0]):
            if i < 0:
                continue
            out.append((int(i), float(s)))
        return out

    def get(self, doc_id: int) -> np.ndarray | None:
        try:
            v = self._index.reconstruct(int(doc_id))
            return np.asarray(v, dtype=np.float32)
        except Exception:
            return None

    def size(self) -> int:
        return int(self._index.ntotal)

    def save(self, path: str | Path | None = None) -> None:
        out = Path(path) if path else self.path
        if out is None:
            raise ValueError("no path given")
        out.parent.mkdir(parents=True, exist_ok=True)
        self._faiss.write_index(self._index, str(out))
