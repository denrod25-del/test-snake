"""Polite async web crawler.

Pulls URLs from the SQLite frontier (DocumentStore), respects robots.txt,
applies a per-host delay, indexes pages into the Index, and enqueues outlinks
up to a max depth.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx
import tldextract

from symbolic_index import Index

from .extract import extract_main_text
from .robots import RobotsCache

log = logging.getLogger("symbolic.crawler")


@dataclass
class CrawlConfig:
    user_agent: str = field(
        default_factory=lambda: os.getenv(
            "SYMBOLIC_CRAWL_USER_AGENT",
            "SymbolicBot/0.1 (+https://symbolic.example/bot)",
        )
    )
    concurrency: int = field(
        default_factory=lambda: int(os.getenv("SYMBOLIC_CRAWL_CONCURRENCY", "8"))
    )
    per_host_delay: float = field(
        default_factory=lambda: float(os.getenv("SYMBOLIC_CRAWL_DELAY_SECS", "1.0"))
    )
    max_depth: int = 2
    max_pages: int = 200
    same_host_only: bool = False
    timeout: float = 15.0


def _host_of(url: str) -> str:
    p = urlparse(url)
    if not p.netloc:
        return ""
    ext = tldextract.extract(url)
    return ".".join(p for p in [ext.subdomain, ext.domain, ext.suffix] if p) or p.netloc


class Crawler:
    def __init__(self, index: Index, config: CrawlConfig | None = None) -> None:
        self.index = index
        self.cfg = config or CrawlConfig()
        self._last_hit: dict[str, float] = {}
        self._lock = asyncio.Lock()
        self._fetched = 0

    def seed(self, urls: list[str]) -> int:
        added = 0
        for url in urls:
            host = _host_of(url)
            if not host:
                continue
            if self.index.store.enqueue(url, host, depth=0):
                added += 1
        return added

    async def run(self) -> dict:
        headers = {"User-Agent": self.cfg.user_agent, "Accept": "text/html,*/*;q=0.5"}
        limits = httpx.Limits(max_connections=self.cfg.concurrency * 2)
        timeout = httpx.Timeout(self.cfg.timeout)
        async with httpx.AsyncClient(
            headers=headers, limits=limits, follow_redirects=True, timeout=timeout
        ) as client:
            robots = RobotsCache(self.cfg.user_agent, client)
            sem = asyncio.Semaphore(self.cfg.concurrency)
            self._fetched = 0
            while self._fetched < self.cfg.max_pages:
                pending = self.index.store.next_pending(batch=self.cfg.concurrency * 4)
                if not pending:
                    break
                tasks = [
                    asyncio.create_task(self._fetch_one(client, robots, sem, url, host, depth))
                    for url, host, depth in pending
                    if self._fetched < self.cfg.max_pages
                ]
                if not tasks:
                    break
                await asyncio.gather(*tasks, return_exceptions=True)
        self.index.persist()
        return {
            "fetched": self._fetched,
            "documents": self.index.store.count_documents(),
            "frontier": self.index.store.frontier_stats(),
        }

    async def _fetch_one(
        self,
        client: httpx.AsyncClient,
        robots: RobotsCache,
        sem: asyncio.Semaphore,
        url: str,
        host: str,
        depth: int,
    ) -> None:
        if self._fetched >= self.cfg.max_pages:
            return
        async with sem:
            # Per-host courtesy delay
            async with self._lock:
                last = self._last_hit.get(host, 0.0)
                wait = self.cfg.per_host_delay - (time.time() - last)
                if wait > 0:
                    await asyncio.sleep(wait)
                self._last_hit[host] = time.time()

            try:
                if not await robots.allowed(url):
                    self.index.store.mark_fetched(url, ok=False)
                    log.info("robots-disallow %s", url)
                    return
                resp = await client.get(url)
                if resp.status_code != 200:
                    self.index.store.mark_fetched(url, ok=False)
                    return
                ctype = resp.headers.get("content-type", "")
                if "html" not in ctype and "text" not in ctype:
                    self.index.store.mark_fetched(url, ok=False)
                    return
                html = resp.text
            except Exception as exc:
                log.warning("fetch-fail %s: %s", url, exc)
                self.index.store.mark_fetched(url, ok=False)
                return

            title, text, outlinks = extract_main_text(html, base_url=str(resp.url))
            if not text or len(text) < 80:
                self.index.store.mark_fetched(url, ok=False)
                return

            inlinks_now = self.index.store.inlink_count(str(resp.url))
            try:
                self.index.add_document(
                    url=str(resp.url),
                    title=title,
                    text=text,
                    host=host,
                    inlinks=inlinks_now,
                )
            except Exception as exc:
                log.warning("index-fail %s: %s", url, exc)
                self.index.store.mark_fetched(url, ok=False)
                return

            self.index.store.mark_fetched(url, ok=True)
            self._fetched += 1

            # Enqueue outlinks
            if depth + 1 <= self.cfg.max_depth:
                for o in outlinks:
                    o_host = _host_of(o)
                    if not o_host:
                        continue
                    if self.cfg.same_host_only and o_host != host:
                        continue
                    self.index.store.add_edge(url, o)
                    self.index.store.enqueue(o, o_host, depth=depth + 1)
