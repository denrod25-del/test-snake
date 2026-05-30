"""Okapi BM25 ranking."""
from __future__ import annotations

import math

from ..indexer import CorpusIndex
from .base import RankingAlgorithm, Result


class BM25(RankingAlgorithm):
    name = "bm25"
    description = "Okapi BM25. k1 controls term-frequency saturation; b controls length normalization."

    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b

    def _idf(self, term: str, index: CorpusIndex) -> float:
        df = index.df.get(term, 0)
        if df == 0 or index.n_docs == 0:
            return 0.0
        return math.log(1.0 + (index.n_docs - df + 0.5) / (df + 0.5))

    def score(self, query: str, index: CorpusIndex) -> list[Result]:
        q_terms = self.query_terms(query)
        if not q_terms or index.n_docs == 0:
            return []

        scores: dict[int, float] = {}
        contribs: dict[int, dict[str, float]] = {}
        avgdl = index.avgdl or 1.0

        seen = set()
        for term in q_terms:
            if term in seen:
                continue
            seen.add(term)
            idf = self._idf(term, index)
            if idf <= 0:
                continue
            for p in index.postings.get(term, []):
                dl = index.doc_len.get(p.doc_id, 0) or 1
                tf = p.tf
                norm = 1.0 - self.b + self.b * (dl / avgdl)
                contribution = idf * (tf * (self.k1 + 1.0)) / (tf + self.k1 * norm)
                scores[p.doc_id] = scores.get(p.doc_id, 0.0) + contribution
                contribs.setdefault(p.doc_id, {})[term] = round(contribution, 4)

        return [
            Result(
                doc_id=doc_id,
                score=score,
                explanation={
                    "model": "bm25",
                    "k1": self.k1,
                    "b": self.b,
                    "term_contributions": contribs.get(doc_id, {}),
                },
            )
            for doc_id, score in scores.items()
        ]
