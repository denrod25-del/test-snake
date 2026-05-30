"""Polite web crawler.

Educational scope: BFS from a seed list, robots.txt respected, optional
domain restriction, configurable depth, page count, and delay. Pages are
fetched with httpx, parsed with BeautifulSoup, and stored as
(url, title, text). Outgoing links between fetched pages are recorded as
the link graph.

This is NOT a production crawler. No JavaScript rendering, no sitemaps,
no priority queue, no distributed coordination.
"""
from __future__ import annotations

import asyncio
import logging
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from .indexer import invalidate
from .storage import Storage

log = logging.getLogger(__name__)

USER_AGENT = "SearchLabBot/0.1 (educational; +https://example.local/searchlab)"


class _RobotsCache:
    def __init__(self) -> None:
        self._cache: dict[str, RobotFileParser] = {}

    async def allowed(self, client: httpx.AsyncClient, url: str) -> bool:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self._cache:
            rp = RobotFileParser()
            try:
                resp = await client.get(f"{origin}/robots.txt", timeout=5.0)
                if resp.status_code == 200:
                    rp.parse(resp.text.splitlines())
                else:
                    rp.parse([])
            except Exception:  # noqa: BLE001
                rp.parse([])
            self._cache[origin] = rp
        return self._cache[origin].can_fetch(USER_AGENT, url)


def _extract(html: str, base_url: str) -> tuple[str, str, list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.string.strip() if soup.title and soup.title.string else "") or base_url
    for bad in soup(["script", "style", "noscript"]):
        bad.decompose()
    text = " ".join(soup.get_text(" ").split())
    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href, _ = urldefrag(urljoin(base_url, a["href"]))
        if href.startswith(("http://", "https://")):
            links.append(href)
    return title[:300], text[:50_000], list(dict.fromkeys(links))


async def _crawl_async(
    storage: Storage,
    *,
    corpus_name: str,
    seeds: list[str],
    max_pages: int,
    max_depth: int,
    same_domain_only: bool,
    delay_ms: int,
) -> dict:
    corpus_id = storage.get_or_create_corpus(
        corpus_name, description=f"Crawled from {len(seeds)} seed(s)."
    )

    robots = _RobotsCache()
    visited: set[str] = set()
    queue: list[tuple[str, int]] = [(s, 0) for s in seeds]
    pages: dict[str, dict] = {}  # url -> {doc_id, links}
    seed_domains = {urlparse(s).netloc for s in seeds}

    headers = {"User-Agent": USER_AGENT}
    timeout = httpx.Timeout(10.0)

    async with httpx.AsyncClient(headers=headers, timeout=timeout, follow_redirects=True) as client:
        while queue and len(pages) < max_pages:
            url, depth = queue.pop(0)
            url, _ = urldefrag(url)
            if url in visited:
                continue
            visited.add(url)

            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https"):
                continue
            if same_domain_only and parsed.netloc not in seed_domains:
                continue
            if not await robots.allowed(client, url):
                log.info("robots disallow: %s", url)
                continue

            try:
                resp = await client.get(url)
                if resp.status_code != 200 or "text/html" not in resp.headers.get("content-type", ""):
                    continue
                title, text, out_links = _extract(resp.text, base_url=str(resp.url))
            except Exception as e:  # noqa: BLE001
                log.info("fetch fail %s: %s", url, e)
                continue

            doc_id = storage.add_document(corpus_id, body=text, url=url, title=title)
            pages[url] = {"doc_id": doc_id, "links": out_links}

            if depth + 1 <= max_depth:
                for link in out_links:
                    if link not in visited:
                        queue.append((link, depth + 1))

            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000.0)

    n_links = 0
    for src_url, info in pages.items():
        for dst_url in info["links"]:
            if dst_url in pages:
                storage.add_link(corpus_id, info["doc_id"], pages[dst_url]["doc_id"])
                n_links += 1

    invalidate(corpus_id)
    return {
        "corpus_id": corpus_id,
        "name": corpus_name,
        "n_docs": len(pages),
        "n_links": n_links,
        "n_visited": len(visited),
    }


def crawl(
    storage: Storage,
    *,
    corpus_name: str,
    seeds: list[str],
    max_pages: int = 50,
    max_depth: int = 2,
    same_domain_only: bool = True,
    delay_ms: int = 200,
) -> dict:
    """Synchronous wrapper for the async crawler."""
    return asyncio.run(
        _crawl_async(
            storage,
            corpus_name=corpus_name,
            seeds=seeds,
            max_pages=max_pages,
            max_depth=max_depth,
            same_domain_only=same_domain_only,
            delay_ms=delay_ms,
        )
    )
