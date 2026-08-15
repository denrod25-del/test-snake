"""Shared HTTP plumbing for every upstream fetcher.

Three things every source here needs and none of them should reimplement:

* **Retry with backoff.** EPA's Envirofacts service intermittently 500s and
  times out on large pages; a single failed page should not abandon a county.
* **A disk cache.** An ingest run pulls thousands of pages. Caching by URL makes
  a re-run after a normalizer bug fix nearly free, and lets the normalizers be
  developed against real payloads without hammering a public agency's servers.
* **An honest failure type.** `SourceUnavailable` distinguishes "the network
  refused us" from "the source returned nothing". The first must surface as a
  `blocked`/`broken` dataset status; the second is a legitimately empty result.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

log = logging.getLogger(__name__)

DEFAULT_TIMEOUT = (15, 120)  # (connect, read) seconds
DEFAULT_RETRIES = 4
USER_AGENT = os.getenv(
    "FWQ_USER_AGENT",
    "FloridaWaterQualityAPI/0.1 (public-data aggregation; contact via repository)",
)

#: Cache root. Kept outside `data/` so raw upstream payloads are not committed.
CACHE_DIR = Path(os.getenv("FWQ_CACHE_DIR", Path(__file__).resolve().parents[2] / ".cache"))


class SourceUnavailable(RuntimeError):
    """The upstream source could not be reached at all.

    Distinct from an empty response. Raised after retries are exhausted, and on
    egress-policy denials, so the caller can mark the dataset `blocked` or
    `broken` rather than silently publishing a shorter list.
    """

    def __init__(self, url: str, reason: str) -> None:
        super().__init__(f"{url}: {reason}")
        self.url = url
        self.reason = reason


@dataclass
class FetchStats:
    """Per-run counters, surfaced in the ingest report."""

    requests: int = 0
    cache_hits: int = 0
    retries: int = 0
    failures: int = 0

    def to_dict(self) -> dict[str, int]:
        return {
            "requests": self.requests,
            "cacheHits": self.cache_hits,
            "retries": self.retries,
            "failures": self.failures,
        }


class Client:
    """A caching, retrying HTTP client scoped to one ingest run."""

    def __init__(
        self,
        *,
        cache_dir: Path | None = None,
        use_cache: bool = True,
        cache_ttl_hours: float = 24.0,
        timeout: tuple[int, int] = DEFAULT_TIMEOUT,
        retries: int = DEFAULT_RETRIES,
        rate_limit_sec: float = 0.0,
    ) -> None:
        self.cache_dir = Path(cache_dir or CACHE_DIR)
        self.use_cache = use_cache
        self.cache_ttl_hours = cache_ttl_hours
        self.timeout = timeout
        self.retries = retries
        self.rate_limit_sec = rate_limit_sec
        self.stats = FetchStats()
        self._last_request_at = 0.0
        self._session = requests.Session()
        self._session.headers.update(
            {"User-Agent": USER_AGENT, "Accept": "application/json, text/html, */*"}
        )

    # -- cache -------------------------------------------------------------

    def _cache_path(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:32]
        return self.cache_dir / digest[:2] / f"{digest}.json"

    def _read_cache(self, url: str) -> Any | None:
        if not self.use_cache:
            return None
        path = self._cache_path(url)
        if not path.exists():
            return None
        age_hours = (time.time() - path.stat().st_mtime) / 3600
        if age_hours > self.cache_ttl_hours:
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        self.stats.cache_hits += 1
        return payload["body"]

    def _write_cache(self, url: str, body: Any) -> None:
        if not self.use_cache:
            return
        path = self._cache_path(url)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            path.write_text(
                json.dumps({"url": url, "fetched": time.time(), "body": body}),
                encoding="utf-8",
            )
        except OSError as exc:  # a full disk should not abort an ingest
            log.warning("cache write failed for %s: %s", url, exc)

    def _throttle(self) -> None:
        if self.rate_limit_sec <= 0:
            return
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.rate_limit_sec:
            time.sleep(self.rate_limit_sec - elapsed)
        self._last_request_at = time.monotonic()

    # -- fetch -------------------------------------------------------------

    def get_json(self, url: str, *, empty_on_404: bool = True) -> Any:
        """GET a JSON document, with cache and retry.

        Envirofacts answers 404 for an empty result set rather than returning
        `[]`, so `empty_on_404` maps that to an empty list by default.
        """
        cached = self._read_cache(url)
        if cached is not None:
            return cached

        last_error = "unknown"
        for attempt in range(self.retries):
            self._throttle()
            self.stats.requests += 1
            try:
                resp = self._session.get(url, timeout=self.timeout)
            except requests.RequestException as exc:
                last_error = f"{type(exc).__name__}: {exc}"
            else:
                if resp.status_code == 404 and empty_on_404:
                    self._write_cache(url, [])
                    return []
                if resp.status_code in (403, 407):
                    # Egress-policy denial or upstream refusal. Retrying will
                    # not help and hammering a public agency after a 403 is
                    # exactly the behaviour that earns a permanent block.
                    self.stats.failures += 1
                    raise SourceUnavailable(
                        url, f"HTTP {resp.status_code} (access denied, not retried)"
                    )
                if resp.ok:
                    try:
                        body = resp.json()
                    except ValueError as exc:
                        last_error = f"invalid JSON: {exc}"
                    else:
                        self._write_cache(url, body)
                        return body
                else:
                    last_error = f"HTTP {resp.status_code}"

            if attempt < self.retries - 1:
                self.stats.retries += 1
                time.sleep(2 ** attempt)

        self.stats.failures += 1
        raise SourceUnavailable(url, f"failed after {self.retries} attempts: {last_error}")

    def get_bytes(self, url: str) -> bytes:
        """GET a binary document (used for CCR PDFs). Not JSON-cached."""
        last_error = "unknown"
        for attempt in range(self.retries):
            self._throttle()
            self.stats.requests += 1
            try:
                resp = self._session.get(url, timeout=self.timeout)
            except requests.RequestException as exc:
                last_error = f"{type(exc).__name__}: {exc}"
            else:
                if resp.status_code in (403, 407):
                    self.stats.failures += 1
                    raise SourceUnavailable(
                        url, f"HTTP {resp.status_code} (access denied, not retried)"
                    )
                if resp.ok:
                    return resp.content
                last_error = f"HTTP {resp.status_code}"
            if attempt < self.retries - 1:
                self.stats.retries += 1
                time.sleep(2 ** attempt)
        self.stats.failures += 1
        raise SourceUnavailable(url, f"failed after {self.retries} attempts: {last_error}")

    def get_text(self, url: str) -> str:
        return self.get_bytes(url).decode("utf-8", errors="replace")

    def probe(self, url: str) -> dict[str, Any]:
        """Check reachability without raising. Used by `fwq probe`."""
        started = time.monotonic()
        try:
            self._throttle()
            self.stats.requests += 1
            resp = self._session.get(url, timeout=(10, 30), stream=True)
            reachable = resp.ok
            status: int | None = resp.status_code
            detail = resp.reason or ""
            resp.close()
        except requests.RequestException as exc:
            reachable, status, detail = False, None, f"{type(exc).__name__}: {exc}"
        return {
            "url": url,
            "reachable": reachable,
            "httpStatus": status,
            "detail": detail,
            "elapsedMs": round((time.monotonic() - started) * 1000),
        }

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "Client":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
