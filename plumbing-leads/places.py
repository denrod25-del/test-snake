"""Google Places API (New) + Geocoding client.

Uses the v1 Places API which is the current/recommended version. Requires
these APIs enabled in Google Cloud Console:
  - Places API (New)
  - Geocoding API
"""
from __future__ import annotations

import asyncio
from typing import Any

import httpx

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# Field mask controls cost. Only request what we use.
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
        "places.types",
        "places.location",
        "nextPageToken",
    ]
)


class PlacesError(RuntimeError):
    pass


async def geocode(location: str, api_key: str) -> tuple[float, float]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            GEOCODE_URL, params={"address": location, "key": api_key}
        )
        data = r.json()
        if data.get("status") != "OK" or not data.get("results"):
            raise PlacesError(
                f"Geocode failed for '{location}': "
                f"{data.get('status')} {data.get('error_message', '')}"
            )
        loc = data["results"][0]["geometry"]["location"]
        return float(loc["lat"]), float(loc["lng"])


async def search_text(
    *,
    text_query: str,
    lat: float,
    lng: float,
    radius_meters: float,
    api_key: str,
    max_results: int = 60,
    min_rating: float = 0.0,
) -> list[dict[str, Any]]:
    """Run a Places text search with location bias. Pages until max_results."""
    radius_meters = float(min(radius_meters, 50_000))  # API max
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": FIELD_MASK,
    }

    base_body: dict[str, Any] = {
        "textQuery": text_query,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius_meters,
            }
        },
        "pageSize": min(max_results, 20),
    }
    if min_rating > 0:
        base_body["minRating"] = float(min_rating)

    out: list[dict[str, Any]] = []
    page_token: str | None = None

    async with httpx.AsyncClient(timeout=20.0) as client:
        for _ in range(3):  # API allows up to 60 results across 3 pages
            body = dict(base_body)
            if page_token:
                body["pageToken"] = page_token

            r = await client.post(PLACES_SEARCH_URL, json=body, headers=headers)
            if r.status_code != 200:
                raise PlacesError(
                    f"Places API HTTP {r.status_code}: {r.text[:300]}"
                )
            data = r.json()
            for place in data.get("places", []) or []:
                out.append(_normalize_place(place))
                if len(out) >= max_results:
                    return out

            page_token = data.get("nextPageToken")
            if not page_token:
                break
            # New API tokens are usable almost immediately, but a tiny delay
            # avoids the occasional 'INVALID_ARGUMENT' on rapid-fire reuse.
            await asyncio.sleep(1.5)

    return out[:max_results]


def _normalize_place(p: dict[str, Any]) -> dict[str, Any]:
    loc = p.get("location") or {}
    name = (p.get("displayName") or {}).get("text", "")
    return {
        "place_id":         p.get("id", ""),
        "name":             name,
        "address":          p.get("formattedAddress", ""),
        "phone":            p.get("nationalPhoneNumber") or p.get("internationalPhoneNumber") or "",
        "website":          p.get("websiteUri", ""),
        "google_url":       p.get("googleMapsUri", ""),
        "rating":           float(p.get("rating") or 0) or None,
        "reviews":          int(p.get("userRatingCount") or 0),
        "business_status":  p.get("businessStatus", "OPERATIONAL"),
        "types":            [t for t in (p.get("types") or []) if t not in ("point_of_interest", "establishment")],
        "lat":              loc.get("latitude"),
        "lng":              loc.get("longitude"),
    }
