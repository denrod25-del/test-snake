"""Auto-discover ranking algorithms from `<project>/plugins/*.py`.

A plugin file is any .py file in the plugins directory that defines one or
more `RankingAlgorithm` subclasses. The registry also includes built-ins.
"""
from __future__ import annotations

import importlib
import importlib.util
import inspect
import logging
import sys
import traceback
from pathlib import Path

from .algorithms.base import RankingAlgorithm
from .algorithms.bm25 import BM25
from .algorithms.pagerank import HITS, HybridBM25PageRank, PageRank
from .algorithms.tfidf import TFIDF
from .config import PLUGINS_DIR

log = logging.getLogger(__name__)

_BUILTIN: list[type[RankingAlgorithm]] = [TFIDF, BM25, PageRank, HITS, HybridBM25PageRank]


class Registry:
    def __init__(self) -> None:
        self._classes: dict[str, type[RankingAlgorithm]] = {}
        self._errors: list[dict] = []

    def reload(self) -> None:
        self._classes.clear()
        self._errors.clear()

        for cls in _BUILTIN:
            self._register(cls, source="builtin")

        if PLUGINS_DIR.exists():
            for path in sorted(PLUGINS_DIR.glob("*.py")):
                if path.name.startswith("_"):
                    continue
                self._load_file(path)

    def _load_file(self, path: Path) -> None:
        mod_name = f"searchlab_plugin_{path.stem}"
        try:
            if mod_name in sys.modules:
                del sys.modules[mod_name]
            spec = importlib.util.spec_from_file_location(mod_name, path)
            if spec is None or spec.loader is None:
                raise ImportError(f"Cannot load spec for {path}")
            module = importlib.util.module_from_spec(spec)
            sys.modules[mod_name] = module
            spec.loader.exec_module(module)
        except Exception as e:  # noqa: BLE001
            self._errors.append(
                {"file": path.name, "error": str(e), "traceback": traceback.format_exc()}
            )
            log.warning("Plugin failed to load: %s: %s", path.name, e)
            return

        for _, obj in inspect.getmembers(module, inspect.isclass):
            if (
                issubclass(obj, RankingAlgorithm)
                and obj is not RankingAlgorithm
                and obj.__module__ == module.__name__
            ):
                self._register(obj, source=path.name)

    def _register(self, cls: type[RankingAlgorithm], *, source: str) -> None:
        try:
            instance = cls()
        except Exception as e:  # noqa: BLE001
            self._errors.append(
                {"class": cls.__name__, "error": f"instantiation failed: {e}"}
            )
            return
        name = instance.name
        if name in self._classes:
            log.warning("Algorithm name conflict: %s (overriding from %s)", name, source)
        self._classes[name] = cls

    def list_descriptors(self) -> list[dict]:
        out = []
        for name, cls in sorted(self._classes.items()):
            inst = cls()
            out.append(
                {
                    "name": name,
                    "description": inst.description,
                    "params": inst.params(),
                    "class": cls.__name__,
                    "module": cls.__module__,
                }
            )
        return out

    def instantiate(self, name: str, params: dict | None = None) -> RankingAlgorithm:
        if name not in self._classes:
            raise KeyError(f"Unknown algorithm: {name!r}")
        instance = self._classes[name]()
        if params:
            instance.configure(**params)
        return instance

    def errors(self) -> list[dict]:
        return list(self._errors)


_registry = Registry()


def get_registry() -> Registry:
    if not _registry._classes:
        _registry.reload()
    return _registry


def reload_registry() -> Registry:
    _registry.reload()
    return _registry
