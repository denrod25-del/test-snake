# SYMBOLIC

> A search company built like Google's search stack — RankBrain in spirit, with a hybrid neural+symbolic ranker.

SYMBOLIC is a monorepo containing every product surface a search company needs:
crawler, index, ranker, search API, search UI, ads, analytics, and an admin console.

## Product surfaces

| Package              | Port  | What it is                                                          |
|----------------------|-------|---------------------------------------------------------------------|
| `symbolic_core`      | —     | Library: tokenization, BM25, embeddings, LightGBM LTR reranker      |
| `symbolic_crawler`   | —     | Async, polite web crawler (robots.txt aware)                        |
| `symbolic_index`     | —     | SQLite doc store + FAISS vector index + BM25 inverted index         |
| `symbolic_api`       | 8000  | FastAPI search service (`/search`, `/index`, `/crawl`, `/click`)    |
| `symbolic_web`       | 8000  | Public search UI (served by the API at `/`)                         |
| `symbolic_ads`       | 8001  | Keyword-targeted sponsored results microservice                     |
| `symbolic_analytics` | 8002  | Query/click event log + aggregations                                |
| `symbolic_console`   | 8003  | Admin dashboard for crawls, index health, ad campaigns, top queries |

## Architecture

```
                     ┌──────────────┐
   user query  ──▶   │ symbolic_web │  (search UI)
                     └──────┬───────┘
                            │ HTTP
                     ┌──────▼───────┐       ┌────────────────────┐
                     │ symbolic_api │──────▶│ symbolic_ads (8001)│
                     └──────┬───────┘       └────────────────────┘
                            │
                            ▼
        ┌────────────────────────────────────────┐
        │           symbolic_core                │
        │  BM25  ⊕  Embeddings (FAISS)  ⊕  LTR   │
        └──────┬─────────────────────────────────┘
               │
               ▼
        ┌──────────────────┐    ◀──── symbolic_crawler (background)
        │  symbolic_index  │
        │  SQLite + FAISS  │
        └──────────────────┘
               │
               ▼
        ┌────────────────────────┐
        │  symbolic_analytics    │  ──▶  symbolic_console (admin)
        │  (events.db)           │
        └────────────────────────┘
```

## How the ranker works (the RankBrain analogue)

A query `q` against doc `d` produces a feature vector:

1. **BM25 score** — classic lexical relevance (Okapi BM25, k1=1.5, b=0.75).
2. **Cosine embedding similarity** — `q` and `d` encoded with `sentence-transformers/all-MiniLM-L6-v2`, cosine in 384-d space. This is the "RankBrain" piece — it handles never-before-seen queries by understanding meaning, not keywords.
3. **Length / freshness / authority signals** — log doc length, log days-since-crawl, host pagerank-lite (in-link count from our crawl).
4. **Title / URL match flags** — boolean features.

A candidate set is gathered by `top-K BM25 ∪ top-K vector`, then a **LightGBM LambdaMART** reranker scores each candidate using the full feature vector. Click logs from `symbolic_analytics` become training data — the system learns from user behavior, just like RankBrain.

## Quickstart

```bash
cd symbolic
python -m venv .venv
.\.venv\Scripts\Activate.ps1            # Windows
# source .venv/bin/activate             # macOS/Linux
pip install -r requirements.txt

# 1. Seed a tiny crawl + build the index
python scripts/seed_demo.py

# 2. Run all services
python scripts/run_all.py

# 3. Open the search UI
# http://localhost:8000
```

To train the LTR reranker after you have click logs:

```bash
python scripts/train_ltr.py
```

## Status

This is a working MVP. The core search loop (crawl → index → hybrid rank → serve) is fully functional. Ads, analytics, and console are real services with simple feature sets — extend them as you grow.

## License

MIT — do whatever, just keep the name SYMBOLIC.
