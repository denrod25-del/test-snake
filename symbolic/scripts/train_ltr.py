"""Pull click data from symbolic_analytics, recompute features, train LightGBM
LambdaMART, save the model so the API picks it up on the next reload.

Run: python scripts/train_ltr.py
"""
from __future__ import annotations

import math
import os
import sys
import time
from pathlib import Path

import httpx
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packages"))

from symbolic_core import Features, LTRReranker  # noqa: E402
from symbolic_core.text import normalize, tokenize  # noqa: E402
from symbolic_index import Index  # noqa: E402


ANALYTICS_URL = os.getenv("SYMBOLIC_ANALYTICS_URL", "http://localhost:8002")


def _features_for(query: str, doc, q_terms: list[str], idx: Index) -> Features:
    bm25 = idx.bm25.score(query, doc.doc_id)
    qvec = idx.embedder.encode(query)
    dvec = idx.fetch_doc_vec(doc.doc_id)
    cosine = float(np.dot(qvec, dvec)) if dvec is not None else 0.0
    title_n = normalize(doc.title or "")
    url_n = normalize(doc.url or "")
    title_match = 1.0 if any(t in title_n for t in q_terms) else 0.0
    url_match = 1.0 if any(t in url_n for t in q_terms) else 0.0
    age = max(0.0, (time.time() - (doc.crawled_at or time.time())) / 86400.0)
    return Features(
        bm25=float(bm25),
        cosine=cosine,
        title_match=title_match,
        url_match=url_match,
        log_doc_len=math.log(max(1, len(doc.text or ""))),
        log_freshness_days=math.log(1.0 + age),
        log_inlinks=math.log(1.0 + max(0, doc.inlinks)),
    )


def main() -> None:
    print("Fetching training pairs from analytics...")
    try:
        r = httpx.get(f"{ANALYTICS_URL}/training/pairs", timeout=10.0)
        r.raise_for_status()
        pairs = r.json().get("pairs", [])
    except Exception as e:
        print(f"Could not reach analytics service: {e}")
        return

    if not pairs:
        print("No training data yet. Run some searches and click results, then try again.")
        return

    idx = Index()
    feats: list[list[float]] = []
    labels: list[int] = []
    groups: list[int] = []

    for p in pairs:
        q = p["query"]
        q_terms = tokenize(q)
        group_size = 0
        for d in p["docs"]:
            doc = idx.fetch_doc(d["doc_id"])
            if doc is None:
                continue
            f = _features_for(q, doc, q_terms, idx)
            feats.append(f.to_list())
            labels.append(int(d["label"]))
            group_size += 1
        if group_size > 0:
            groups.append(group_size)

    if not feats:
        print("No usable training rows.")
        return

    print(f"Training LambdaMART on {len(feats)} rows in {len(groups)} groups...")
    model = LTRReranker()
    model.fit(feats, labels, groups, num_boost_round=200)
    out = idx.data_dir / "ltr.txt"
    model.save(out)
    print(f"Saved LTR model to {out}. Restart the API to pick it up.")


if __name__ == "__main__":
    main()
