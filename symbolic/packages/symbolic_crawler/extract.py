"""HTML → (title, main_text, outlinks) extraction.

Uses selectolax (very fast). Strips script/style/nav-ish tags. Naively picks
the largest text-bearing block as the main content — good enough for an MVP
crawler; replace with a readability port for higher quality.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin, urldefrag, urlparse

from selectolax.parser import HTMLParser

_DROP_TAGS = ("script", "style", "noscript", "template", "svg", "form", "footer", "nav", "header", "aside")
_WS = re.compile(r"\s+")


def extract_main_text(html: str, base_url: str) -> tuple[str, str, list[str]]:
    """Return (title, main_text, outlinks). main_text already collapsed/whitespace-cleaned."""
    if not html:
        return "", "", []
    tree = HTMLParser(html)

    title_node = tree.css_first("title")
    title = (title_node.text(strip=True) if title_node else "")[:300]

    for tag in _DROP_TAGS:
        for node in tree.css(tag):
            node.decompose()

    # Find the densest text block: pick the body (or root) and grab text.
    body = tree.body or tree.root
    raw = body.text(separator=" ") if body else ""
    text = _WS.sub(" ", raw).strip()
    # Hard-cap to avoid storing huge pages.
    text = text[:20000]

    outlinks: list[str] = []
    seen: set[str] = set()
    for a in tree.css("a[href]"):
        href = a.attributes.get("href")
        if not href:
            continue
        href = href.strip()
        if not href or href.startswith(("javascript:", "mailto:", "#")):
            continue
        try:
            absu, _ = urldefrag(urljoin(base_url, href))
        except Exception:
            continue
        scheme = urlparse(absu).scheme
        if scheme not in ("http", "https"):
            continue
        if absu in seen:
            continue
        seen.add(absu)
        outlinks.append(absu)
        if len(outlinks) >= 200:
            break

    return title, text, outlinks
