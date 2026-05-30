# SearchLab

An educational lab for designing, comparing, and benchmarking page-ranking and
search-engine algorithms. Build your own algorithms as plugins, run them
against synthetic, sample, crawled, or uploaded corpora, and use the built-in
A/B framework with IR metrics to decide which one wins.

## Why this exists

Most "search engine" tutorials show you a single algorithm. Real search work
is comparative: you tune BM25 parameters, blend in a graph signal, test a new
re-ranker, and you need a sandbox where you can do all of that side by side.
SearchLab is that sandbox, scoped to medium-size corpora (up to ~100k docs)
and an explicit teaching focus.

## Features

- **Plugin interface** — write a Python class, drop it in `plugins/`, hot-reload from the UI
- **Built-in baselines** — TF-IDF, Okapi BM25, PageRank, HITS, BM25+PageRank hybrid
- **Four data sources** — synthetic graph generator, hand-curated sample, polite web crawler, JSON/CSV upload
- **Web UI + REST API** — both backed by the same FastAPI server
- **A/B experiment framework** — Precision@k, Recall@k, MAP, MRR, NDCG@k, plus rank-overlap metrics for unjudged queries
- **Per-result explanations** — every algorithm reports why each document ranked where it did
- **Persistent storage** — corpora, link graphs, judgments, and experiments survive restarts (SQLite)

## Quick start

```bash
cd searchlab
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
python run.py
```

Open <http://127.0.0.1:8000>.

In the **Data** tab, click **Load ir-classics**. Switch to **Search**,
type `ranking algorithms`, pick `bm25`, and click Search. Then go to
**A/B**, choose `bm25` vs `hybrid-bm25-pagerank`, and click Run.

## Writing your own algorithm

Create a file in `plugins/` (any name). Subclass `RankingAlgorithm`:

```python
from searchlab.algorithms.base import RankingAlgorithm, Result
from searchlab.indexer import CorpusIndex

class MyRanker(RankingAlgorithm):
    name = "my-ranker"
    description = "Short description for the UI."

    def __init__(self, weight: float = 1.0):
        self.weight = weight

    def score(self, query: str, index: CorpusIndex) -> list[Result]:
        terms = self.query_terms(query)
        scored = []
        for term in terms:
            for posting in index.postings.get(term, []):
                scored.append(Result(
                    doc_id=posting.doc_id,
                    score=self.weight * posting.tf,
                    explanation={"term": term, "tf": posting.tf},
                ))
        return scored
```

Click **Reload plugins** in the Algorithms tab. Your ranker will appear in
all dropdowns. Any `int / float / bool / str` instance attribute is exposed
as a tunable parameter automatically.

### What the index gives you

`CorpusIndex` (see `searchlab/indexer.py`) exposes:

- `index.doc_ids` — list of all doc ids in the corpus
- `index.docs[doc_id]` — `{url, title, body, tokens}`
- `index.postings[term]` — list of `Posting(doc_id, tf)` for that term
- `index.df[term]` — document frequency
- `index.doc_len[doc_id]` — token count
- `index.avgdl`, `index.n_docs`
- `index.graph` — a `networkx.DiGraph` of the link graph

This is enough to build TF-IDF, BM25, PageRank, HITS, hybrids, query
expansion, learning-to-rank features, anything you want.

## REST API

The same endpoints the web UI uses are documented at <http://127.0.0.1:8000/docs>.

Highlights:

- `GET /api/algorithms` — list registered algorithms and their parameters
- `POST /api/algorithms/reload` — re-scan `plugins/`
- `POST /api/data/sample/ir-classics` — load the built-in sample
- `POST /api/data/synthetic` — generate a synthetic corpus
- `POST /api/data/crawl` — crawl a seed list (BFS, robots-aware)
- `POST /api/data/upload` — multipart upload of `.json` or `.csv`
- `POST /api/search` — run one algorithm
- `POST /api/compare` — run several algorithms on the same query
- `POST /api/experiments` — A/B compare two configurations across many queries
- `GET  /api/experiments` — list past experiments
- `POST /api/judgments` — add a relevance judgment

### Upload formats

JSON (preferred):

```json
{
  "name": "my-corpus",
  "description": "optional",
  "documents": [
    {
      "url": "https://example.com/a",
      "title": "Doc A",
      "body": "free-form text content",
      "links": ["https://example.com/b"]
    }
  ],
  "judgments": [
    {"query": "doc a", "url": "https://example.com/a", "relevance": 3}
  ]
}
```

CSV (single file, columns `url,title,body,links` where `links` is `|`-separated):

```csv
url,title,body,links
https://example.com/a,Doc A,Lorem ipsum,https://example.com/b
https://example.com/b,Doc B,Dolor sit amet,
```

## A/B experiments

For each query in the run:

- If the corpus has relevance judgments for that query, IR metrics are computed for both algorithms (`P@k`, `R@k`, `NDCG@k`, MAP, MRR).
- If not, the experiment still records rank-overlap signals (Jaccard@k, Kendall's tau on the intersection) so you can see *whether* the algorithms disagree, even without ground truth.

A winner is declared on NDCG@10 (preferred) and falls back to MAP and MRR.

## Project layout

```
searchlab/
├── run.py                       # entry point (uvicorn)
├── requirements.txt
├── plugins/                     # YOUR custom algorithms go here
│   └── example_title_boost.py
└── searchlab/
    ├── api.py                   # FastAPI routes
    ├── config.py                # paths
    ├── tokenizer.py             # tokenize / stopwords / stem
    ├── storage.py               # SQLite schema + CRUD
    ├── indexer.py               # in-memory inverted index + graph
    ├── plugins.py               # plugin auto-discovery
    ├── algorithms/              # built-in baselines
    │   ├── base.py              # RankingAlgorithm + Result
    │   ├── tfidf.py
    │   ├── bm25.py
    │   └── pagerank.py
    ├── synthetic.py             # synthetic data generator
    ├── samples.py               # ir-classics sample
    ├── crawler.py               # polite BFS crawler
    ├── uploader.py              # JSON/CSV ingestion
    ├── search.py                # high-level search runner
    ├── metrics.py               # P@k, R@k, MAP, MRR, NDCG
    ├── experiments.py           # A/B framework
    └── static/                  # web UI
        ├── index.html
        ├── style.css
        └── app.js
```

## Limits and intentional non-goals

- Single-process, in-memory index. Up to ~100k docs is comfortable; beyond that, you want Elasticsearch or Lucene.
- The crawler does not render JavaScript and does not parallelize aggressively. It is for collecting demo corpora, not for indexing the web.
- The stemmer is a tiny suffix stripper. Swap in `nltk.PorterStemmer` if you care about stemming quality.
- No authentication. Run on localhost only.

## License

MIT.
