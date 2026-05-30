"""LightGBM LambdaMART learning-to-rank reranker.

Trained on click logs from symbolic_analytics: clicked docs become positives,
non-clicked impressed docs at the same query become negatives. Pure ranking
loss, so absolute scores are not calibrated — only relative ordering matters.
"""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

import numpy as np


class LTRReranker:
    def __init__(self) -> None:
        self._booster = None

    def is_trained(self) -> bool:
        return self._booster is not None

    def fit(
        self,
        features: Sequence[Sequence[float]],
        labels: Sequence[int],
        groups: Sequence[int],
        num_boost_round: int = 200,
    ) -> None:
        """Train the LambdaMART model.

        `features` is (N, F), `labels` is (N,) graded relevance (0/1/2/...),
        `groups` is the count of rows per query, summing to N.
        """
        import lightgbm as lgb

        X = np.asarray(features, dtype=np.float32)
        y = np.asarray(labels, dtype=np.int32)
        g = np.asarray(groups, dtype=np.int32)
        if X.shape[0] == 0 or g.sum() != X.shape[0]:
            raise ValueError("features rows must equal sum(groups)")

        dataset = lgb.Dataset(X, label=y, group=g)
        params = {
            "objective": "lambdarank",
            "metric": "ndcg",
            "ndcg_eval_at": [5, 10],
            "learning_rate": 0.05,
            "num_leaves": 31,
            "min_data_in_leaf": 1,
            "verbose": -1,
        }
        self._booster = lgb.train(params, dataset, num_boost_round=num_boost_round)

    def predict(self, features: Sequence[Sequence[float]]) -> np.ndarray:
        if self._booster is None:
            raise RuntimeError("model not trained")
        X = np.asarray(features, dtype=np.float32)
        return self._booster.predict(X)

    def save(self, path: str | Path) -> None:
        if self._booster is None:
            raise RuntimeError("model not trained")
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self._booster.save_model(str(path))

    @classmethod
    def load(cls, path: str | Path) -> "LTRReranker":
        import lightgbm as lgb

        m = cls()
        path = Path(path)
        if not path.exists():
            return m
        m._booster = lgb.Booster(model_file=str(path))
        return m
