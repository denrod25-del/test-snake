"""Ingest user-uploaded corpora as JSON or CSV.

JSON shape (preferred):
{
  "name": "my-corpus",
  "description": "...",
  "documents": [
    {"url": "...", "title": "...", "body": "...", "links": ["url-to-other-doc", ...]}
  ],
  "judgments": [
    {"query": "...", "url": "...", "relevance": 2}
  ]
}

CSV shape: a single file with columns
    url,title,body,links
where `links` is a "|"-separated list of URLs. Judgments are not supported
in the CSV path; use JSON for those.
"""
from __future__ import annotations

import csv
import io
import json
from typing import Any

from .indexer import invalidate
from .storage import Storage


def ingest_json(storage: Storage, payload: dict[str, Any]) -> dict:
    name = payload.get("name") or "uploaded"
    description = payload.get("description", "User-uploaded corpus")
    docs = payload.get("documents", [])
    judgments = payload.get("judgments", [])
    if not isinstance(docs, list):
        raise ValueError("'documents' must be a list")

    corpus_id = storage.get_or_create_corpus(name, description=description)
    url_to_id: dict[str, int] = {}
    for d in docs:
        if "body" not in d:
            raise ValueError("Each document needs a 'body'")
        url = d.get("url")
        doc_id = storage.add_document(
            corpus_id,
            body=d["body"],
            url=url,
            title=d.get("title"),
        )
        if url:
            url_to_id[url] = doc_id

    n_links = 0
    for d in docs:
        src_url = d.get("url")
        if not src_url or src_url not in url_to_id:
            continue
        for dst_url in d.get("links", []) or []:
            if dst_url in url_to_id:
                storage.add_link(corpus_id, url_to_id[src_url], url_to_id[dst_url])
                n_links += 1

    n_judged = 0
    for j in judgments or []:
        url = j.get("url")
        if url in url_to_id:
            storage.add_judgment(
                corpus_id,
                str(j.get("query", "")),
                url_to_id[url],
                int(j.get("relevance", 0)),
            )
            n_judged += 1

    invalidate(corpus_id)
    return {
        "corpus_id": corpus_id,
        "name": name,
        "n_docs": len(docs),
        "n_links": n_links,
        "n_judged": n_judged,
    }


def ingest_json_text(storage: Storage, text: str) -> dict:
    return ingest_json(storage, json.loads(text))


def ingest_csv(storage: Storage, text: str, *, name: str = "uploaded-csv") -> dict:
    corpus_id = storage.get_or_create_corpus(name, description="Uploaded CSV corpus")
    reader = csv.DictReader(io.StringIO(text))
    url_to_id: dict[str, int] = {}
    rows = list(reader)
    for row in rows:
        body = row.get("body") or ""
        if not body.strip():
            continue
        url = row.get("url") or None
        title = row.get("title") or None
        doc_id = storage.add_document(corpus_id, body=body, url=url, title=title)
        if url:
            url_to_id[url] = doc_id

    n_links = 0
    for row in rows:
        src_url = row.get("url")
        if not src_url or src_url not in url_to_id:
            continue
        for dst_url in (row.get("links") or "").split("|"):
            dst_url = dst_url.strip()
            if dst_url and dst_url in url_to_id:
                storage.add_link(corpus_id, url_to_id[src_url], url_to_id[dst_url])
                n_links += 1

    invalidate(corpus_id)
    return {
        "corpus_id": corpus_id,
        "name": name,
        "n_docs": len(url_to_id),
        "n_links": n_links,
    }
