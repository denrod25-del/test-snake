"""FastAPI application: serves the web UI plus the REST API."""
from __future__ import annotations

import asyncio
from typing import Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import crawler as crawler_mod
from . import experiments as exp_mod
from . import samples as samples_mod
from . import synthetic as synthetic_mod
from . import uploader as uploader_mod
from .config import STATIC_DIR
from .indexer import get_index, invalidate
from .plugins import get_registry, reload_registry
from .search import run_search
from .storage import Storage

app = FastAPI(title="SearchLab", version="0.1.0")
storage = Storage()


# -------------------- request models -----------------------------------
class SearchRequest(BaseModel):
    corpus_id: int
    query: str
    algorithm: str
    params: dict[str, Any] | None = None
    top_k: int = Field(default=20, ge=1, le=200)


class CompareRequest(BaseModel):
    corpus_id: int
    query: str
    algorithms: list[str]
    params: dict[str, dict[str, Any]] | None = None
    top_k: int = Field(default=10, ge=1, le=200)


class ExperimentRequest(BaseModel):
    name: str
    corpus_id: int
    queries: list[str]
    algo_a: str
    algo_b: str
    params_a: dict[str, Any] | None = None
    params_b: dict[str, Any] | None = None
    top_k: int = Field(default=10, ge=1, le=200)


class SyntheticRequest(BaseModel):
    name: str
    n_docs: int = Field(default=200, ge=5, le=20_000)
    topics: list[str] | None = None
    graph_kind: str = Field(default="scale_free", pattern="^(scale_free|small_world)$")
    seed: int = 42


class CrawlRequest(BaseModel):
    name: str
    seeds: list[str]
    max_pages: int = Field(default=50, ge=1, le=2000)
    max_depth: int = Field(default=2, ge=0, le=8)
    same_domain_only: bool = True
    delay_ms: int = Field(default=200, ge=0, le=10_000)


class JudgmentRequest(BaseModel):
    corpus_id: int
    query: str
    doc_id: int
    relevance: int = Field(ge=0, le=4)


# -------------------- meta endpoints -----------------------------------
@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "version": "0.1.0"}


@app.get("/api/algorithms")
def list_algorithms() -> dict:
    reg = get_registry()
    return {
        "algorithms": reg.list_descriptors(),
        "load_errors": reg.errors(),
    }


@app.post("/api/algorithms/reload")
def reload_algorithms() -> dict:
    reg = reload_registry()
    return {
        "algorithms": reg.list_descriptors(),
        "load_errors": reg.errors(),
    }


# -------------------- corpora ------------------------------------------
@app.get("/api/corpora")
def list_corpora() -> dict:
    return {"corpora": storage.list_corpora()}


@app.delete("/api/corpora/{corpus_id}")
def delete_corpus(corpus_id: int) -> dict:
    storage.delete_corpus(corpus_id)
    invalidate(corpus_id)
    return {"deleted": corpus_id}


@app.get("/api/corpora/{corpus_id}/documents")
def list_documents(corpus_id: int, limit: int = 50) -> dict:
    docs = storage.list_documents(corpus_id)[:limit]
    for d in docs:
        body = d.get("body") or ""
        d["snippet"] = body[:200] + ("..." if len(body) > 200 else "")
        d.pop("body", None)
    return {"documents": docs}


@app.get("/api/corpora/{corpus_id}/graph")
def get_graph(corpus_id: int, limit_nodes: int = 200) -> dict:
    """Return a small JSON view of the link graph for visualization."""
    idx = get_index(storage, corpus_id)
    nodes = list(idx.doc_ids)[:limit_nodes]
    nset = set(nodes)
    edges = [(u, v) for u, v in idx.graph.edges if u in nset and v in nset]
    return {
        "nodes": [
            {
                "id": d,
                "title": (idx.docs[d].get("title") or "")[:80],
                "url": idx.docs[d].get("url"),
                "in_degree": idx.graph.in_degree(d),
                "out_degree": idx.graph.out_degree(d),
            }
            for d in nodes
        ],
        "edges": [{"source": u, "target": v} for u, v in edges],
        "n_total_nodes": idx.n_docs,
        "n_total_edges": idx.graph.number_of_edges(),
    }


