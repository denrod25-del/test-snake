"""Example custom plugin.

Drop a copy of this file in `plugins/`, edit `name` and `score()`, and your
algorithm will appear in the SearchLab UI after clicking "Reload plugins".

This particular example is BM25 with a configurable boost when query terms
appear in the document title. It's a simple but realistic baseline.
"""
from __future__ import annotations

import math
from collections import Counter

from searchlab.algorithms.base import RankingAlgorithm, Result
from searchlab.algorithms.bm25 import BM25
from searchlab.indexer import CorpusIndex
from searchlab.tokenizer import analyze


class TitleBoostedBM25(RankingAlgorithm):
    name = "bm25-title-boost"
    description = "BM25 with an additive boost when query terms appear in the document title."

    def __init__(self, k1: float = 1.5, b: float = 0.75, title_boost: float = 1.5) -> None:
        self.k1 = k1
        self.b = b
        self.title_boost = title_boost

    def score(self, query: str, index: CorpusIndex) -> list[Result]:
        bm25_results = BM25(k1=self.k1, b=self.b).score(query, index)
        if not bm25_results:
            return []

        q_terms = set(self.query_terms(query))
        boosted: list[Result] = []
        for r in bm25_results:
            doc = index.docs.get(r.doc_id, {})
            title_tokens = set(analyze(doc.get("title") or ""))
            overlap = q_terms & title_tokens
            boost = self.title_boost * len(overlap) * math.log(2 + index.n_docs / max(1, index.df.get(next(iter(overlap), ""), 1))) if overlap else 0.0
            new_score = r.score + boost
            expl = dict(r.explanation)
            expl["title_overlap"] = sorted(overlap)
            expl["title_boost_added"] = round(boost, 4)
            boosted.append(Result(doc_id=r.doc_id, score=new_score, explanation=expl))
        return boosted
