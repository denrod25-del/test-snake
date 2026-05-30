"""EPA Envirofacts SDWIS REST client.

No API key required. See:
  https://www.epa.gov/enviro/envirofacts-data-service-api
  https://data.epa.gov/efservice/

URL pattern (new namespace-qualified format, 1-indexed paging):
  {base}/{program}.{table}/{col}/{op}/{val}/.../{first}:{last}/JSON

Tables used (all under the `sdwis` program):
  geographic_area   - links PWSID -> county_served, city_served, zip_code_served
  water_system      - inventory: name, type, population, admin contact, ...
  violation         - MCL / MRDL / TT / monitoring violations
  lcr_sample_result - Lead & Copper Rule 90th-percentile sample results
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, Iterable

import httpx

BASE_URL = os.getenv("EPA_BASE_URL", "https://data.epa.gov/efservice").rstrip("/")

# Program namespace prefix required by the current Envirofacts API.
PROGRAM = "sdwis"

# Max rows per request. The service caps large pages; 5k is a safe ceiling.
PAGE_SIZE = 5_000
# How many PWSIDs we put in a single `in` filter. URLs have length limits
# and PWSIDs can be up to 10 chars; ~60 keeps the URL under ~1.5kb.
PWSID_BATCH = 60

DEFAULT_TIMEOUT = httpx.Timeout(60.0, connect=15.0)
DEFAULT_RETRIES = 3


class SdwisError(RuntimeError):
    pass


def _encode_value(v: str) -> str:
    """EPA's service is lenient but safer to swap spaces for %20."""
    return str(v).replace(" ", "%20")


def _build_url(
    table: str,
    filters: list[tuple[str, str, str]] | None = None,
    rows: tuple[int, int] | None = None,
) -> str:
    """Build a namespace-qualified Envirofacts URL.

    `table` may be bare (e.g. 'water_system') or already qualified
    ('sdwis.water_system'). Paging is 1-indexed inclusive.
    """
    qualified = table if "." in table else f"{PROGRAM}.{table.lower()}"
    parts = [BASE_URL, qualified]
    for col, op, val in (filters or []):
        parts.extend([col, op, _encode_value(val)])
    if rows is not None:
        a, b = rows
        parts.append(f"{a}:{b}")
    parts.append("JSON")
    return "/".join(parts)


async def _fetch(
    client: httpx.AsyncClient, url: str, retries: int = DEFAULT_RETRIES
) -> list[dict[str, Any]]:
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            r = await client.get(url)
            if r.status_code == 404:
                # EPA sometimes returns 404 for empty result sets
                return []
            r.raise_for_status()
            data = r.json()
            if not isinstance(data, list):
                return []
            return data
        except (httpx.HTTPError, ValueError) as e:
            last_exc = e
            if attempt == retries - 1:
                break
            await asyncio.sleep(1.5 * (attempt + 1))
    raise SdwisError(f"GET {url} failed after {retries} tries: {last_exc}")


async def _fetch_all_pages(
    client: httpx.AsyncClient,
    table: str,
    filters: list[tuple[str, str, str]],
    page_size: int = PAGE_SIZE,
    max_rows: int = 200_000,
) -> list[dict[str, Any]]:
    """Walk paged results. Envirofacts uses 1-indexed inclusive ranges."""
    out: list[dict[str, Any]] = []
    start = 1
    while start <= max_rows:
        end = start + page_size - 1
        url = _build_url(table, filters, rows=(start, end))
        batch = await _fetch(client, url)
        if not batch:
            break
        out.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return out


def _lower_keys(row: dict[str, Any]) -> dict[str, Any]:
    """Envirofacts sometimes returns uppercase column names. Normalize."""
    return {k.lower(): v for k, v in row.items()}


def _chunk(seq: list[str], n: int) -> Iterable[list[str]]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ---------- public fetchers ----------


async def fetch_geographic_areas(
    client: httpx.AsyncClient, state: str, county: str
) -> list[dict[str, Any]]:
    """All service-area rows linking PWSIDs to a given county.

    One PWSID can have many rows (one per city_served + zip_code_served).
    """
    rows = await _fetch_all_pages(
        client,
        "GEOGRAPHIC_AREA",
        [
            ("state_served", "equals", state.upper()),
            ("county_served", "equals", county.upper()),
        ],
    )
    return [_lower_keys(r) for r in rows]


async def fetch_water_systems(
    client: httpx.AsyncClient, pwsids: list[str]
) -> list[dict[str, Any]]:
    """Inventory rows for a set of PWSIDs."""
    out: list[dict[str, Any]] = []
    for batch in _chunk(sorted(set(pwsids)), PWSID_BATCH):
        in_list = ",".join(batch)
        rows = await _fetch_all_pages(
            client,
            "WATER_SYSTEM",
            [("pwsid", "in", in_list)],
        )
        out.extend(_lower_keys(r) for r in rows)
    return out


