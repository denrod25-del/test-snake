"""UCMR 5 bulk data-file reader — the reliable path to PFAS occurrence data.

`envirofacts.fetch_ucmr5` probes a list of candidate table names because EPA has
renamed the UCMR tables between cycles, and there is no guarantee any of them
answer. PFAS is the headline of this whole API, so it should not hang on a
guessed table name.

EPA also publishes each UCMR cycle as a bulk download: a ZIP containing
delimited text files, one row per analytical result. That file is the source of
record, and this module reads it.

Two design points:

**Rows come out in the same shape Envirofacts produces.** The bulk file's column
names (`PWSID`, `AnalyticalResultsSign`, `AnalyticalResultValue`, `MRL`,
`UnitOfMeasure`, ...) are exactly what `normalize.normalize_ucmr5_result`
already looks up case-insensitively, so the normalizer needs no changes and both
paths are covered by the same tests.

**Parsing streams and filters early.** The national UCMR 5 file has millions of
rows and only a small fraction are Florida. Reading it into a list first would
be gratuitously wasteful, so `iter_rows` is a generator and `state` filtering
happens per row as they are read.
"""
from __future__ import annotations

import csv
import io
import logging
import zipfile
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

log = logging.getLogger(__name__)

#: Delimiters EPA has used across UCMR releases, most likely first.
CANDIDATE_DELIMITERS: tuple[str, ...] = ("\t", "|", ",")

#: A file inside the ZIP is only read if it looks like a data table.
DATA_SUFFIXES: tuple[str, ...] = (".txt", ".csv", ".tsv", ".dat")

#: Columns that must be present for a file to be treated as occurrence data.
#: Deliberately minimal — UCMR releases add and drop columns, and requiring the
#: full set would reject a file we can still read perfectly well.
REQUIRED_COLUMNS: frozenset[str] = frozenset({"pwsid", "contaminant"})


class UcmrParseError(ValueError):
    """The file did not look like UCMR occurrence data."""


def _norm_key(name: str) -> str:
    return "".join(ch for ch in str(name).casefold() if ch.isalnum())


def sniff_delimiter(header_line: str) -> str:
    """Pick the delimiter that splits the header into the most fields.

    Preferring the highest field count is what makes this robust: a tab-
    delimited header contains commas inside contaminant names, so counting
    occurrences of each candidate would pick the wrong one.
    """
    best, best_count = CANDIDATE_DELIMITERS[0], 0
    for delimiter in CANDIDATE_DELIMITERS:
        count = len(header_line.split(delimiter))
        if count > best_count:
            best, best_count = delimiter, count
    if best_count < 2:
        raise UcmrParseError(
            f"could not find a delimiter in header: {header_line[:120]!r}"
        )
    return best


def iter_rows(
    text: Iterable[str],
    *,
    state: str | None = None,
    delimiter: str | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield one dict per data row from a delimited UCMR file.

    `state` filters to a two-letter state code as rows stream past, so the
    national file never has to be held in memory. Rows whose state column is
    absent are kept: dropping a row because a column we did not expect is
    missing would silently lose data.
    """
    lines = iter(text)
    try:
        header_line = next(lines).rstrip("\r\n")
    except StopIteration:
        return

    delimiter = delimiter or sniff_delimiter(header_line)
    headers = [h.strip().strip('"') for h in header_line.split(delimiter)]
    normalized = [_norm_key(h) for h in headers]

    missing = REQUIRED_COLUMNS - set(normalized)
    if missing:
        raise UcmrParseError(
            f"file is missing required column(s) {sorted(missing)}; "
            f"found {headers[:12]}"
        )

    state_idx = next(
        (i for i, h in enumerate(normalized) if h in ("state", "statecode")), None
    )
    wanted_state = state.upper() if state else None

    reader = csv.reader(
        (line.rstrip("\r\n") for line in lines), delimiter=delimiter
    )
    for fields in reader:
        if not fields or not any(f.strip() for f in fields):
            continue
        if wanted_state is not None and state_idx is not None:
            if state_idx >= len(fields):
                continue
            if fields[state_idx].strip().upper() != wanted_state:
                continue
        # Keep the upstream header spelling: the normalizer matches on it
        # case- and separator-insensitively, and preserving it means a raw row
        # stays traceable back to the file it came from.
        row = {
            headers[i]: fields[i].strip()
            for i in range(min(len(headers), len(fields)))
        }
        if row.get(headers[normalized.index("pwsid")], "").strip():
            yield row


def iter_zip_rows(
    data: bytes | Path | str, *, state: str | None = None
) -> Iterator[dict[str, Any]]:
    """Yield rows from every data file inside a UCMR ZIP archive.

    Accepts raw bytes or a path. Non-data members (readme, data dictionary) are
    skipped, and a member that does not parse is logged and skipped rather than
    aborting the whole archive — a broken readme should not cost us the results.
    """
    source: Any = io.BytesIO(data) if isinstance(data, bytes) else str(data)
    with zipfile.ZipFile(source) as archive:
        for member in archive.namelist():
            if member.endswith("/"):
                continue
            if not member.lower().endswith(DATA_SUFFIXES):
                continue
            with archive.open(member) as handle:
                stream = io.TextIOWrapper(handle, encoding="utf-8", errors="replace")
                try:
                    yielded = 0
                    for row in iter_rows(stream, state=state):
                        yielded += 1
                        yield row
                except UcmrParseError as exc:
                    log.info("skipping %s in archive: %s", member, exc)
                    continue
                log.info("read %s rows from %s", yielded, member)


def read_bulk_file(path: Path | str, *, state: str | None = "FL") -> list[dict[str, Any]]:
    """Read a UCMR bulk file from disk, ZIP or plain text.

    This is the practical entry point: EPA's download page is a human-facing
    page whose file URLs change per release, so rather than guess a URL, the
    ingest accepts a file the operator downloaded.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"UCMR bulk file not found: {path}")
    if zipfile.is_zipfile(path):
        return list(iter_zip_rows(path, state=state))
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        return list(iter_rows(handle, state=state))


def summarize(rows: Sequence[dict[str, Any]]) -> dict[str, Any]:
    """Counts for the ingest report, so a bulk load is auditable at a glance."""
    systems: set[str] = set()
    contaminants: set[str] = set()
    for row in rows:
        for key, value in row.items():
            normalized = _norm_key(key)
            if normalized == "pwsid" and value:
                systems.add(str(value))
            elif normalized == "contaminant" and value:
                contaminants.add(str(value))
    return {
        "rows": len(rows),
        "systems": len(systems),
        "contaminants": len(contaminants),
    }
