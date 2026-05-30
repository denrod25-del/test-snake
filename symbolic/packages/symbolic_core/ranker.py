"""Hybrid ranker: BM25 ∪ vector retrieval, then LTR (or linear fallback) reranking.

This module is the "RankBrain analogue" — it understands queries via embeddings
while keeping classical lexical signals in the loop, and learns from clicks via
the LTR reranker.
"""
from __future__ import annotations

import math
import time
from typing import Callable

from .bm25 import BM25
from .embeddings import Embedder
from .text import normalize, tokenize, make_snippet
from .types import Document, Features, Hit, Query


class HybridRanker:
    """Fuses BM25, vector similarity, and structural features.

    Parameters
    ----------
    bm25 : BM25
        Lexical scorer.
    embedder : Embedder
        Encoder for query and (cached) doc vectors.
    vector_search : Callable[[np.ndarray, int], list[tuple[int, float]]]
        Function (query_vec, top_k) -> [(doc_id, cosine), ...].
    fetch_doc : Callable[[int], Document | None]
        Fetch a document by id from the store.
    fetch_doc_vec : Callable[[int], np.ndarray | None]
        Fetch a doc vector by id (used when a candidate came from BM25 but not vector top-K).
    reranker : object | None
        Optional LTRReranker. If None, a hand-tuned linear fusion is used.
    """

    def __init__(
        self,
        bm25: BM25,
        embedder: Embedder,
        vector_search: Callable,
        fetch_doc: Callable[[int], Document | None],
        fetch_doc_vec: Callable | None = None,
        reranker=None,
        candidate_k: int = 100,
    ) -> None:
        self.bm25 = bm25
        self.embedder = embedder
        self.vector_search = vector_search
        self.fetch_doc = fetch_doc
        self.fetch_doc_vec = fetch_doc_vec
        self.reranker = reranker
        self.candidate_k = candidate_k

    def search(self, query: Query) -> list[Hit]:
        q_terms = tokenize(query.text)
        # 1. Recall: gather candidate doc ids from BM25 + vector search
        bm25_hits = dict(self.bm25.search(query.text, top_k=self.candidate_k))

        if self.bm25.n_docs() > 0:
            q_vec = self.embedder.encode(query.text)
            vec_hits = dict(self.vector_search(q_vec, self.candidate_k))
        else:
            vec_hits = {}

        candidate_ids = set(bm25_hits.keys()) | set(vec_hits.keys())
        if not candidate_ids:
            return []

        now = time.time()
        norm_q = normalize(query.text)
        hits: list[Hit] = []

        # 2. Build feature vector per candidate
        for doc_id in candidate_ids:
            doc = self.fetch_doc(doc_id)
            if doc is None:
                continue

            bm25_score = bm25_hits.get(doc_id)
            if bm25_score is None:
                bm25_score = self.bm25.score(query.text, doc_id)

            cosine = vec_hits.get(doc_id)
            if cosine is None and self.fetch_doc_vec is not None:
                dvec = self.fetch_doc_vec(doc_id)
                if dvec is not None:
                    # Both vectors are L2-normalized → dot product is cosine.
                    import numpy as np
                    cosine = float(np.dot(q_vec, dvec))
            if cosine is None:
                cosine = 0.0

            title_norm = normalize(doc.title or "")
            url_norm = normalize(doc.url or "")
            title_match = 1.0 if any(t in title_norm for t in q_terms) else 0.0
            url_match = 1.0 if any(t in url_norm for t in q_terms) else 0.0

            doc_len = max(1, len(doc.text or ""))
            log_doc_len = math.log(doc_len)
            age_days = max(0.0, (now - (doc.crawled_at or now)) / 86400.0)
            log_freshness = math.log(1.0 + age_days)
            log_inlinks = math.log(1.0 + max(0, doc.inlinks))

            feats = Features(
                bm25=float(bm25_score or 0.0),
                cosine=float(cosine),
                title_match=title_match,
                url_match=url_match,
                log_doc_len=log_doc_len,
                log_freshness_days=log_freshness,
                log_inlinks=log_inlinks,
            )

            score = self._score(feats)
            snippet = make_snippet(doc.text or "", q_terms)
            hits.append(Hit(doc=doc, score=score, features=feats, snippet=snippet))

        # 3. Rank
        if self.reranker is not None and self.reranker.is_trained():
            X = [h.features.to_list() for h in hits]
            scores = self.reranker.predict(X)
            for h, s in zip(hits, scores):
                h.score = float(s)

        hits.sort(key=lambda h: h.score, reverse=True)
        return hits[: query.top_k]

    @staticmethod
    def _score(f: Features) -> float:
        """Hand-tuned linear fusion used when the LTR model isn't trained yet.

        Weights chosen so BM25 dominates for keyword queries while embeddings
        rescue semantic queries; light penalty on stale or super-long docs.
        """
        return (
            0.55 * f.bm25
            + 1.20 * f.cosine
            + 0.40 * f.title_match
            + 0.10 * f.url_match
            + 0.05 * f.log_inlinks
            - 0.02 * f.log_freshness_days
            - 0.01 * f.log_doc_len
        )
