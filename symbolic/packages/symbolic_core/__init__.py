"""symbolic_core — ranking primitives for SYMBOLIC.

Exposes:
    - Document, Hit, Query dataclasses
    - tokenize / normalize text utilities
    - BM25 lexical scorer
    - Embedder (sentence-transformers wrapper, lazy-loaded)
    - HybridRanker that fuses BM25 + vector similarity + LTR features
    - LTRReranker (LightGBM LambdaMART)
"""

from .types import Document, Hit, Query, Features
from .text import tokenize, normalize
from .bm25 import BM25
from .embeddings import Embedder
from .ranker import HybridRanker
from .ltr import LTRReranker

__all__ = [
    "Document",
    "Hit",
    "Query",
    "Features",
    "tokenize",
    "normalize",
    "BM25",
    "Embedder",
    "HybridRanker",
    "LTRReranker",
]
