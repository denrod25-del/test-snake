"""Base class for all ranking algorithms.

Subclass `RankingAlgorithm` and implement `score()`. Drop the file in
`<project>/plugins/` and it will be auto-discovered.

A `Result` is just a (doc_id, score, explanation) tuple. The explanation is
a plain dict that the UI renders verbatim, so use it to teach: include the
exact terms, IDFs, link weights, or any intermediate signal you used.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..indexer import CorpusIndex
from ..tokenizer import analyze


@dataclass
class Result:
    doc_id: int
    score: float
    explanation: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {"doc_id": self.doc_id, "score": self.score, "explanation": self.explanation}


class RankingAlgorithm:
    """Base ranking algorithm.

    Subclasses MUST set `name` (unique, kebab-case recommended) and implement
    `score(query, index)` to return a list of `Result`. The framework will
    sort them and trim to top-k.

    Override `params` to expose tunable parameters to the UI/API. The default
    implementation reads `self.__dict__` and treats any non-underscore float/
    int/bool/str as a parameter; override for full control.
    """

    name: str = "unnamed"
    description: str = ""

    def score(self, query: str, index: CorpusIndex) -> list[Result]:
        raise NotImplementedError

    def params(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k, v in self.__dict__.items():
            if k.startswith("_"):
                continue
            if isinstance(v, (int, float, bool, str)):
                out[k] = v
        return out

    def configure(self, **kwargs: Any) -> "RankingAlgorithm":
        """Return self with parameters updated. Unknown keys are ignored."""
        for k, v in kwargs.items():
            if hasattr(self, k):
                setattr(self, k, v)
        return self

    @staticmethod
    def query_terms(query: str) -> list[str]:
        return analyze(query)
