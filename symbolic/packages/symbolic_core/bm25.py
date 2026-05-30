"""BM25 scoring over an in-memory inverted index.

Self-contained Okapi BM25 — no external IR library needed. Persisted as a
plain pickle alongside the SQLite store.
"""
from __future__ import annotations

import math
import pickle
from collections import Counter, defaultdict
from pathlib import Path

from .text import tokenize


class BM25:
    """Okapi BM25 with k1=1.5, b=0.75."""

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self._postings: dict[str, dict[int, int]] = defaultdict(dict)
        self._doc_len: dict[int, int] = {}
        self._avg_doc_len: float = 0.0
        self._n_docs: int = 0

    def add(self, doc_id: int, text: str) -> None:
        toks = tokenize(text)
        if not toks:
            self._doc_len[doc_id] = 0
        else:
            self._doc_len[doc_id] = len(toks)
            for term, tf in Counter(toks).items():
                self._postings[term][doc_id] = tf
        self._recompute_avg()

    def remove(self, doc_id: int) -> None:
        if doc_id not in self._doc_len:
            return
        del self._doc_len[doc_id]
        for term, posting in list(self._postings.items()):
            posting.pop(doc_id, None)
            if not posting:
                del self._postings[term]
        self._recompute_avg()

    def _recompute_avg(self) -> None:
        self._n_docs = len(self._doc_len)
        self._avg_doc_len = (
            sum(self._doc_len.values()) / self._n_docs if self._n_docs else 0.0
        )

    def _idf(self, term: str) -> float:
        df = len(self._postings.get(term, {}))
        if df == 0:
            return 0.0
        # Robertson-Spärck Jones IDF (positive variant)
        return math.log(1.0 + (self._n_docs - df + 0.5) / (df + 0.5))

    def score(self, query: str, doc_id: int) -> float:
        if doc_id not in self._doc_len:
            return 0.0
        terms = tokenize(query)
        if not terms:
            return 0.0
        dl = self._doc_len[doc_id]
        if dl == 0 or self._avg_doc_len == 0:
            return 0.0
        s = 0.0
        for term in terms:
            posting = self._postings.get(term)
            if not posting or doc_id not in posting:
                continue
            tf = posting[doc_id]
            idf = self._idf(term)
            denom = tf + self.k1 * (1 - self.b + self.b * dl / self._avg_doc_len)
            s += idf * (tf * (self.k1 + 1)) / denom if denom else 0.0
        return s

    def search(self, query: str, top_k: int = 50) -> list[tuple[int, float]]:
        terms = tokenize(query)
        if not terms or self._n_docs == 0:
            return []
        # Gather candidate docs from union of postings
        candidates: set[int] = set()
        for t in terms:
            posting = self._postings.get(t)
            if posting:
                candidates.update(posting.keys())
        scored = [(d, self.score(query, d)) for d in candidates]
        scored = [x for x in scored if x[1] > 0]
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def n_docs(self) -> int:
        return self._n_docs

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(
                {
                    "k1": self.k1,
                    "b": self.b,
                    "postings": dict(self._postings),
                    "doc_len": self._doc_len,
                },
                f,
            )

    @classmethod
    def load(cls, path: str | Path) -> "BM25":
        path = Path(path)
        with open(path, "rb") as f:
            blob = pickle.load(f)
        bm = cls(k1=blob["k1"], b=blob["b"])
        bm._postings = defaultdict(dict, {k: dict(v) for k, v in blob["postings"].items()})
        bm._doc_len = dict(blob["doc_len"])
        bm._recompute_avg()
        return bm
