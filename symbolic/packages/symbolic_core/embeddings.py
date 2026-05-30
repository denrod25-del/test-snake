"""Sentence-transformers wrapper. Lazy-loaded so importing the module is cheap."""
from __future__ import annotations

import os
from typing import Iterable

import numpy as np


class Embedder:
    """Wraps a sentence-transformer model. Returns L2-normalized float32 vectors.

    Defaults to all-MiniLM-L6-v2 (384-d, ~80MB, runs on CPU).
    """

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or os.getenv(
            "SYMBOLIC_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
        self._model = None
        self._dim: int | None = None

    def _load(self) -> None:
        if self._model is not None:
            return
        # Imported lazily — heavy dependency.
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self.model_name)
        # `get_embedding_dimension` is the new name (sentence-transformers >=5);
        # fall back to the legacy name for older versions.
        get_dim = getattr(
            self._model, "get_embedding_dimension", None
        ) or self._model.get_sentence_embedding_dimension
        self._dim = int(get_dim())

    @property
    def dim(self) -> int:
        if self._dim is None:
            self._load()
        assert self._dim is not None
        return self._dim

    def encode(self, texts: str | Iterable[str], batch_size: int = 32) -> np.ndarray:
        self._load()
        assert self._model is not None
        single = isinstance(texts, str)
        if single:
            texts = [texts]
        else:
            texts = list(texts)
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        vecs = self._model.encode(
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        ).astype(np.float32)
        return vecs[0] if single else vecs
