"""Scrape a business's website to extract emails, social handles, and
plumbing service keywords.

Best-effort only. Many sites block scrapers; we fail soft.
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)

# Skip junk / image-CDN emails
EMAIL_BLOCKLIST_SUFFIXES = (
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    "@sentry.io", "@wixpress.com", "@example.com",
)

SOCIAL_PATTERNS = {
    "facebook":  re.compile(r"https?://(?:www\.)?facebook\.com/[A-Za-z0-9._\-/]+"),
    "instagram": re.compile(r"https?://(?:www\.)?instagram\.com/[A-Za-z0-9._\-/]+"),
    "twitter":   re.compile(r"https?://(?:www\.)?(?:twitter|x)\.com/[A-Za-z0-9._\-/]+"),
    "linkedin":  re.compile(r"https?://(?:www\.)?linkedin\.com/[A-Za-z0-9._\-/]+"),
    "youtube":   re.compile(r"https?://(?:www\.)?youtube\.com/[A-Za-z0-9._\-/@]+"),
    "tiktok":    re.compile(r"https?://(?:www\.)?tiktok\.com/@[A-Za-z0-9._\-]+"),
    "yelp":      re.compile(r"https?://(?:www\.)?yelp\.com/biz/[A-Za-z0-9._\-]+"),
}

SERVICE_KEYWORDS = {
    "Emergency / 24-7":   [r"\b24[\s/-]?7\b", r"\b24 ?hour\b", r"emergency"],
    "Residential":         [r"residential"],
    "Commercial":          [r"commercial"],
    "Drain Cleaning":      [r"drain", r"clog", r"rooter"],
    "Water Heater":        [r"water heater", r"tankless"],
    "Sewer / Septic":      [r"sewer", r"septic"],
    "Leak Detection":      [r"leak detection", r"leak repair"],
    "Pipe / Repipe":       [r"repipe", r"pipe (?:repair|replacement)"],
    "Gas Lines":           [r"gas line"],
    "Backflow":            [r"backflow"],
    "Remodel / Install":   [r"remodel", r"installation"],
    "Slab Leak":           [r"slab leak"],
    "Hydro Jetting":       [r"hydro[\s-]?jet"],
    "Garbage Disposal":    [r"garbage disposal", r"disposal repair"],
}

CANDIDATE_PATHS = ("", "/contact", "/contact-us", "/about", "/about-us", "/services")


async def enrich_website(website: str, *, timeout: float = 10.0) -> dict[str, Any]:
    """Fetch the website + a couple common pages, extract enrichment data."""
    if not website:
        return {"emails": [], "socials": {}, "services": [], "fetched_pages": 0}

    parsed = urlparse(website)
    if not parsed.scheme:
        website = "https://" + website
        parsed = urlparse(website)

    base = f"{parsed.scheme}://{parsed.netloc}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
    }

    all_text = ""
    all_html = ""
    fetched = 0

    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=True, headers=headers
    ) as client:
        for path in CANDIDATE_PATHS:
            url = urljoin(base + "/", path.lstrip("/"))
            try:
                r = await client.get(url)
                if r.status_code >= 400:
                    continue
                content_type = r.headers.get("content-type", "")
                if "html" not in content_type and not r.text.lstrip().startswith("<"):
                    continue
                fetched += 1
                all_html += "\n" + r.text
                soup = BeautifulSoup(r.text, "html.parser")
                for tag in soup(["script", "style", "noscript"]):
                    tag.decompose()
                all_text += "\n" + soup.get_text(" ", strip=True)
            except Exception:
                continue

    emails = sorted({
        e.lower() for e in EMAIL_RE.findall(all_html)
        if not any(e.lower().endswith(s) for s in EMAIL_BLOCKLIST_SUFFIXES)
    })

    socials: dict[str, str] = {}
    for net, pat in SOCIAL_PATTERNS.items():
        m = pat.search(all_html)
        if m:
            socials[net] = m.group(0).rstrip("/\"'")

    text_lower = all_text.lower()
    services: list[str] = []
    for label, patterns in SERVICE_KEYWORDS.items():
        if any(re.search(p, text_lower) for p in patterns):
            services.append(label)

    return {
        "emails": emails,
        "socials": socials,
        "services": services,
        "fetched_pages": fetched,
    }