@app.get("/api/corpora/{corpus_id}/judged-queries")
def list_judged_queries(corpus_id: int) -> dict:
    return {"queries": storage.list_judged_queries(corpus_id)}


# -------------------- data sources -------------------------------------
@app.post("/api/data/synthetic")
def make_synthetic(req: SyntheticRequest) -> dict:
    return synthetic_mod.generate_corpus(
        storage,
        name=req.name,
        n_docs=req.n_docs,
        topics=req.topics,
        graph_kind=req.graph_kind,
        seed=req.seed,
    )


@app.post("/api/data/sample/ir-classics")
def load_sample() -> dict:
    return samples_mod.load_ir_classics(storage)


@app.post("/api/data/crawl")
async def crawl_endpoint(req: CrawlRequest) -> dict:
    return await asyncio.to_thread(
        crawler_mod.crawl,
        storage,
        corpus_name=req.name,
        seeds=req.seeds,
        max_pages=req.max_pages,
        max_depth=req.max_depth,
        same_domain_only=req.same_domain_only,
        delay_ms=req.delay_ms,
    )


@app.post("/api/data/upload")
async def upload(file: UploadFile = File(...), name: str | None = Form(default=None)) -> dict:
    raw = (await file.read()).decode("utf-8")
    fname = (file.filename or "").lower()
    if fname.endswith(".json"):
        return uploader_mod.ingest_json_text(storage, raw)
    if fname.endswith(".csv"):
        return uploader_mod.ingest_csv(storage, raw, name=name or "uploaded-csv")
    raise HTTPException(status_code=400, detail="Upload must be .json or .csv")


# -------------------- search & compare ---------------------------------
@app.post("/api/search")
def search(req: SearchRequest) -> dict:
    try:
        return run_search(
            storage,
            corpus_id=req.corpus_id,
            query=req.query,
            algorithm=req.algorithm,
            params=req.params,
            top_k=req.top_k,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@app.post("/api/compare")
def compare(req: CompareRequest) -> dict:
    out: dict[str, Any] = {"corpus_id": req.corpus_id, "query": req.query, "results": {}}
    for algo in req.algorithms:
        params = (req.params or {}).get(algo)
        try:
            out["results"][algo] = run_search(
                storage,
                corpus_id=req.corpus_id,
                query=req.query,
                algorithm=algo,
                params=params,
                top_k=req.top_k,
            )
        except KeyError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
    return out


# -------------------- judgments ----------------------------------------
@app.post("/api/judgments")
def add_judgment(req: JudgmentRequest) -> dict:
    storage.add_judgment(req.corpus_id, req.query, req.doc_id, req.relevance)
    return {"ok": True}


# -------------------- experiments --------------------------------------
@app.post("/api/experiments")
def run_experiment(req: ExperimentRequest) -> dict:
    return exp_mod.run_ab(
        storage,
        name=req.name,
        corpus_id=req.corpus_id,
        queries=req.queries,
        algo_a=req.algo_a,
        algo_b=req.algo_b,
        params_a=req.params_a,
        params_b=req.params_b,
        top_k=req.top_k,
    )


@app.get("/api/experiments")
def list_experiments() -> dict:
    return {"experiments": storage.list_experiments()}


@app.get("/api/experiments/{exp_id}")
def get_experiment(exp_id: int) -> dict:
    exp = storage.get_experiment(exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="experiment not found")
    return exp


# -------------------- static UI ----------------------------------------
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_model=None)
def root() -> JSONResponse | FileResponse:
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse({"message": "SearchLab API. UI not found.", "docs": "/docs"})
