"""EPA Envirofacts client — SDWIS inventory/violations/LCR and UCMR 5 PFAS.

Envirofacts is a public REST service with no API key. URLs are path-encoded:

    {base}/{program}.{table}/{col}/{op}/{value}/.../{first}:{last}/JSON

Paging is 1-indexed and inclusive. The service answers 404 rather than `[]`
for an empty result set, and caps page sizes, both of which `http.Client` and
`_fetch_all_pages` absorb.

Tables used
-----------
``sdwis.water_system``       inventory: name, type, population, source water
``sdwis.geographic_area``    PWSID -> county / city / ZIP served
``sdwis.violation``          MCL, MRDL, TT, and monitoring violations
``sdwis.lcr_sample_result``  Lead and Copper Rule 90th-percentile results
``sdwis.ref_code_values``    code -> description reference table
``ucmr5.*``                  UCMR 5 PFAS + lithium occurrence data

UCMR 5 table naming has moved between cycles, so `fetch_ucmr5` probes a list of
candidate table names and reports which one answered instead of assuming.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Iterable, Iterator, Sequence

from .http import Client, SourceUnavailable

log = logging.getLogger(__name__)

BASE_URL = os.getenv("EPA_BASE_URL", "https://data.epa.gov/efservice").rstrip("/")
PROGRAM = "sdwis"

#: Rows per request. The service truncates very large pages; 5k is safe.
PAGE_SIZE = 5_000
#: PWSIDs per `in` filter. PWSIDs are 9 chars, so ~60 keeps URLs near 1.5 KB.
PWSID_BATCH = 60
#: Backstop so a runaway page loop cannot spin forever against a paging bug.
MAX_ROWS = 500_000

UCMR5_CANDIDATE_TABLES: tuple[str, ...] = (
    "ucmr5.ucmr5_occurrence_data",
    "ucmr5.occurrence_data",
    "ucmr5.ucmr5_all",
    "ucmr5.ucmr5_dataset",
)


def build_url(
    table: str,
    filters: Sequence[tuple[str, str, str]] = (),
    rows: tuple[int, int] | None = None,
) -> str:
    """Build a namespace-qualified Envirofacts URL.

    `table` may be bare (`water_system`) or already qualified (`ucmr5.foo`).
    """
    qualified = table if "." in table else f"{PROGRAM}.{table.lower()}"
    parts = [BASE_URL, qualified]
    for col, op, val in filters:
        parts.extend([col, op, _encode(val)])
    if rows is not None:
        parts.append(f"{rows[0]}:{rows[1]}")
    parts.append("JSON")
    return "/".join(parts)


def _encode(value: str) -> str:
    """Envirofacts is lenient but chokes on raw spaces and slashes in values."""
    return str(value).replace(" ", "%20").replace("/", "%2F")


def _lower_keys(row: dict[str, Any]) -> dict[str, Any]:
    """Envirofacts flips column-name casing between releases. Pin it to lower."""
    return {str(k).lower(): v for k, v in row.items()}


def _chunk(seq: Sequence[str], n: int) -> Iterator[list[str]]:
    items = list(seq)
    for i in range(0, len(items), n):
        yield items[i:i + n]


def fetch_all_pages(
    client: Client,
    table: str,
    filters: Sequence[tuple[str, str, str]] = (),
    *,
    page_size: int = PAGE_SIZE,
    max_rows: int = MAX_ROWS,
) -> list[dict[str, Any]]:
    """Walk every page of a filtered table."""
    out: list[dict[str, Any]] = []
    start = 1
    while start <= max_rows:
        end = start + page_size - 1
        batch = client.get_json(build_url(table, filters, rows=(start, end)))
        if not isinstance(batch, list) or not batch:
            break
        out.extend(_lower_keys(r) for r in batch)
        if len(batch) < page_size:
            break
        start += page_size
    return out


def _fetch_by_pwsid(
    client: Client, table: str, pwsids: Sequence[str], **kwargs: Any
) -> list[dict[str, Any]]:
    """Fetch a table for many PWSIDs, batching them into `in` filters."""
    out: list[dict[str, Any]] = []
    for batch in _chunk(sorted(set(pwsids)), PWSID_BATCH):
        out.extend(
            fetch_all_pages(client, table, [("pwsid", "in", ",".join(batch))], **kwargs)
        )
    return out


# --- inventory --------------------------------------------------------------


def fetch_state_water_systems(
    client: Client, state: str = "FL", *, active_only: bool = False
) -> list[dict[str, Any]]:
    """Every water system in a state."""
    filters: list[tuple[str, str, str]] = [("state_code", "equals", state.upper())]
    if active_only:
        filters.append(("pws_activity_code", "equals", "A"))
    return fetch_all_pages(client, "water_system", filters)


def fetch_water_systems(client: Client, pwsids: Sequence[str]) -> list[dict[str, Any]]:
    return _fetch_by_pwsid(client, "water_system", pwsids)


def fetch_geographic_areas_for_state(
    client: Client, state: str = "FL"
) -> list[dict[str, Any]]:
    """Service-area rows for a whole state — the basis of the ZIP -> PWSID index.

    One PWSID yields many rows, one per city_served / zip_code_served pair.
    """
    return fetch_all_pages(
        client, "geographic_area", [("state_served", "equals", state.upper())]
    )


def fetch_geographic_areas(
    client: Client, pwsids: Sequence[str]
) -> list[dict[str, Any]]:
    return _fetch_by_pwsid(client, "geographic_area", pwsids)


def fetch_violations(client: Client, pwsids: Sequence[str]) -> list[dict[str, Any]]:
    """All violations for a set of systems, any status.

    Deliberately unfiltered by compliance status: SDWIS's status coding has
    changed over time, so the normalizer decides what counts as open.
    """
    return _fetch_by_pwsid(client, "violation", pwsids)


def fetch_lcr_results(client: Client, pwsids: Sequence[str]) -> list[dict[str, Any]]:
    """Lead and Copper Rule 90th-percentile sample summaries."""
    return _fetch_by_pwsid(client, "lcr_sample_result", pwsids)


def fetch_facilities(client: Client, pwsids: Sequence[str]) -> list[dict[str, Any]]:
    """Treatment plants, wells, and interconnects belonging to each system."""
    return _fetch_by_pwsid(client, "water_system_facility", pwsids)


# --- name resolution --------------------------------------------------------

_WORD = re.compile(r"[a-z0-9]+")


def _tokens(name: str) -> set[str]:
    """Comparison tokens, minus the corporate noise every utility name carries."""
    stop = {
        "the", "of", "and", "inc", "llc", "corp", "co", "company", "system",
        "systems", "water", "utility", "utilities", "authority", "district",
        "department", "dept", "services", "service", "public", "works",
    }
    return {w for w in _WORD.findall(name.casefold()) if w not in stop}


def find_systems_by_name(
    client: Client, name_fragment: str, state: str = "FL"
) -> list[dict[str, Any]]:
    """Find systems whose name contains `name_fragment`, best match first.

    Used to resolve a utility to a PWSID without hardcoding one. Envirofacts
    supports a `contains` operator; if it is rejected the search falls back to
    `beginning`, then to filtering the full state list client-side.
    """
    fragment = name_fragment.strip().upper()
    rows: list[dict[str, Any]] = []
    for operator in ("contains", "beginning"):
        try:
            rows = fetch_all_pages(
                client,
                "water_system",
                [("pws_name", operator, fragment), ("state_code", "equals", state.upper())],
            )
        except SourceUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001 - operator support varies
            log.debug("name search with %s failed: %s", operator, exc)
            continue
        if rows:
            break

    if not rows:
        needle = fragment.casefold()
        rows = [
            r for r in fetch_state_water_systems(client, state)
            if needle in str(r.get("pws_name", "")).casefold()
        ]

    wanted = _tokens(name_fragment)

    def score(row: dict[str, Any]) -> tuple[int, int, int]:
        candidate = str(row.get("pws_name", ""))
        overlap = len(wanted & _tokens(candidate))
        # Prefer community systems and active systems, then tighter name matches.
        is_community = 1 if str(row.get("pws_type_code", "")).upper() == "CWS" else 0
        is_active = 1 if str(row.get("pws_activity_code", "")).upper() == "A" else 0
        return (overlap, is_community, is_active)

    return sorted(rows, key=score, reverse=True)


# --- reference codes --------------------------------------------------------


def fetch_contaminant_codes(client: Client) -> dict[str, str]:
    """SDWIS contaminant code -> description, from EPA's own reference table.

    Learning these rather than hardcoding them keeps the analyte table free of
    guessed numeric codes; whatever EPA says a code means is what we map.
    """
    try:
        rows = fetch_all_pages(
            client, "ref_code_values", [("value_type", "equals", "CONTAMINANT_CODE")]
        )
    except SourceUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        log.warning("contaminant code reference table unavailable: %s", exc)
        return {}
    out: dict[str, str] = {}
    for row in rows:
        code = str(row.get("value_code", "")).strip()
        desc = str(row.get("value_description", "")).strip()
        if code and desc:
            out[code.lstrip("0") or "0"] = desc
    return out


# --- UCMR 5 (PFAS) ----------------------------------------------------------


def resolve_ucmr5_table(client: Client) -> str | None:
    """Return the first UCMR 5 table name that responds, or `None`."""
    for table in UCMR5_CANDIDATE_TABLES:
        try:
            probe = client.get_json(build_url(table, rows=(1, 1)), empty_on_404=False)
        except SourceUnavailable:
            continue
        except Exception:  # noqa: BLE001
            continue
        if isinstance(probe, list):
            return table
    return None


def fetch_ucmr5(
    client: Client, pwsids: Sequence[str], *, table: str | None = None
) -> tuple[list[dict[str, Any]], str | None]:
    """UCMR 5 occurrence rows (29 PFAS + lithium) for a set of systems.

    UCMR 5 is the highest-value PFAS source for Florida: it is nationwide,
    method-standardized, and captures detections that never become violations,
    which is most of them. Returns `(rows, table_used)`; an empty list with a
    `None` table means UCMR 5 was not reachable under any known name.
    """
    resolved = table or resolve_ucmr5_table(client)
    if resolved is None:
        log.warning("UCMR 5 not reachable at any known table name")
        return [], None
    rows = _fetch_by_pwsid(client, resolved, pwsids, max_rows=MAX_ROWS)
    return rows, resolved


def fetch_ucmr5_state(
    client: Client, state: str = "FL", *, table: str | None = None
) -> tuple[list[dict[str, Any]], str | None]:
    """UCMR 5 rows for an entire state, when a statewide pull is cheaper."""
    resolved = table or resolve_ucmr5_table(client)
    if resolved is None:
        return [], None
    for column in ("state", "statecode", "state_code"):
        try:
            rows = fetch_all_pages(client, resolved, [(column, "equals", state.upper())])
        except SourceUnavailable:
            raise
        except Exception:  # noqa: BLE001 - column naming varies by release
            continue
        if rows:
            return rows, resolved
    return [], resolved


# --- orchestration ----------------------------------------------------------


def pull_systems(
    client: Client, pwsids: Sequence[str], *, include_ucmr5: bool = True
) -> dict[str, Any]:
    """Pull every SDWIS table for a set of systems, plus UCMR 5.

    Each section is attempted independently so one unavailable table degrades
    that section instead of failing the whole run; `errors` records what was
    lost so the dataset can be labelled honestly.
    """
    pwsids = sorted(set(pwsids))
    out: dict[str, Any] = {
        "pwsids": pwsids,
        "water_systems": [],
        "geographic_areas": [],
        "violations": [],
        "lcr_results": [],
        "facilities": [],
        "ucmr5": [],
        "ucmr5_table": None,
        "errors": {},
    }
    if not pwsids:
        return out

    sections: list[tuple[str, Any]] = [
        ("water_systems", lambda: fetch_water_systems(client, pwsids)),
        ("geographic_areas", lambda: fetch_geographic_areas(client, pwsids)),
        ("violations", lambda: fetch_violations(client, pwsids)),
        ("lcr_results", lambda: fetch_lcr_results(client, pwsids)),
        ("facilities", lambda: fetch_facilities(client, pwsids)),
    ]
    for key, fn in sections:
        try:
            out[key] = fn()
        except Exception as exc:  # noqa: BLE001 - partial data beats none
            log.warning("%s pull failed: %s", key, exc)
            out["errors"][key] = str(exc)

    if include_ucmr5:
        try:
            rows, table = fetch_ucmr5(client, pwsids)
            out["ucmr5"] = rows
            out["ucmr5_table"] = table
        except Exception as exc:  # noqa: BLE001
            log.warning("ucmr5 pull failed: %s", exc)
            out["errors"]["ucmr5"] = str(exc)

    return out
