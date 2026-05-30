"""Text normalization and tokenization."""
from __future__ import annotations

import re
import unicodedata

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")

# Minimal English stopword list. Kept short to preserve recall for short queries.
STOPWORDS = frozenset({
    "a", "an", "the", "and", "or", "but", "if", "then", "of", "to", "in", "on",
    "for", "is", "are", "was", "were", "be", "been", "being", "with", "as", "at",
    "by", "from", "this", "that", "these", "those", "it", "its", "i", "you",
})


def normalize(s: str) -> str:
    """Lowercase + NFKD-strip-accents."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()


def tokenize(s: str, drop_stopwords: bool = True) -> list[str]:
    """Tokenize into lowercase alphanumeric tokens."""
    s = normalize(s)
    toks = _TOKEN_RE.findall(s)
    if drop_stopwords:
        toks = [t for t in toks if t not in STOPWORDS]
    return toks


def make_snippet(text: str, query_terms: list[str], max_len: int = 220) -> str:
    """Pick a window of `text` around the first matched query term.

    Falls back to the leading window if no term matches.
    """
    if not text:
        return ""
    norm = normalize(text)
    best_pos = -1
    for term in query_terms:
        pos = norm.find(term)
        if pos != -1 and (best_pos == -1 or pos < best_pos):
            best_pos = pos
    if best_pos == -1:
        return text[:max_len].strip() + ("..." if len(text) > max_len else "")
    start = max(0, best_pos - max_len // 3)
    end = min(len(text), start + max_len)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet
