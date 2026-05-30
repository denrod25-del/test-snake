"""End-to-end search smoke test: load the seeded index, run several queries
through the HybridRanker, print the ranked results.

Run from `symbolic/`: python scripts/smoke_test_e2e.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packages"))

from symbolic_core import HybridRanker, Query  # noqa: E402
from symbolic_index import Index  # noqa: E402


QUERIES = [
    "transformer attention",
    "what algorithm does google use to rank pages",
    "machine learning ranking signal for queries",
    "dns hostname resolution",
    "vector similarity for retrieval",
]


def main() -> int:
    print("Loading index...")
    idx = Index()
    h = idx.health()
    print(f"  documents={h['documents']}  vectors={h['vectors']}  embed={h['embedding_model']} ({h['embedding_dim']}d)")
    if h["documents"] == 0:
        print("Index is empty. Run scripts/seed_demo.py first.")
        return 1

    ranker = HybridRanker(
        bm25=idx.bm25,
        embedder=idx.embedder,
        vector_search=idx.search_vectors,
        fetch_doc=idx.fetch_doc,
        fetch_doc_vec=idx.fetch_doc_vec,
        reranker=None,  # use linear fallback
    )

    for q in QUERIES:
        print(f"\n--- query: {q} ---")
        hits = ranker.search(Query(text=q, top_k=3))
        if not hits:
            print("  (no hits)")
            continue
        for i, hit in enumerate(hits, 1):
            f = hit.features
            print(
                f"  {i}. [{hit.score:+.3f}] {hit.doc.title}\n"
                f"       bm25={f.bm25:.2f} cos={f.cosine:.2f} title={f.title_match:.0f} url={f.url_match:.0f}\n"
                f"       {hit.doc.url}"
            )

    print("\nE2E smoke test OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
