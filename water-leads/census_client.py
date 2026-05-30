"""US Census Bureau ACS 5-year client for ZIP-level demographics.

We hit the public ACS 5-year endpoint (2022 vintage), which doesn't require
an API key for modest query volumes. Data is keyed by ZCTA (ZIP Code
Tabulation Area); for most US ZIPs, ZCTA code == ZIP code.

Variables we pull (per ZCTA):
  B01003_001E  total population
  B11001_001E  total households
  B19013_001E  median household income (dollars)
  B25077_001E  median home value (dollars, owner-occupied)
  B25003_001E  total occupied housing units (denominator)
  B25003_002E  owner-occupied units
  B25034_001E  total year-built universe
  B25034_008E  built 1970-1979
  B25034_009E  built 1960-1969
  B25034_010E  built 1950-1959
  B25034_011E  built 1940-1949
  B25034_010E? / B25034_011E? EPA's lead solder era is pre-1986; ACS bins
  give us pre-1980 which is close enough for a buyer-quality signal.

We return a dict per ZCTA with normalized values (None when the Census
returns a placeholder like -666666666).
"""
from __future__ import annotations

import os
from typing import Any

import httpx

CENSUS_BASE = os.getenv(
    "CENSUS_ACS_BASE",
    "https://api.census.gov/data/2022/acs/acs5",
).rstrip("/")
CENSUS_KEY = os.getenv("CENSUS_API_KEY", "").strip()

VARIABLES = [
    "B01003_001E",          # population
    "B11001_001E",          # households
    "B19013_001E",          # median household income
    "B25077_001E",          # median home value
    "B25003_001E",          # total occupied housing units
    "B25003_002E",          # owner-occupied units
    "B25034_001E",          # total housing units (year-built universe)
    "B25034_008E",          # built 1970-1979
    "B25034_009E",          # built 1960-1969
    "B25034_010E",          # built 1950-1959
    "B25034_011E",          # built 1940-1949
]

# ACS uses -666666666 (and other large negatives) as "null" sentinels.
_ACS_NULL_THRESHOLD = -10_000


def _norm(v: Any) -> int | None:
    if v is None:
        return None
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    if n <= _ACS_NULL_THRESHOLD:
        return None
    return n


def _chunk(seq: list[str], n: int):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


async def fetch_acs_for_zips(
    client: httpx.AsyncClient, zips: list[str]
) -> list[dict[str, Any]]:
    """Pull ACS 5-year demographics for a set of ZCTA codes.

    The Census API allows filtering ZCTA by value list; we batch to keep URLs
    reasonable. Returns one dict per ZIP that had any data.
    """
    zips = sorted({z.strip() for z in zips if z and z.strip().isdigit()})
    if not zips:
        return []

    out: list[dict[str, Any]] = []
    # The `for=zip code tabulation area:` filter supports comma lists.
    for batch in _chunk(zips, 40):
        params = {
            "get": ",".join(VARIABLES),
            "for": "zip code tabulation area:" + ",".join(batch),
        }
        if CENSUS_KEY:
            params["key"] = CENSUS_KEY
        try:
            r = await client.get(CENSUS_BASE, params=params, timeout=30.0)
            if r.status_code >= 400:
                continue
            data = r.json()
        except (httpx.HTTPError, ValueError):
            continue
        if not isinstance(data, list) or len(data) < 2:
            continue
        header = data[0]
        idx = {name: i for i, name in enumerate(header)}
        for row in data[1:]:
            rec: dict[str, Any] = {}
            zcta = row[idx.get("zip code tabulation area", -1)]
            if not zcta:
                continue
            rec["zip_code"] = str(zcta).zfill(5)
            rec["population"] = _norm(row[idx["B01003_001E"]])
            rec["households"] = _norm(row[idx["B11001_001E"]])
            rec["median_household_income"] = _norm(row[idx["B19013_001E"]])
            rec["median_home_value"] = _norm(row[idx["B25077_001E"]])

            total_occ = _norm(row[idx["B25003_001E"]])
            owner_occ = _norm(row[idx["B25003_002E"]])
            rec["owner_occupied_pct"] = (
                round(100.0 * owner_occ / total_occ, 1)
                if total_occ and owner_occ is not None
                else None
            )

            total_built = _norm(row[idx["B25034_001E"]])
            pre_1980 = 0
            for var in ("B25034_008E", "B25034_009E", "B25034_010E", "B25034_011E"):
                v = _norm(row[idx[var]])
                if v:
                    pre_1980 += v
            rec["pre_1980_housing_pct"] = (
                round(100.0 * pre_1980 / total_built, 1)
                if total_built
                else None
            )
            out.append(rec)
    return out
