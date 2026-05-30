"""symbolic_index — persistence layer.

DocumentStore: SQLite for doc rows + crawl frontier state.
VectorIndex:   FAISS index of doc embeddings keyed by doc_id.
Index:         a small facade that ties them together with the BM25 index.
"""
from .store import DocumentStore
from .vector_index import VectorIndex
from .index import Index

__all__ = ["DocumentStore", "VectorIndex", "Index"]
