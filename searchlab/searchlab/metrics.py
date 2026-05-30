"""IR metrics: Precision@k, Recall@k, MAP, MRR, NDCG@k.

All take a ranked list of doc_ids and a dict of {doc_id: relevance>=0}.
A document with relevance > 0 is treated as "relevant" for binary metrics.
"""
from __future__ import annotations

import math


def precision_at_k(ranked: list[int], qrels: dict[int, int], k: int) -> float:
    if k <= 0:
        return 0.0
    top = ranked[:k]
    if not top:
        return 0.0
    hits = sum(1 for d in top if qrels.get(d, 0) > 0)
    return hits / k


def recall_at_k(ranked: list[int], qrels: dict[int, int], k: int) -> float:
    relevant = sum(1 for r in qrels.values() if r > 0)
    if relevant == 0:
        return 0.0
    top = ranked[:k]
    hits = sum(1 for d in top if qrels.get(d, 0) > 0)
    return hits / relevant


def average_precision(ranked: list[int], qrels: dict[int, int]) -> float:
    relevant_total = sum(1 for r in qrels.values() if r > 0)
    if relevant_total == 0:
        return 0.0
    hits = 0
    summed = 0.0
    for i, doc in enumerate(ranked, start=1):
        if qrels.get(doc, 0) > 0:
            hits += 1
            summed += hits / i
    return summed / relevant_total


def reciprocal_rank(ranked: list[int], qrels: dict[int, int]) -> float:
    for i, doc in enumerate(ranked, start=1):
        if qrels.get(doc, 0) > 0:
            return 1.0 / i
    return 0.0


def dcg_at_k(ranked: list[int], qrels: dict[int, int], k: int) -> float:
    s = 0.0
    for i, doc in enumerate(ranked[:k], start=1):
        gain = qrels.get(doc, 0)
        if gain > 0:
            s += (2 ** gain - 1) / math.log2(i + 1)
    return s


def ndcg_at_k(ranked: list[int], qrels: dict[int, int], k: int) -> float:
    ideal = sorted(qrels.values(), reverse=True)
    idcg = 0.0
    for i, gain in enumerate(ideal[:k], start=1):
        if gain > 0:
            idcg += (2 ** gain - 1) / math.log2(i + 1)
    if idcg == 0:
        return 0.0
    return dcg_at_k(ranked, qrels, k) / idcg


def evaluate(
    ranked: list[int],
    qrels: dict[int, int],
    *,
    ks: tuple[int, ...] = (1, 3, 5, 10),
) -> dict[str, float]:
    out: dict[str, float] = {}
    for k in ks:
        out[f"p@{k}"] = round(precision_at_k(ranked, qrels, k), 4)
        out[f"r@{k}"] = round(recall_at_k(ranked, qrels, k), 4)
        out[f"ndcg@{k}"] = round(ndcg_at_k(ranked, qrels, k), 4)
    out["map"] = round(average_precision(ranked, qrels), 4)
    out["mrr"] = round(reciprocal_rank(ranked, qrels), 4)
    return out
