"""Synthetic corpus + link-graph generator for fast experimentation.

Two graph models:
- "scale_free": Barabasi-Albert preferential attachment, similar in spirit
  to real web link distributions.
- "small_world": Watts-Strogatz, useful for testing PageRank vs HITS.

Document text is sampled from a small topic vocabulary so queries about a
topic actually hit a coherent cluster. That makes the lab teachable.
"""
from __future__ import annotations

import random
from typing import Iterable

import networkx as nx

from .indexer import invalidate
from .storage import Storage

TOPICS: dict[str, list[str]] = {
    "search engines": [
        "search", "engine", "ranking", "index", "crawler", "query",
        "relevance", "retrieval", "tokenize", "page", "link", "graph",
    ],
    "machine learning": [
        "model", "train", "neural", "network", "gradient", "loss",
        "embedding", "feature", "vector", "tensor", "optimization", "data",
    ],
    "databases": [
        "database", "sql", "table", "row", "index", "query",
        "transaction", "schema", "join", "primary", "key", "storage",
    ],
    "web development": [
        "html", "css", "javascript", "browser", "frontend", "server",
        "request", "response", "api", "rest", "component", "render",
    ],
    "linear algebra": [
        "matrix", "vector", "eigenvalue", "eigenvector", "rank", "linear",
        "transformation", "basis", "norm", "dot", "product", "decomposition",
    ],
}

CONNECTORS = ["the", "a", "of", "and", "in", "is", "for", "with", "to", "on"]


def _generate_doc(topic: str, length: int, rng: random.Random) -> str:
    vocab = TOPICS[topic]
    words: list[str] = []
    for _ in range(length):
        if rng.random() < 0.6:
            words.append(rng.choice(vocab))
        else:
            words.append(rng.choice(CONNECTORS))
    return " ".join(words)


def _build_graph(n: int, kind: str, rng: random.Random) -> nx.DiGraph:
    if kind == "small_world":
        g = nx.watts_strogatz_graph(n=n, k=min(6, max(2, n - 1)), p=0.2, seed=rng.randint(0, 2**31))
    else:
        m = min(3, max(1, n - 1))
        g = nx.barabasi_albert_graph(n=n, m=m, seed=rng.randint(0, 2**31))
    dg = nx.DiGraph()
    dg.add_nodes_from(g.nodes)
    for u, v in g.edges:
        # Each undirected edge becomes a directed edge, with chance of also adding the reverse.
        dg.add_edge(u, v)
        if rng.random() < 0.3:
            dg.add_edge(v, u)
    return dg


def generate_corpus(
    storage: Storage,
    *,
    name: str,
    n_docs: int = 200,
    topics: Iterable[str] | None = None,
    graph_kind: str = "scale_free",
    seed: int = 42,
) -> dict:
    """Create a corpus with synthetic documents and a link graph."""
    rng = random.Random(seed)
    chosen_topics = list(topics) if topics else list(TOPICS.keys())
    chosen_topics = [t for t in chosen_topics if t in TOPICS] or list(TOPICS.keys())

    corpus_id = storage.get_or_create_corpus(name, description=f"Synthetic ({graph_kind}, {n_docs} docs)")

    # Map graph node index to a real document id.
    graph = _build_graph(n_docs, graph_kind, rng)
    node_to_doc: dict[int, int] = {}

    for node in graph.nodes:
        topic = chosen_topics[node % len(chosen_topics)]
        length = rng.randint(40, 120)
        body = _generate_doc(topic, length, rng)
        title = f"{topic.title()} #{node}"
        url = f"synthetic://{name}/{node}"
        doc_id = storage.add_document(corpus_id, body=body, url=url, title=title)
        node_to_doc[node] = doc_id

    for u, v in graph.edges:
        storage.add_link(corpus_id, node_to_doc[u], node_to_doc[v])

    invalidate(corpus_id)
    return {
        "corpus_id": corpus_id,
        "name": name,
        "n_docs": n_docs,
        "n_links": graph.number_of_edges(),
        "topics": chosen_topics,
        "graph_kind": graph_kind,
    }
