"""ZIP, city, and address to water-utility resolution.

The honest framing first, because it governs the whole design: **a ZIP code
does not determine your water utility.** ZIP codes are mail-delivery routes;
water service areas are pipe networks. They overlap messily, a single Florida
ZIP is routinely served by three or more systems, and SDWIS's `zip_code_served`
is self-reported by the utility with no geometry behind it.

So this module never returns "your utility is X". It returns a ranked list of
candidates with a `confidence` and an explicit `isDefinitive` flag that is only
ever true when exactly one community system serves the ZIP.

Three resolution tiers, strongest first:

1. **Geometry** (not yet wired) — point-in-polygon against utility service-area
   boundaries. The only method that actually answers the question. Requires
   FDEP or utility GIS layers; `fwq/data/sources.json` tracks that dependency.
2. **ZIP + city** — narrows candidates using both fields from SDWIS.
3. **ZIP alone** — the fallback, ranked, and labelled as ambiguous.

`resolve_address` geocodes to a point and then, until tier 1 exists, degrades
to tier 2 using the geocoder's ZIP and city. It says so in its response rather
than implying precision it does not have.
"""
from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Sequence

from .schema import WaterSystem

log = logging.getLogger(__name__)

CENSUS_GEOCODER = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"

#: Community water systems serve residences, so they outrank a transient system
#: (a campground, a highway rest stop) that happens to share a ZIP.
TYPE_WEIGHT: dict[str, float] = {
    "community": 1.0,
    "non-transient non-community": 0.4,
    "transient non-community": 0.15,
}


@dataclass
class Candidate:
    """One possible utility for a location, with why it was proposed."""

    pwsid: str
    name: str
    confidence: float
    reasons: list[str] = field(default_factory=list)
    population_served: int | None = None
    system_type: str | None = None
    counties: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "pwsid": self.pwsid,
            "name": self.name,
            "confidence": round(self.confidence, 3),
            "reasons": self.reasons,
            "populationServed": self.population_served,
            "systemType": self.system_type,
            "counties": self.counties,
        }


@dataclass
class ServiceIndex:
    """Reverse index from place to utility, built from SDWIS service areas."""

    by_zip: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    by_city: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    by_county: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    systems: dict[str, dict[str, Any]] = field(default_factory=dict)
    generated_at: str | None = None

    # -- construction ------------------------------------------------------

    @classmethod
    def from_systems(cls, systems: Iterable[WaterSystem]) -> "ServiceIndex":
        index = cls()
        for system in systems:
            index.systems[system.pwsid] = {
                "pwsid": system.pwsid,
                "name": system.name,
                "systemType": system.system_type,
                "populationServed": system.population_served,
                "counties": system.service_area.to_dict()["counties"],
                "cities": system.service_area.to_dict()["cities"],
                "zips": system.service_area.to_dict()["zips"],
                "isActive": system.is_active,
            }
            for zip_code in set(system.service_area.zips):
                index.by_zip[zip_code].append(system.pwsid)
            for city in set(system.service_area.cities):
                index.by_city[_norm_place(city)].append(system.pwsid)
            for county in set(system.service_area.counties):
                index.by_county[_norm_place(county)].append(system.pwsid)
        index.generated_at = datetime.utcnow().isoformat() + "Z"
        return index

    def to_dict(self) -> dict[str, Any]:
        return {
            "generatedAt": self.generated_at,
            "systemCount": len(self.systems),
            "zipCount": len(self.by_zip),
            "byZip": {k: sorted(set(v)) for k, v in sorted(self.by_zip.items())},
            "byCity": {k: sorted(set(v)) for k, v in sorted(self.by_city.items())},
            "byCounty": {k: sorted(set(v)) for k, v in sorted(self.by_county.items())},
            "systems": self.systems,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "ServiceIndex":
        index = cls()
        index.by_zip = defaultdict(list, {k: list(v) for k, v in payload.get("byZip", {}).items()})
        index.by_city = defaultdict(list, {k: list(v) for k, v in payload.get("byCity", {}).items()})
        index.by_county = defaultdict(list, {k: list(v) for k, v in payload.get("byCounty", {}).items()})
        index.systems = payload.get("systems", {})
        index.generated_at = payload.get("generatedAt")
        return index

    @classmethod
    def load(cls, path: Path) -> "ServiceIndex":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    # -- lookup ------------------------------------------------------------

    def lookup_zip(self, zip_code: str, *, city: str | None = None) -> dict[str, Any]:
        """Candidate utilities for a ZIP, optionally narrowed by city."""
        clean = re.sub(r"\D", "", str(zip_code))[:5]
        if len(clean) != 5:
            return _empty_lookup("invalid ZIP code", {"zip": zip_code})

        pwsids = sorted(set(self.by_zip.get(clean, [])))
        if not pwsids:
            return _empty_lookup(
                "No water system in the dataset reports serving this ZIP. It may be "
                "served by private wells, by a system that has not reported this ZIP "
                "to SDWIS, or the ZIP may be outside Florida.",
                {"zip": clean},
            )

        city_pwsids: set[str] = set()
        if city:
            city_pwsids = set(self.by_city.get(_norm_place(city), []))

        candidates = [
            self._score(pwsid, clean, city_pwsids, city) for pwsid in pwsids
        ]
        candidates.sort(key=lambda c: (-c.confidence, -(c.population_served or 0), c.name))

        community = [c for c in candidates if c.system_type == "community"]
        definitive = len(community) == 1 and len(candidates) == 1

        return {
            "query": {"zip": clean, "city": city},
            "method": "zip+city" if city else "zip",
            "isDefinitive": definitive,
            "candidateCount": len(candidates),
            "candidates": [c.to_dict() for c in candidates],
            "caveat": (
                "ZIP codes are mail routes, not water service areas. This is a ranked "
                "list of systems that report serving this ZIP, not a determination of "
                "who bills you. Confirm against your water bill."
            ),
        }

    def _score(
        self,
        pwsid: str,
        zip_code: str,
        city_pwsids: set[str],
        city: str | None,
    ) -> Candidate:
        info = self.systems.get(pwsid, {})
        system_type = info.get("systemType")
        reasons = [f"SDWIS lists this system as serving ZIP {zip_code}"]

        score = TYPE_WEIGHT.get(str(system_type), 0.3)

        if city and pwsid in city_pwsids:
            score += 0.35
            reasons.append(f"also reports serving {city.title()}")
        elif city and city_pwsids:
            # Another system matched the city and this one did not.
            score -= 0.15

        # A system serving very few ZIPs is a tighter match for any one of them
        # than a regional system serving dozens.
        zips = info.get("zips") or []
        if zips:
            score += min(0.2, 1.0 / len(zips))
            reasons.append(f"serves {len(zips)} ZIP code(s) in total")

        population = info.get("populationServed")
        if isinstance(population, int) and population > 0:
            reasons.append(f"population served: {population:,}")

        if info.get("isActive") is False:
            score -= 0.5
            reasons.append("marked inactive in SDWIS")

        return Candidate(
            pwsid=pwsid,
            name=info.get("name", pwsid),
            confidence=max(0.0, min(1.0, score)),
            reasons=reasons,
            population_served=population if isinstance(population, int) else None,
            system_type=system_type,
            counties=info.get("counties", []),
        )

    def lookup_city(self, city: str) -> dict[str, Any]:
        pwsids = sorted(set(self.by_city.get(_norm_place(city), [])))
        if not pwsids:
            return _empty_lookup("No system reports serving this city.", {"city": city})
        candidates = [
            Candidate(
                pwsid=p,
                name=self.systems.get(p, {}).get("name", p),
                confidence=TYPE_WEIGHT.get(str(self.systems.get(p, {}).get("systemType")), 0.3),
                reasons=[f"SDWIS lists this system as serving {city.title()}"],
                population_served=self.systems.get(p, {}).get("populationServed"),
                system_type=self.systems.get(p, {}).get("systemType"),
                counties=self.systems.get(p, {}).get("counties", []),
            )
            for p in pwsids
        ]
        candidates.sort(key=lambda c: (-c.confidence, -(c.population_served or 0), c.name))
        return {
            "query": {"city": city},
            "method": "city",
            "isDefinitive": len(candidates) == 1,
            "candidateCount": len(candidates),
            "candidates": [c.to_dict() for c in candidates],
            "caveat": "City names in SDWIS are self-reported and often cover only part of a municipality.",
        }


def _empty_lookup(message: str, query: dict[str, Any]) -> dict[str, Any]:
    return {
        "query": query,
        "method": "none",
        "isDefinitive": False,
        "candidateCount": 0,
        "candidates": [],
        "caveat": message,
    }


def _norm_place(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value).casefold()).strip()


