"""Built-in sample datasets ready to load.

The "ir-classics" corpus is a tiny hand-curated collection of documents
about information retrieval, search engines, and graph algorithms, with
inter-document references that form a meaningful link graph. It ships with
a handful of judged queries so the A/B framework has something to evaluate
out of the box.
"""
from __future__ import annotations

from .indexer import invalidate
from .storage import Storage

# (slug, title, body, links_to_slugs)
_IR_DOCS: list[tuple[str, str, str, list[str]]] = [
    (
        "pagerank",
        "PageRank: Authority on the Web",
        """PageRank is a link analysis algorithm that assigns a numerical weight
        to each document in a hyperlinked set, with the purpose of measuring its
        relative importance. It models a random surfer who follows links and
        teleports with probability one minus damping. PageRank powered Google
        search and changed how relevance and authority were combined.""",
        ["hits", "random-surfer", "google-search", "search-engine-design"],
    ),
    (
        "hits",
        "HITS: Hubs and Authorities",
        """The HITS algorithm by Kleinberg identifies hubs and authorities in a
        link graph. Hubs point to many good authorities, and authorities are
        pointed to by many good hubs. HITS is query-dependent: it builds a base
        set of pages relevant to the query and then iterates.""",
        ["pagerank", "search-engine-design"],
    ),
    (
        "random-surfer",
        "The Random Surfer Model",
        """The random surfer is a stochastic model used to motivate PageRank.
        At each step the surfer either follows a random outgoing link with
        probability d, or teleports to a random page with probability 1-d.
        The stationary distribution of this Markov chain is the PageRank
        vector.""",
        ["pagerank", "markov-chains"],
    ),
    (
        "tfidf",
        "TF-IDF and the Vector Space Model",
        """TF-IDF weights terms by how often they occur in a document and how
        rare they are across the collection. Documents and queries are vectors
        in a high-dimensional term space, and similarity is measured by the
        cosine of the angle between them. TF-IDF is the foundation of many
        retrieval systems.""",
        ["bm25", "vector-space", "search-engine-design"],
    ),
    (
        "bm25",
        "Okapi BM25: The Probabilistic Workhorse",
        """BM25 is a probabilistic ranking function that improves on TF-IDF by
        saturating the term frequency contribution and normalizing for document
        length. It has two tunable parameters, k1 and b, and is the default
        ranker in Lucene and Elasticsearch.""",
        ["tfidf", "vector-space", "search-engine-design"],
    ),
    (
        "vector-space",
        "Vector Space Models for Information Retrieval",
        """In the vector space model, documents and queries are points in a
        space whose dimensions correspond to terms. Ranking is done by
        computing a similarity, typically cosine similarity, between the query
        vector and each document vector. Modern dense retrieval replaces the
        sparse term axes with learned embeddings.""",
        ["tfidf", "bm25", "embeddings"],
    ),
    (
        "embeddings",
        "Dense Embeddings and Semantic Search",
        """Dense embeddings map text into a continuous vector space where
        semantic similarity corresponds to vector proximity. Approximate
        nearest neighbor structures like HNSW make retrieval over millions of
        vectors fast. Combined with a sparse signal, dense retrieval drives
        modern search.""",
        ["vector-space", "search-engine-design"],
    ),
    (
        "search-engine-design",
        "Anatomy of a Modern Search Engine",
        """A search engine ingests documents through a crawler, parses and
        tokenizes them, builds an inverted index, computes static signals like
        PageRank, ranks documents at query time using a blend of features, and
        finally re-ranks the top set with a learned model. The whole pipeline
        is observed and tuned with offline evaluation and online experiments.""",
        ["pagerank", "hits", "tfidf", "bm25", "embeddings", "evaluation", "crawling"],
    ),
    (
        "evaluation",
        "Evaluating Ranked Retrieval",
        """Ranked retrieval is evaluated with measures that account for rank
        position. Precision at k, mean average precision, mean reciprocal
        rank, and normalized discounted cumulative gain are standard offline
        metrics. They require human relevance judgments, sometimes called
        qrels.""",
        ["search-engine-design"],
    ),
    (
        "crawling",
        "Web Crawling and Politeness",
        """A crawler discovers documents by following links from a seed set.
        It must respect robots.txt, rate limits, and avoid traps. The crawler
        feeds the indexer; without it, there is nothing to rank.""",
        ["search-engine-design"],
    ),
    (
        "google-search",
        "Google Search: A Brief History",
        """Google began as a research project on the link structure of the
        web. Its early breakthrough was combining content relevance with
        PageRank-derived authority. Today it relies on hundreds of signals,
        many of them learned, but the link graph remains foundational.""",
        ["pagerank", "search-engine-design"],
    ),
    (
        "markov-chains",
        "Markov Chains and Stationary Distributions",
        """A Markov chain is a stochastic process that transitions between
        states according to fixed probabilities. The stationary distribution
        is the long-run probability of being in each state. PageRank can be
        understood as the stationary distribution of a particular Markov
        chain on the web graph.""",
        ["random-surfer", "pagerank"],
    ),
]

_JUDGMENTS: dict[str, dict[str, int]] = {
    "pagerank": {
        "pagerank": 3, "random-surfer": 3, "google-search": 2,
        "markov-chains": 2, "hits": 1, "search-engine-design": 1,
    },
    "ranking algorithms": {
        "pagerank": 3, "hits": 3, "bm25": 3, "tfidf": 2,
        "search-engine-design": 2, "vector-space": 2, "evaluation": 1,
    },
    "vector space search": {
        "vector-space": 3, "tfidf": 3, "bm25": 2, "embeddings": 2,
    },
    "evaluating search quality": {
        "evaluation": 3, "search-engine-design": 1,
    },
}


def load_ir_classics(storage: Storage, *, name: str = "ir-classics") -> dict:
    corpus_id = storage.get_or_create_corpus(
        name, description="Hand-curated mini corpus on information retrieval."
    )

    slug_to_id: dict[str, int] = {}
    for slug, title, body, _ in _IR_DOCS:
        doc_id = storage.add_document(
            corpus_id,
            body=body,
            url=f"sample://ir-classics/{slug}",
            title=title,
        )
        slug_to_id[slug] = doc_id

    n_links = 0
    for slug, _, _, dst_slugs in _IR_DOCS:
        for dst in dst_slugs:
            if dst in slug_to_id:
                storage.add_link(corpus_id, slug_to_id[slug], slug_to_id[dst])
                n_links += 1

    for query, qrels in _JUDGMENTS.items():
        for slug, rel in qrels.items():
            if slug in slug_to_id:
                storage.add_judgment(corpus_id, query, slug_to_id[slug], rel)

    invalidate(corpus_id)
    return {
        "corpus_id": corpus_id,
        "name": name,
        "n_docs": len(_IR_DOCS),
        "n_links": n_links,
        "n_judged_queries": len(_JUDGMENTS),
    }
