"""Shared dataclasses used across the SYMBOLIC stack."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class Document:
    doc_id: int
    url: str
    title: str
    text: str
    host: str = ""
    crawled_at: float = 0.0
    inlinks: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Query:
    text: str
    top_k: int = 10


@dataclass
class Features:
    """Per (query, doc) feature vector fed to the LTR reranker."""
    bm25: float = 0.0
    cosine: float = 0.0
    title_match: float = 0.0
    url_match: float = 0.0
    log_doc_len: float = 0.0
    log_freshness_days: float = 0.0
    log_inlinks: float = 0.0

    def to_list(self) -> list[float]:
        return [
            self.bm25,
            self.cosine,
            self.title_match,
            self.url_match,
            self.log_doc_len,
            self.log_freshness_days,
            self.log_inlinks,
        ]

    @staticmethod
    def feature_names() -> list[str]:
        return [
            "bm25",
            "cosine",
            "title_match",
            "url_match",
            "log_doc_len",
            "log_freshness_days",
            "log_inlinks",
        ]


@dataclass
class Hit:
    doc: Document
    score: float
    features: Features = field(default_factory=Features)
    snippet: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "doc_id": self.doc.doc_id,
            "url": self.doc.url,
            "title": self.doc.title,
            "host": self.doc.host,
            "snippet": self.snippet,
            "score": self.score,
            "features": asdict(self.features),
        }
