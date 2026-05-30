"""SYMBOLIC search API.

Run:
    uvicorn symbolic_api.main:app --port 8000
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from symbolic_core import HybridRanker, LTRReranker, Query
from symbolic_crawler import CrawlConfig, Crawler
from symbolic_index import Index

from .schemas import (
    ClickEvent,
    CrawlRequest,
    CrawlResponse,
    HealthResponse,
    IndexRequest,
    SearchHit,
    SearchResponse,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("symbolic.api")

app = FastAPI(title="SYMBOLIC Search", version="0.1.0")

# --- Singletons ---
_index: Index | None = None
_ranker: HybridRanker | None = None
_ltr: LTRReranker | None = None
_data_dir = Path(os.getenv("SYMBOLIC_DATA_DIR", "./data")).resolve()


def get_index() -> Index:
    global _index
    if _index is None:
        _index = Index(_data_dir)
    return _index


def get_ranker() -> HybridRanker:
    global _ranker, _ltr
    idx = get_index()
    if _ltr is None:
        ltr_path = _data_dir / "ltr.txt"
        _ltr = LTRReranker.load(ltr_path) if ltr_path.exists() else LTRReranker()
    if _ranker is None:
        _ranker = HybridRanker(
            bm25=idx.bm25,
            embedder=idx.embedder,
            vector_search=idx.search_vectors,
            fetch_doc=idx.fetch_doc,
            fetch_doc_vec=idx.fetch_doc_vec,
            reranker=_ltr,
        )
    else:
        # If the BM25 in-memory ref changed (e.g. after add), make sure ranker uses the latest.
        _ranker.bm25 = idx.bm25
    return _ranker


# --- Static UI mounting ---
_web_static = Path(__file__).resolve().parent.parent / "symbolic_web" / "static"
if _web_static.exists():
    app.mount("/static", StaticFiles(directory=str(_web_static)), name="static")


@app.get("/", response_class=HTMLResponse)
def home() -> HTMLResponse:
    idx_path = _web_static / "index.html"
    if idx_path.exists():
        return HTMLResponse(idx_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>SYMBOLIC</h1><p>Search UI not built.</p>")


@app.get("/results", response_class=HTMLResponse)
def results_page() -> HTMLResponse:
    p = _web_static / "results.html"
    if p.exists():
        return HTMLResponse(p.read_text(encoding="utf-8"))
    raise HTTPException(404)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    idx = get_index()
    h = idx.health()
    get_ranker()
    return HealthResponse(
        status="ok",
        documents=h["documents"],
        vectors=h["vectors"],
        bm25_docs=h["bm25_docs"],
        embedding_model=h["embedding_model"],
        embedding_dim=h["embedding_dim"],
        frontier=h["frontier"],
        data_dir=h["data_dir"],
        ltr_trained=bool(_ltr and _ltr.is_trained()),
    )


@app.get("/search", response_model=SearchResponse)
async def search(q: str, k: int = 10, with_ads: bool = True) -> SearchResponse:
    if not q or not q.strip():
        raise HTTPException(400, "q is required")
    t0 = time.time()
    ranker = get_ranker()
    hits = ranker.search(Query(text=q.strip(), top_k=k))
    took_ms = int((time.time() - t0) * 1000)

    ads: list[dict] = []
    if with_ads:
        ads_url = os.getenv("SYMBOLIC_ADS_URL", "http://localhost:8001")
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                r = await client.get(f"{ads_url}/ads", params={"q": q})
                if r.status_code == 200:
                    ads = r.json().get("ads", [])
        except Exception:
            ads = []

    # Log impression to analytics
    asyncio.create_task(_log_impression(q, [h.doc.doc_id for h in hits]))

    return SearchResponse(
        query=q,
        took_ms=took_ms,
        total=len(hits),
        hits=[SearchHit(**h.to_dict()) for h in hits],
        ads=ads,
    )


@app.post("/index", response_model=dict)
def index_documents(req: IndexRequest) -> dict:
    idx = get_index()
    docs = [d.model_dump() for d in req.documents]
    ids = idx.add_documents(docs)
    idx.persist()
    return {"indexed": len(ids), "doc_ids": ids, "total": idx.store.count_documents()}


@app.post("/crawl", response_model=CrawlResponse)
async def crawl(req: CrawlRequest) -> CrawlResponse:
    idx = get_index()
    cfg = CrawlConfig(
        max_depth=req.max_depth,
        max_pages=req.max_pages,
        same_host_only=req.same_host_only,
    )
    crawler = Crawler(idx, cfg)
    crawler.seed(req.seeds)
    result = await crawler.run()
    return CrawlResponse(**result)


@app.post("/click")
async def click(ev: ClickEvent) -> dict:
    """Forward click event to symbolic_analytics for LTR training data."""
    analytics_url = os.getenv("SYMBOLIC_ANALYTICS_URL", "http://localhost:8002")
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            await client.post(f"{analytics_url}/event/click", json=ev.model_dump())
    except Exception:
        pass  # Best-effort.
    return {"ok": True}


async def _log_impression(query: str, doc_ids: list[int]) -> None:
    analytics_url = os.getenv("SYMBOLIC_ANALYTICS_URL", "http://localhost:8002")
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            await client.post(
                f"{analytics_url}/event/impression",
                json={"query": query, "doc_ids": doc_ids},
            )
    except Exception:
        pass


@app.get("/favicon.ico")
def favicon() -> FileResponse:
    p = _web_static / "favicon.svg"
    if p.exists():
        return FileResponse(str(p), media_type="image/svg+xml")
    raise HTTPException(404)
