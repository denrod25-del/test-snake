"""Seed SYMBOLIC with a tiny offline demo corpus, plus optionally crawl a few seeds.

Run from the `symbolic/` directory:
    python scripts/seed_demo.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make the packages importable when run as a script.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packages"))

from symbolic_index import Index  # noqa: E402

DEMO_DOCS = [
    {
        "url": "https://symbolic.local/docs/transformer",
        "title": "Transformer architecture explained",
        "host": "symbolic.local",
        "text": (
            "The Transformer is a deep learning architecture introduced in the paper "
            "'Attention Is All You Need'. It replaces recurrence with self-attention, "
            "allowing the model to learn relationships between all positions in a sequence "
            "in parallel. Transformers underpin modern large language models including BERT "
            "and GPT, and have become the default architecture for natural language processing."
        ),
    },
    {
        "url": "https://symbolic.local/docs/dns",
        "title": "How DNS works",
        "host": "symbolic.local",
        "text": (
            "The Domain Name System translates human-readable hostnames such as example.com "
            "into IP addresses that computers use to route packets. A DNS resolver queries "
            "root servers, then top-level-domain servers, then authoritative name servers, "
            "caching results along the way. UDP on port 53 is the historical transport, with "
            "DNS over HTTPS and DNS over TLS now common for privacy."
        ),
    },
    {
        "url": "https://symbolic.local/docs/climate",
        "title": "Causes of modern climate change",
        "host": "symbolic.local",
        "text": (
            "Modern climate change is driven primarily by greenhouse gas emissions from burning "
            "fossil fuels, deforestation, and industrial agriculture. Carbon dioxide and methane "
            "trap heat in the atmosphere, raising average global temperatures and shifting "
            "weather patterns. Mitigation requires both reducing emissions and removing carbon "
            "from the atmosphere."
        ),
    },
    {
        "url": "https://symbolic.local/docs/pagerank",
        "title": "PageRank: ranking the web by link structure",
        "host": "symbolic.local",
        "text": (
            "PageRank is the algorithm Google originally used to rank web pages by analyzing "
            "the graph of hyperlinks. A page's rank is the probability that a random surfer, "
            "following links uniformly at random and occasionally teleporting, lands on it. "
            "PageRank is computed by iterating a power method over the link matrix until it "
            "converges. It is one of many features in modern search ranking."
        ),
    },
    {
        "url": "https://symbolic.local/docs/bm25",
        "title": "Okapi BM25 — a ranking function for information retrieval",
        "host": "symbolic.local",
        "text": (
            "BM25 is a probabilistic ranking function used in information retrieval. It scores "
            "a document with respect to a query as a saturating function of term frequency, "
            "weighted by inverse document frequency, with a length normalization term. BM25 "
            "remains a strong baseline even compared to neural retrievers and is often "
            "combined with embeddings in hybrid search systems like SYMBOLIC."
        ),
    },
    {
        "url": "https://symbolic.local/docs/rankbrain",
        "title": "RankBrain: machine learning in Google search",
        "host": "symbolic.local",
        "text": (
            "RankBrain is a machine-learning ranking signal Google introduced in 2015. "
            "It maps queries into vector embeddings so that never-before-seen queries can be "
            "matched against semantically similar past queries and documents. RankBrain is one "
            "of many signals used by the search ranker, alongside classical lexical features."
        ),
    },
    {
        "url": "https://symbolic.local/docs/embedding",
        "title": "Sentence embeddings with transformer models",
        "host": "symbolic.local",
        "text": (
            "Sentence embeddings encode entire sentences into fixed-length vectors so that "
            "semantically similar sentences land near each other in vector space. Models such "
            "as MiniLM and MPNet, fine-tuned with contrastive losses, are widely used. "
            "Cosine similarity over normalized embeddings approximates semantic relatedness "
            "and powers retrieval, clustering, and reranking."
        ),
    },
    {
        "url": "https://symbolic.local/docs/lambdamart",
        "title": "LambdaMART learning-to-rank",
        "host": "symbolic.local",
        "text": (
            "LambdaMART is a learning-to-rank algorithm based on gradient-boosted decision "
            "trees that directly optimizes information retrieval metrics like NDCG. Each "
            "candidate document is represented as a feature vector — BM25, cosine similarity, "
            "freshness, link counts — and the model learns to rank them within a query group. "
            "LightGBM provides a fast implementation."
        ),
    },
]


def main() -> None:
    print("Seeding SYMBOLIC demo corpus...")
    idx = Index()
    ids = idx.add_documents(DEMO_DOCS)
    idx.persist()
    print(f"Indexed {len(ids)} demo docs. Total docs in index: {idx.store.count_documents()}.")
    print(f"Vectors: {idx.vec_index.size()}, BM25 docs: {idx.bm25.n_docs()}")
    print("Done. Start the API with `python scripts/run_all.py` and try queries.")


if __name__ == "__main__":
    main()
