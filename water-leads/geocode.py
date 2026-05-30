"""Light ZIP-centroid geocoder.

Primary source: Zippopotam.us (https://api.zippopotam.us/us/33404) — free,
no key, no rate-limit headaches, returns the ZIP's canonical place centroid.

Fallback: Nominatim (OpenStreetMap). Useful if the user overrides the base
or wants non-US coverage, but note Nominatim blocks most default clients.

Results are cached in SQLite after the first lookup so subsequent map loads
are instant.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx

import db

ZIPPOPOTAM_URL = os.getenv("ZIPPOPOTAM_URL", "https://api.zippopotam.us/us")
NOMINATIM_URL = os.getenv(
    "NOMINATIM_URL", "https://nominatim.openstreetmap.org/search"
)
USER_AGENT = os.getenv(
    "GEOCODE_USER_AGENT", "water-leads/1.0 (https://github.com/local)"
)
RATE_LIMIT_SLEEP = float(os.getenv("GEOCODE_SLEEP", "0.2"))
COUNTRY_CODE = os.getenv("GEOCODE_COUNTRY", "us")
MAX_FAILURES = 3

_lock = asyncio.Lock()


async def resolve_zip(
    client: httpx.AsyncClient, zip_code: str
) -> dict[str, Any] | None:
    """Return cached centroid if known, else hit a geocoder and cache it."""
    zip_code = (zip_code or "").strip()
    if not zip_code:
        return None

    cached = db.get_centroid(zip_code)
    if cached and cached.get("lat") is not None and cached.get("lon") is not None:
        return cached
    if cached and (cached.get("failed_attempts") or 0) >= MAX_FAILURES:
        return cached

    async with _lock:
        ok = await _zippopotam(client, zip_code)
        if not ok:
            await _nominatim(client, zip_code)
    await asyncio.sleep(RATE_LIMIT_SLEEP)
    return db.get_centroid(zip_code)


async def _zippopotam(client: httpx.AsyncClient, zip_code: str) -> bool:
    url = f"{ZIPPOPOTAM_URL}/{zip_code}"
    try:
        r = await client.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=10.0,
        )
        if r.status_code == 404:
            return False
        if r.status_code >= 400:
            return False
        data = r.json()
    except (httpx.HTTPError, ValueError):
        return False

    places = data.get("places") if isinstance(data, dict) else None
    if not places:
        return False
    try:
        lat = float(places[0]["latitude"])
        lon = float(places[0]["longitude"])
    except (KeyError, TypeError, ValueError):
        return False
    display = f"{places[0].get('place name', '')}, {places[0].get('state abbreviation', '')}"
    db.put_centroid(zip_code, lat, lon, display.strip(", "), source="zippopotam")
    return True


async def _nominatim(client: httpx.AsyncClient, zip_code: str) -> None:
    try:
        r = await client.get(
            NOMINATIM_URL,
            params={
                "postalcode": zip_code,
                "country": COUNTRY_CODE,
                "format": "json",
                "limit": 1,
            },
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=15.0,
        )
        if r.status_code >= 400:
            db.put_centroid(zip_code, None, None, None, source="nominatim_error")
            return
        data = r.json()
    except (httpx.HTTPError, ValueError):
        db.put_centroid(zip_code, None, None, None, source="nominatim_error")
        return
    if not isinstance(data, list) or not data:
        db.put_centroid(zip_code, None, None, None, source="nominatim_empty")
        return
    hit = data[0]
    try:
        lat = float(hit["lat"])
        lon = float(hit["lon"])
    except (KeyError, TypeError, ValueError):
        db.put_centroid(zip_code, None, None, None, source="nominatim_parse_err")
        return
    db.put_centroid(zip_code, lat, lon, hit.get("display_name"), source="nominatim")


async def resolve_missing(zips: list[str], max_new: int = 25) -> int:
    """Resolve up to `max_new` ZIPs whose centroid isn't cached yet."""
    zips = list({(z or "").strip() for z in zips if z and str(z).strip()})
    cached = db.centroids_for_zips(zips)
    todo = [
        z for z in zips
        if z not in cached
        or (
            cached[z].get("lat") is None
            and (cached[z].get("failed_attempts") or 0) < MAX_FAILURES
        )
    ]
    todo = todo[:max_new]
    if not todo:
        return 0

    n = 0
    async with httpx.AsyncClient() as client:
        for z in todo:
            result = await resolve_zip(client, z)
            if result and result.get("lat") is not None:
                n += 1
    return n
