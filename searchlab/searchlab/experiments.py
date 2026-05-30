"""A/B experiment framework.

Compare two algorithm configurations on a set of queries. For queries with
human relevance judgments, compute IR metrics. For queries without, fall
back to rank-overlap stats (Jaccard@k, Kendall's tau on the intersection)
so you still get a useful comparison signal.

Each experiment is persisted so you can review it later.
"""
from __future__ import annotations

import math
from typing import Any

from .indexer import get_index
from .metrics import evaluate
from .plugins import get_registry
from .storage import Storage


def _kendall_tau(a: list[int], b: list[int]) -> float | None:
    """Kendall tau on the intersection of two ranked lists.

    Returns None when the intersection has < 2 items (tau undefined).
    """
    inter = [d for d in a if d in b]
    if len(inter) < 2:
        return None
    pos_b = {d: i for i, d in enumerate(b)}
    inter.sort(key=lambda d: a.index(d))
    bs = [pos_b[d] for d in inter]
    n = len(bs)
    concordant = discordant = 0
    for i in range(n):
        for j in range(i + 1, n):
            diff = bs[j] - bs[i]
            if diff > 0:
                concordant += 1
            elif diff < 0:
                discordant += 1
    total = n * (n - 1) / 2
    return (concordant - discordant) / total if total else None


def _jaccard_at_k(a: list[int], b: list[int], k: int) -> float:
    s_a, s_b = set(a[:k]), set(b[:k])
    if not s_a and not s_b:
        return 1.0
    return len(s_a & s_b) / max(1, len(s_a | s_b))


def _run_one(
    storage: Storage,
    corpus_id: int,
    query: str,
    algorithm: str,
    params: dict[str, Any] | None,
    top_k: int,
) -> list[int]:
    registry = get_registry()
    algo = registry.instantiate(algorithm, params=params)
    index = get_index(storage, corpus_id)
    raw = algo.score(query, index)
    raw.sort(key=lambda r: r.score, reverse=True)
    return [r.doc_id for r in raw[:top_k]]


def run_ab(
    storage: Storage,
    *,
    name: str,
    corpus_id: int,
    queries: list[str],
    algo_a: str,
    algo_b: str,
    params_a: dict[str, Any] | None = None,
    params_b: dict[str, Any] | None = None,
    top_k: int = 10,
) -> dict[str, Any]:
    per_query: list[dict[str, Any]] = []

    sum_metrics_a: dict[str, float] = {}
    sum_metrics_b: dict[str, float] = {}
    judged_count = 0

    for q in queries:
        ranked_a = _run_one(storage, corpus_id, q, algo_a, params_a, top_k)
        ranked_b = _run_one(storage, corpus_id, q, algo_b, params_b, top_k)
        qrels = storage.get_judgments(corpus_id, q)

        entry: dict[str, Any] = {
            "query": q,
            "n_judgments": len(qrels),
            "ranked_a": ranked_a,
            "ranked_b": ranked_b,
            "jaccard@k": round(_jaccard_at_k(ranked_a, ranked_b, top_k), 4),
            "kendall_tau": _kendall_tau(ranked_a, ranked_b),
        }

        if qrels:
            judged_count += 1
            ma = evaluate(ranked_a, qrels)
            mb = evaluate(ranked_b, qrels)
            entry["metrics_a"] = ma
            entry["metrics_b"] = mb
            for k, v in ma.items():
                sum_metrics_a[k] = sum_metrics_a.get(k, 0.0) + v
            for k, v in mb.items():
                sum_metrics_b[k] = sum_metrics_b.get(k, 0.0) + v

        per_query.append(entry)

    summary: dict[str, Any] = {
        "n_queries": len(queries),
        "n_judged_queries": judged_count,
        "mean_jaccard@k": round(
            sum(p["jaccard@k"] for p in per_query) / max(1, len(per_query)), 4
        ),
    }
    if judged_count:
        summary["mean_metrics_a"] = {
            k: round(v / judged_count, 4) for k, v in sum_metrics_a.items()
        }
        summary["mean_metrics_b"] = {
            k: round(v / judged_count, 4) for k, v in sum_metrics_b.items()
        }
        summary["delta"] = {
            k: round(
                summary["mean_metrics_b"][k] - summary["mean_metrics_a"][k], 4
            )
            for k in summary["mean_metrics_a"]
        }
        summary["winner"] = _pick_winner(summary["mean_metrics_a"], summary["mean_metrics_b"])

    payload: dict[str, Any] = {
        "params_a": params_a or {},
        "params_b": params_b or {},
        "top_k": top_k,
        "per_query": per_query,
        "summary": summary,
    }

    exp_id = storage.save_experiment(
        name=name,
        corpus_id=corpus_id,
        algo_a=algo_a,
        algo_b=algo_b,
        payload=payload,
    )
    return {
        "experiment_id": exp_id,
        "name": name,
        "corpus_id": corpus_id,
        "algo_a": algo_a,
        "algo_b": algo_b,
        **payload,
    }


def _pick_winner(ma: dict[str, float], mb: dict[str, float]) -> str:
    """Compare on NDCG@10 if available, otherwise MAP, otherwise MRR.

    Ties go to "tie".
    """
    for key in ("ndcg@10", "ndcg@5", "map", "mrr"):
        if key in ma and key in mb:
            if math.isclose(ma[key], mb[key], abs_tol=1e-6):
                return "tie"
            return "B" if mb[key] > ma[key] else "A"
    return "tie"
