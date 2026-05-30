"""Pydantic request/response schemas."""
from __future__ import annotations

from pydantic import BaseModel, Field


class SearchHit(BaseModel):
    doc_id: int
    url: str
    title: str
    host: str
    snippet: str
    score: float
    features: dict


class SearchResponse(BaseModel):
    query: str
    took_ms: int
    total: int
    hits: list[SearchHit]
    ads: list[dict] = Field(default_factory=list)


class CrawlRequest(BaseModel):
    seeds: list[str] = Field(..., min_length=1)
    max_depth: int = 2
    max_pages: int = 100
    same_host_only: bool = False


class CrawlResponse(BaseModel):
    fetched: int
    documents: int
    frontier: dict


class IndexDoc(BaseModel):
    url: str
    title: str
    text: str
    host: str = ""


class IndexRequest(BaseModel):
    documents: list[IndexDoc]


class ClickEvent(BaseModel):
    query: str
    doc_id: int
    position: int
    session_id: str | None = None


class HealthResponse(BaseModel):
    status: str
    documents: int
    vectors: int
    bm25_docs: int
    embedding_model: str
    embedding_dim: int
    frontier: dict
    data_dir: str
    ltr_trained: bool
