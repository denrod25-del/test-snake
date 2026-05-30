"""Link-graph based ranking: PageRank, HITS, and a content+graph hybrid.

PageRank scores are query-independent, so as a standalone "ranker" they only
make sense if you've already filtered to query-matching docs. The hybrid
variant combines BM25 with PageRank, which is closer to how real engines
mix topical relevance with authority signals.
"""
from __future__ import annotations

import math

import networkx as nx

from ..indexer import CorpusIndex
from .base import RankingAlgorithm, Result
from .bm25 import BM25


def _filter_to_matches(query_terms: list[str], index: CorpusIndex) -> set[int]:
    matches: set[int] = set()
    for term in query_terms:
        for p in index.postings.get(term, []):
            matches.add(p.doc_id)
    return matches


class PageRank(RankingAlgorithm):
    name = "pagerank"
    description = "PageRank over the link graph; restricted to docs that match at least one query term."

    def __init__(self, damping: float = 0.85, max_iter: int = 100, tol: float = 1e-6) -> None:
        self.damping = damping
        self.max_iter = max_iter
        self.tol = tol

    def score(self, query: str, index: CorpusIndex) -> list[Result]:
        if index.n_docs == 0:
            return []
        try:
            pr = nx.pagerank(
                index.graph,
                alpha=self.damping,
                max_iter=self.max_iter,
                tol=self.tol,
            )
        except nx.PowerIterationFailedConvergence:
            pr = nx.pagerank(index.graph, alpha=self.damping, max_iter=500)

        q_terms = self.query_terms(query)
        candidates = _filter_to_matches(q_terms, index) if q_terms else set(index.doc_ids)

        return [
            Result(
                doc_id=doc_id,
                score=pr.get(doc_id, 0.0),
                explanation={
                    "model": "pagerank",
                    "in_degree": index.graph.in_degree(doc_id),
                    "out_degree": index.graph.out_degree(doc_id),
                    "damping": self.damping,
                },
            )
            for doc_id in candidates
        ]


class HITS(RankingAlgorithm):
    name = "hits"
    description = "HITS authority score over the subgraph induced by query-matching docs and their neighbors."

    def __init__(self, max_iter: int = 100, score_kind: str = "authority") -> None:
        self.max_iter = max_iter
        self.score_kind = score_kind  # "authority" or "hub"

    def score(self, query: str, index: CorpusIndex) -> list[Result]:
        q_terms = self.query_terms(query)
        if not q_terms:
            return []
        seed = _filter_to_matches(q_terms, index)
        if not seed:
            return []
        # Expand seed by one hop in both directions, classic HITS base set.
        nodes = set(seed)
        for n in seed:
            nodes.update(index.graph.predecessors(n))
            nodes.update(index.graph.successors(n))
        sub = index.graph.subgraph(nodes).copy()
        if sub.number_of_edges() == 0:
            sub.add_edges_from((n, n) for n in nodes)
        try:
            hubs, auths = nx.hits(sub, max_iter=self.max_iter, normalized=True)
        except (nx.PowerIterationFailedConvergence, nx.NetworkXError):
            return []
        chosen = auths if self.score_kind == "authority" else hubs
        return [
            Result(
                doc_id=doc_id,
                score=chosen.get(doc_id, 0.0),
                explanation={
                    "model": "hits",
                    "authority": auths.get(doc_id, 0.0),
                    "hub": hubs.get(doc_id, 0.0),
                    "in_base_set": doc_id in seed,
                },
            )
            for doc_id in seed
        ]


class HybridBM25PageRank(RankingAlgorithm):
    name = "hybrid-bm25-pagerank"
    description = "Linear blend of normalized BM25 (content) and PageRank (authority)."

    def __init__(self, alpha: float = 0.7, k1: float = 1.5, b: float = 0.75, damping: float = 0.85) -> None:
        self.alpha = alpha
        self.k1 = k1
        self.b = b
        self.damping = damping

    @staticmethod
    def _normalize(scores: dict[int, float]) -> dict[int, float]:
        if not scores:
            return {}
        m = max(scores.values())
        if m <= 0:
            return {k: 0.0 for k in scores}
        return {k: v / m for k, v in scores.items()}

    def score(self, query: str, index: CorpusIndex) -> list[Result]:
        bm25 = BM25(k1=self.k1, b=self.b).score(query, index)
        if not bm25:
            return []

        try:
            pr = nx.pagerank(index.graph, alpha=self.damping, max_iter=200)
        except nx.PowerIterationFailedConvergence:
            pr = {n: 1.0 / max(index.n_docs, 1) for n in index.doc_ids}

        bm25_scores = {r.doc_id: r.score for r in bm25}
        pr_subset = {d: pr.get(d, 0.0) for d in bm25_scores}
        bm25_n = self._normalize(bm25_scores)
        pr_n = self._normalize(pr_subset)

        results: list[Result] = []
        for doc_id, bm in bm25_n.items():
            p = pr_n.get(doc_id, 0.0)
            blended = self.alpha * bm + (1.0 - self.alpha) * p
            results.append(
                Result(
                    doc_id=doc_id,
                    score=blended,
                    explanation={
                        "model": "hybrid",
                        "alpha": self.alpha,
                        "bm25_norm": round(bm, 4),
                        "pagerank_norm": round(p, 4),
                        "bm25_raw": round(bm25_scores[doc_id], 4),
                        "pagerank_raw": round(pr_subset[doc_id], 6),
                    },
                )
            )
        return results


def _safe_log(x: float) -> float:
    return math.log(x) if x > 0 else 0.0