async def fetch_violations(
    client: httpx.AsyncClient, pwsids: list[str]
) -> list[dict[str, Any]]:
    """All violations (any status) for a set of PWSIDs.

    We pull everything and let scoring decide what's active vs historical;
    Envirofacts' compliance_status_code filter varies over time.
    """
    out: list[dict[str, Any]] = []
    for batch in _chunk(sorted(set(pwsids)), PWSID_BATCH):
        in_list = ",".join(batch)
        rows = await _fetch_all_pages(
            client,
            "VIOLATION",
            [("pwsid", "in", in_list)],
        )
        out.extend(_lower_keys(r) for r in rows)
    return out


async def fetch_lcr_results(
    client: httpx.AsyncClient, pwsids: list[str]
) -> list[dict[str, Any]]:
    """Lead & Copper Rule 90th-percentile sample summaries for a set of PWSIDs."""
    out: list[dict[str, Any]] = []
    for batch in _chunk(sorted(set(pwsids)), PWSID_BATCH):
        in_list = ",".join(batch)
        rows = await _fetch_all_pages(
            client,
            "LCR_SAMPLE_RESULT",
            [("pwsid", "in", in_list)],
        )
        out.extend(_lower_keys(r) for r in rows)
    return out


# ---------- UCMR 5 (PFAS occurrence data) ----------

# UCMR rows come from a different program namespace than SDWIS. The Envirofacts
# tables are under `ucmr5.*`. We try a couple candidate table names because EPA
# has been known to rename things between UCMR cycles.
_UCMR_CANDIDATE_TABLES = [
    "ucmr5.ucmr5_occurrence_data",
    "ucmr5.occurrence_data",
    "ucmr5.ucmr5_dataset",
]


async def fetch_ucmr5(
    client: httpx.AsyncClient, pwsids: list[str]
) -> list[dict[str, Any]]:
    """UCMR 5 occurrence rows (PFAS + lithium) for a set of PWSIDs.

    EPA's UCMR 5 nationwide dataset (2023–2025) is the single most important
    data source for PFAS selling stories, since many of these detections show
    up without ever becoming formal MCL violations.

    Returns an empty list (not an error) if Envirofacts doesn't expose UCMR 5
    at any of our candidate table names — the sync continues with SDWIS data.
    """
    for table in _UCMR_CANDIDATE_TABLES:
        try:
            probe_url = _build_url(table, [], rows=(1, 1))
            r = await client.get(probe_url)
            if r.status_code >= 400:
                continue
            # Successfully reachable; pull everything for the PWSIDs.
            out: list[dict[str, Any]] = []
            for batch in _chunk(sorted(set(pwsids)), PWSID_BATCH):
                in_list = ",".join(batch)
                rows = await _fetch_all_pages(
                    client,
                    table,
                    [("pwsid", "in", in_list)],
                    max_rows=500_000,
                )
                out.extend(_lower_keys(r) for r in rows)
            return out
        except (httpx.HTTPError, ValueError):
            continue
    return []


# ---------- full-sync helper ----------


async def sync_county(
    state: str,
    county: str,
    on_progress=None,
) -> dict[str, Any]:
    """Run a full pull for one county. Returns all raw rows grouped by type."""
    def _progress(stage: str, detail: str = "") -> None:
        if on_progress:
            try:
                on_progress(stage, detail)
            except Exception:
                pass

    async with httpx.AsyncClient(
        timeout=DEFAULT_TIMEOUT,
        headers={"Accept": "application/json", "User-Agent": "water-leads/1.0"},
    ) as client:
        _progress("geographic_areas", f"{county}, {state}")
        geo = await fetch_geographic_areas(client, state, county)
        pwsids = sorted({r["pwsid"] for r in geo if r.get("pwsid")})
        _progress("geographic_areas_done", f"{len(geo)} rows, {len(pwsids)} PWSIDs")

        if not pwsids:
            return {
                "geographic_areas": geo,
                "water_systems": [],
                "violations": [],
                "lcr_results": [],
                "pwsids": [],
            }

        _progress("water_systems", f"{len(pwsids)} systems")
        systems = await fetch_water_systems(client, pwsids)
        _progress("water_systems_done", f"{len(systems)} rows")

        _progress("violations", f"{len(pwsids)} systems")
        violations = await fetch_violations(client, pwsids)
        _progress("violations_done", f"{len(violations)} rows")

        _progress("lcr_results", f"{len(pwsids)} systems")
        lcr = await fetch_lcr_results(client, pwsids)
        _progress("lcr_results_done", f"{len(lcr)} rows")

        _progress("ucmr5", f"{len(pwsids)} systems")
        ucmr = await fetch_ucmr5(client, pwsids)
        _progress("ucmr5_done", f"{len(ucmr)} rows")

        return {
            "geographic_areas": geo,
            "water_systems": systems,
            "violations": violations,
            "lcr_results": lcr,
            "ucmr_results": ucmr,
            "pwsids": pwsids,
        }
