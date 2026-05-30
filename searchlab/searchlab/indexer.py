"""In-memory inverted index built on demand from a corpus.

The index holds everything algorithms need: term postings, document lengths,
average length, total docs, and a NetworkX directed graph of links.

For medium-scale corpora (~100k docs) this fits comfortably in memory.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field

import networkx as nx

from .storage import Storage
from .tokenizer import analyze


@dataclass
class Posting:
    """Per-document posting: term frequency in that doc."""
    doc_id: int
    tf: int


@dataclass
class CorpusIndex:
    """Read-only snapshot of an indexed corpus.

    Algorithms receive an instance of this and should not mutate it.
    """
    corpus_id: int
    doc_ids: list[int]
    docs: dict[int, dict] = field(default_factory=dict)              # id -> {url,title,body,tokens}
    postings: dict[str, list[Posting]] = field(default_factory=dict) # term -> postings
    df: dict[str, int] = field(default_factory=dict)                 # term -> document frequency
    doc_len: dict[int, int] = field(default_factory=dict)            # id -> length in tokens
    avgdl: float = 0.0
    n_docs: int = 0
    graph: nx.DiGraph = field(default_factory=nx.DiGraph)

    def doc_tokens(self, doc_id: int) -> list[str]:
        return self.docs[doc_id]["tokens"]

    def doc_term_freq(self, doc_id: int) -> Counter:
        return Counter(self.docs[doc_id]["tokens"])


def build_index(storage: Storage, corpus_id: int) -> CorpusIndex:
    """Build an in-memory index for a corpus."""
    docs = storage.list_documents(corpus_id)
    links = storage.list_links(corpus_id)

    idx = CorpusIndex(corpus_id=corpus_id, doc_ids=[d["id"] for d in docs])
    postings: dict[str, list[Posting]] = defaultdict(list)
    df: Counter = Counter()
    total_len = 0

    for d in docs:
        text = f"{d.get('title') or ''} {d.get('body') or ''}"
        tokens = analyze(text)
        idx.docs[d["id"]] = {
            "url": d.get("url"),
            "title": d.get("title"),
            "body": d.get("body"),
            "tokens": tokens,
        }
        idx.doc_len[d["id"]] = len(tokens)
        total_len += len(tokens)

        tf = Counter(tokens)
        for term, freq in tf.items():
            postings[term].append(Posting(doc_id=d["id"], tf=freq))
            df[term] += 1

    idx.postings = dict(postings)
    idx.df = dict(df)
    idx.n_docs = len(docs)
    idx.avgdl = (total_len / len(docs)) if docs else 0.0

    g = nx.DiGraph()
    g.add_nodes_from(idx.doc_ids)
    g.add_edges_from(links)
    idx.graph = g

    return idx


# ---- on-demand cache ---------------------------------------------------
_CACHE: dict[int, CorpusIndex] = {}


def get_index(storage: Storage, corpus_id: int, *, force: bool = False) -> CorpusIndex:
    if force or corpus_id not in _CACHE:
        _CACHE[corpus_id] = build_index(storage, corpus_id)
    return _CACHE[corpus_id]


def invalidate(corpus_id: int | None = None) -> None:
    if corpus_id is None:
        _CACHE.clear()
    else:
        _CACHE.pop(corpus_id, None)
