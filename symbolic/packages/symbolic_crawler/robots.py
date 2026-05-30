"""Per-host robots.txt cache.

Uses the stdlib urllib.robotparser. Failures are treated as "allow" — same as
most production crawlers default. Add a deny-on-error policy if you want to be
more conservative.
"""
from __future__ import annotations

import urllib.robotparser as robotparser
from urllib.parse import urlparse

import httpx


class RobotsCache:
    def __init__(self, user_agent: str, client: httpx.AsyncClient) -> None:
        self.user_agent = user_agent
        self.client = client
        self._cache: dict[str, robotparser.RobotFileParser] = {}

    async def allowed(self, url: str) -> bool:
        u = urlparse(url)
        if u.scheme not in ("http", "https") or not u.netloc:
            return False
        host_key = f"{u.scheme}://{u.netloc}"
        rp = self._cache.get(host_key)
        if rp is None:
            rp = robotparser.RobotFileParser()
            robots_url = host_key + "/robots.txt"
            try:
                resp = await self.client.get(robots_url, timeout=10.0)
                if resp.status_code >= 400:
                    rp.parse([])  # treat as no rules
                else:
                    rp.parse(resp.text.splitlines())
            except Exception:
                rp.parse([])
            self._cache[host_key] = rp
        try:
            return rp.can_fetch(self.user_agent, url)
        except Exception:
            return True
