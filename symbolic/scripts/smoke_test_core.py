"""Dependency-free smoke test for symbolic_core BM25 + text utilities.

Run from `symbolic/`: python scripts/smoke_test_core.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packages"))

from symbolic_core.bm25 import BM25
from symbolic_core.text import make_snippet, normalize, tokenize


def main() -> int:
    print("=== text utilities ===")
    assert tokenize("The Quick Brown Fox.") == ["quick", "brown", "fox"], tokenize("The Quick Brown Fox.")
    assert normalize("naïve CAFÉ") == "naive cafe", normalize("naïve CAFÉ")
    print("tokenize/normalize OK")

    print("\n=== BM25 ===")
    bm = BM25()
    docs = {
        1: "The Transformer architecture relies on self attention",
        2: "BM25 is a probabilistic ranking function for information retrieval",
        3: "PageRank ranks web pages by link structure",
        4: "Sentence embeddings encode meaning into vectors",
        5: "The DNS protocol resolves hostnames to IP addresses",
    }
    for did, t in docs.items():
        bm.add(did, t)
    assert bm.n_docs() == 5

    hits = bm.search("transformer attention", top_k=3)
    print(" 'transformer attention' ->", hits)
    assert hits and hits[0][0] == 1, "expected doc 1 to win for 'transformer attention'"

    hits = bm.search("ranking information retrieval", top_k=3)
    print(" 'ranking information retrieval' ->", hits)
    assert hits and hits[0][0] == 2, "expected doc 2 to win"

    hits = bm.search("dns hostnames", top_k=3)
    print(" 'dns hostnames' ->", hits)
    assert hits and hits[0][0] == 5, "expected doc 5 to win"

    print("\n=== save/load ===")
    p = ROOT / "data" / "smoke_bm25.pkl"
    bm.save(p)
    bm2 = BM25.load(p)
    assert bm2.search("transformer attention", top_k=1)[0][0] == 1
    p.unlink()
    print("BM25 save/load OK")

    print("\n=== snippet ===")
    snippet = make_snippet(
        "The Transformer architecture relies on self attention layers stacked deeply",
        ["attention"],
        max_len=40,
    )
    print(" snippet:", repr(snippet))
    assert "attention" in snippet

    print("\nAll core smoke tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
