"""Classic TF-IDF with cosine similarity over the bag-of-words space."""
from __future__ import annotations

import math
from collections import Counter

from ..indexer import CorpusIndex
from .base import RankingAlgorithm, Result


class TFIDF(RankingAlgorithm):
    name = "tfidf"
    description = "TF-IDF with sublinear TF and cosine similarity."

    def __init__(self, sublinear_tf: bool = True) -> None:
        self.sublinear_tf = sublinear_tf

    def _idf(self, term: str, index: CorpusIndex) -> float:
        df = index.df.get(term, 0)
        if df == 0 or index.n_docs == 0:
            return 0.0
        return math.log((1 + index.n_docs) / (1 + df)) + 1.0

    def _weight(self, tf: int) -> float:
        if tf <= 0:
            return 0.0
        return (1.0 + math.log(tf)) if self.sublinear_tf else float(tf)

    def score(self, query: str, index: CorpusIndex) -> list[Result]:
        q_terms = self.query_terms(query)
        if not q_terms or index.n_docs == 0:
            return []

        q_counts = Counter(q_terms)
        q_weights = {t: self._weight(c) * self._idf(t, index) for t, c in q_counts.items()}
        q_norm = math.sqrt(sum(w * w for w in q_weights.values())) or 1.0

        scores: dict[int, float] = {}
        contribs: dict[int, dict[str, float]] = {}

        for term, qw in q_weights.items():
            if qw == 0.0:
                continue
            for p in index.postings.get(term, []):
                dw = self._weight(p.tf) * self._idf(term, index)
                scores[p.doc_id] = scores.get(p.doc_id, 0.0) + qw * dw
                contribs.setdefault(p.doc_id, {})[term] = round(qw * dw, 4)

        results: list[Result] = []
        for doc_id, raw in scores.items():
            d_norm = math.sqrt(
                sum(
                    (self._weight(c) * self._idf(t, index)) ** 2
                    for t, c in index.doc_term_freq(doc_id).items()
                )
            ) or 1.0
            cosine = raw / (q_norm * d_norm)
            results.append(
                Result(
                    doc_id=doc_id,
                    score=cosine,
                    explanation={
                        "model": "tf-idf cosine",
                        "term_contributions": contribs.get(doc_id, {}),
                        "doc_norm": round(d_norm, 4),
                        "query_norm": round(q_norm, 4),
                    },
                )
            )
        return results
