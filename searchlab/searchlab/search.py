"""High-level search entry point: instantiate algorithm, run, sort, hydrate docs."""
from __future__ import annotations

from typing import Any

from .indexer import get_index
from .plugins import get_registry
from .storage import Storage


def run_search(
    storage: Storage,
    corpus_id: int,
    query: str,
    algorithm: str,
    *,
    params: dict[str, Any] | None = None,
    top_k: int = 20,
    hydrate: bool = True,
) -> dict[str, Any]:
    registry = get_registry()
    algo = registry.instantiate(algorithm, params=params)
    index = get_index(storage, corpus_id)

    raw = algo.score(query, index)
    raw.sort(key=lambda r: r.score, reverse=True)
    top = raw[:top_k]

    results = []
    for rank, r in enumerate(top, start=1):
        item = r.to_json()
        item["rank"] = rank
        if hydrate:
            doc = index.docs.get(r.doc_id, {})
            item["url"] = doc.get("url")
            item["title"] = doc.get("title")
            body = doc.get("body") or ""
            item["snippet"] = (body[:280] + ("..." if len(body) > 280 else ""))
        results.append(item)

    return {
        "corpus_id": corpus_id,
        "query": query,
        "algorithm": algorithm,
        "params": algo.params(),
        "n_results": len(results),
        "n_total_matches": len(raw),
        "results": results,
    }