# --- address resolution -----------------------------------------------------


def geocode_address(client: Any, address: str) -> dict[str, Any] | None:
    """Geocode a one-line address with the Census Bureau geocoder.

    Free and key-less, and already the geocoder this repo uses elsewhere
    (`water-leads/census_client.py`).
    """
    url = (
        f"{CENSUS_GEOCODER}?address={requests_quote(address)}"
        "&benchmark=Public_AR_Current&format=json"
    )
    payload = client.get_json(url, empty_on_404=False)
    matches = (payload or {}).get("result", {}).get("addressMatches") or []
    if not matches:
        return None
    match = matches[0]
    components = match.get("addressComponents", {})
    coords = match.get("coordinates", {})
    return {
        "matchedAddress": match.get("matchedAddress"),
        "zip": components.get("zip"),
        "city": components.get("city"),
        "state": components.get("state"),
        "lat": coords.get("y"),
        "lon": coords.get("x"),
    }


def requests_quote(value: str) -> str:
    from urllib.parse import quote

    return quote(str(value), safe="")


def resolve_address(index: ServiceIndex, client: Any, address: str) -> dict[str, Any]:
    """Resolve a street address to candidate utilities.

    Currently geocodes to a point and then falls back to ZIP+city matching,
    because no service-area geometry is wired yet. The response states the
    method used so a caller can tell a real point-in-polygon answer from this
    approximation once geometry lands.
    """
    geo = geocode_address(client, address)
    if geo is None:
        return _empty_lookup(
            "Address could not be geocoded. Try a ZIP code lookup instead.",
            {"address": address},
        )
    if geo.get("state") and str(geo["state"]).upper() != "FL":
        return _empty_lookup(
            f"Address geocoded to {geo['state']}, outside Florida coverage.",
            {"address": address},
        )

    result = index.lookup_zip(geo.get("zip") or "", city=geo.get("city"))
    result["query"] = {"address": address}
    result["geocode"] = geo
    result["method"] = "geocode+zip+city"
    result["caveat"] = (
        "Resolved by geocoding the address and matching its ZIP and city against "
        "SDWIS-reported service areas. This is not a service-area boundary lookup: "
        "utility service-area geometry is not yet wired, so an address near a "
        "boundary may match the wrong system. Confirm against your water bill."
    )
    return result
