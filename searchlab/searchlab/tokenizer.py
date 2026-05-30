"""Lightweight tokenization, stopword removal, and stemming.

Kept dependency-free on purpose so the lab is easy to inspect and extend.
A simple Porter-like suffix stripper handles common English endings; users
can plug in NLTK or spaCy later if they want.
"""
from __future__ import annotations

import re
from typing import Iterable

STOPWORDS: frozenset[str] = frozenset(
    """
    a an and are as at be by for from has have he her his i in is it its of on
    or that the their this to was were will with you your we us our they them
    but not no if then than so do does did just about into over under between
    out up down off again more most some any all each every other such who whom
    which what when where why how can could would should may might must shall
    been being been being am
    """.split()
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def normalize(text: str) -> str:
    return text.lower()


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(normalize(text))


def remove_stopwords(tokens: Iterable[str]) -> list[str]:
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


def stem(token: str) -> str:
    """Tiny suffix-stripping stemmer; not Porter-perfect, but deterministic.

    Strips common English suffixes in order of decreasing length. This is
    fine for an educational lab; swap with `nltk.PorterStemmer` for rigor.
    """
    for suf in ("ingly", "edly", "ing", "ed", "ly", "es", "s"):
        if len(token) > len(suf) + 2 and token.endswith(suf):
            return token[: -len(suf)]
    return token


def analyze(text: str, *, do_stem: bool = True, drop_stop: bool = True) -> list[str]:
    """Full pipeline: tokenize -> stopword removal -> stem."""
    toks = tokenize(text)
    if drop_stop:
        toks = remove_stopwords(toks)
    if do_stem:
        toks = [stem(t) for t in toks]
    return toks
