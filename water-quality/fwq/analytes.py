"""Canonical analyte registry and name resolution.

The single hardest part of normalizing drinking-water data is deciding that two
rows are talking about the same substance. "PFOA", "Perfluorooctanoic acid",
"PFOA (C8)", and CASRN 335-67-1 all appear in real feeds, sometimes in the same
utility's paperwork. This module collapses all of them onto one `Analyte`.

Resolution order is strongest-signal-first:

1. **CASRN** — an exact chemical identifier. Trusted above any name.
2. **Canonical id** — our own slug, for round-tripping our own output.
3. **Name / alias** — normalized string match, including a pass that strips or
   isolates a parenthetical (so both "Total trihalomethanes (TTHM)" and
   "TTHM" hit `tthm`).
4. **SDWIS contaminant code** — numeric codes from EPA's SDWIS tables, held in
   a learned side-table because EPA publishes them as reference data rather
   than as a stable documented list.

Anything that resolves to nothing returns `None`. Callers must record the miss
rather than dropping the row: an unmapped analyte is a gap in this table, and
silently discarding it would make the API quietly incomplete.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

from . import units

_DATA_DIR = Path(__file__).parent / "data"
_ANALYTES_PATH = _DATA_DIR / "analytes.json"
#: Learned SDWIS numeric contaminant code -> analyte id. Populated by the
#: ingest from EPA's own reference tables; see `fwq.sources.envirofacts`.
_CODEMAP_PATH = _DATA_DIR / "sdwis_contaminant_codes.json"

#: Limit kinds that represent an enforceable ceiling a result can exceed.
ENFORCEABLE_KINDS: frozenset[str] = frozenset({"MCL", "AL", "MRDL"})


@dataclass(frozen=True)
class Limit:
    kind: str
    value: float | None
    unit: str | None
    authority: str
    citation: str
    basis: str | None = None
    note: str | None = None

    @property
    def is_enforceable(self) -> bool:
        return self.kind in ENFORCEABLE_KINDS and self.value is not None

    def to_dict(self) -> dict[str, Any]:
        d = {
            "kind": self.kind,
            "value": self.value,
            "unit": self.unit,
            "authority": self.authority,
            "citation": self.citation,
        }
        if self.basis:
            d["basis"] = self.basis
        if self.note:
            d["note"] = self.note
        return d


@dataclass(frozen=True)
class Analyte:
    id: str
    name: str
    short_name: str
    group: str
    display_unit: str
    casrn: str | None = None
    health_basis: str | None = None
    aliases: tuple[str, ...] = ()
    limits: tuple[Limit, ...] = ()
    is_aggregate: bool = False
    components: tuple[str, ...] = ()

    def limit(self, kind: str) -> Limit | None:
        for lim in self.limits:
            if lim.kind == kind:
                return lim
        return None

    @property
    def enforceable_limit(self) -> Limit | None:
        """The limit a result is judged against, if the analyte has one.

        MCL first, then the Lead and Copper Rule action level, then MRDL for
        disinfectant residuals. Secondary standards are deliberately excluded:
        exceeding an SMCL is an aesthetic issue, not a violation, and conflating
        the two would overstate risk.
        """
        for kind in ("MCL", "AL", "MRDL"):
            lim = self.limit(kind)
            if lim is not None and lim.value is not None:
                return lim
        return None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "shortName": self.short_name,
            "group": self.group,
            "displayUnit": self.display_unit,
            "limits": [lim.to_dict() for lim in self.limits],
        }
        if self.casrn:
            d["casrn"] = self.casrn
        if self.health_basis:
            d["healthBasis"] = self.health_basis
        if self.is_aggregate:
            d["isAggregate"] = True
        if self.components:
            d["components"] = list(self.components)
        return d


@dataclass
class Registry:
    analytes: dict[str, Analyte]
    hazard_index_components: tuple[str, ...]
    hazard_index_limit: float
    version: str
    limit_review: dict[str, Any]
    _by_casrn: dict[str, str] = field(default_factory=dict)
    _by_name: dict[str, str] = field(default_factory=dict)
    _by_code: dict[str, str] = field(default_factory=dict)

    # -- lookup ------------------------------------------------------------

    def get(self, analyte_id: str) -> Analyte | None:
        return self.analytes.get(analyte_id)

    def resolve(
        self,
        name: str | None = None,
        casrn: str | None = None,
        code: str | int | None = None,
    ) -> Analyte | None:
        """Resolve an analyte from any combination of identifiers."""
        if casrn:
            aid = self._by_casrn.get(_norm_casrn(casrn))
            if aid:
                return self.analytes[aid]
        if name:
            direct = self.analytes.get(str(name).strip().casefold())
            if direct:
                return direct
            for key in _name_keys(name):
                aid = self._by_name.get(key)
                if aid:
                    return self.analytes[aid]
        if code is not None:
            aid = self._by_code.get(str(code).strip().lstrip("0") or "0")
            if aid:
                return self.analytes[aid]
        return None

    def by_group(self, group: str) -> list[Analyte]:
        return sorted(
            (a for a in self.analytes.values() if a.group == group),
            key=lambda a: a.short_name.casefold(),
        )

    @property
    def groups(self) -> list[str]:
        return sorted({a.group for a in self.analytes.values()})

    def register_code(self, code: str | int, analyte_id: str) -> None:
        """Attach a SDWIS numeric contaminant code to an analyte at runtime."""
        if analyte_id in self.analytes:
            self._by_code[str(code).strip().lstrip("0") or "0"] = analyte_id


# --- normalization helpers --------------------------------------------------

_PAREN = re.compile(r"\(([^)]*)\)")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def _norm_casrn(raw: str) -> str:
    """CASRNs are `\\d{2,7}-\\d{2}-\\d`. Strip anything that is not that shape."""
    s = re.sub(r"[^0-9-]", "", str(raw))
    return s.strip("-")


def _flatten(s: str) -> str:
    return _NON_ALNUM.sub("", str(s).casefold())


def _name_keys(raw: str, *, for_index: bool = False) -> list[str]:
    """Candidate lookup keys for a contaminant name, best guess first.

    Always yields the flattened whole string and the string with any
    parenthetical removed, so "Haloacetic acids (HAA5)" reaches `haa5` through
    its registered `haloacetic acids` alias.

    A parenthetical's *own contents* are only used when resolving an incoming
    name (`for_index=False`), never when building the index. Parentheticals
    carry two different kinds of content — an abbreviation ("(HAA5)") and a
    measurement qualifier ("(as Cl2)") — and indexing the qualifier would make
    every "(as Cl2)" analyte collide. Abbreviations that matter are spelled out
    as explicit `aliases` in analytes.json instead.
    """
    s = str(raw).strip()
    keys: list[str] = []

    def _add(candidate: str) -> None:
        k = _flatten(candidate)
        if k and k not in keys:
            keys.append(k)

    _add(s)
    stripped = _PAREN.sub("", s).strip(" ,;-")
    if stripped:
        _add(stripped)
    if not for_index:
        for part in _PAREN.findall(s):
            _add(part)
    # Trailing qualifiers labs append that do not change substance identity.
    for suffix in (", total", " total", ", dissolved", ", filtered", ", unfiltered"):
        if s.casefold().endswith(suffix):
            _add(s[: -len(suffix)])
    return keys


# --- loading ----------------------------------------------------------------


def _build(raw: dict[str, Any], codemap: dict[str, str]) -> Registry:
    analytes: dict[str, Analyte] = {}
    by_casrn: dict[str, str] = {}
    by_name: dict[str, str] = {}

    for entry in raw["analytes"]:
        limits = tuple(
            Limit(
                kind=l["kind"],
                value=l.get("value"),
                unit=l.get("unit"),
                authority=l.get("authority", "unknown"),
                citation=l.get("citation", ""),
                basis=l.get("basis"),
                note=l.get("note"),
            )
            for l in entry.get("limits", [])
        )
        for lim in limits:
            if lim.unit is not None and not units.is_known_unit(lim.unit):
                raise ValueError(
                    f"analyte {entry['id']}: limit {lim.kind} uses unregistered "
                    f"unit {lim.unit!r}"
                )
        if not units.is_known_unit(entry["display_unit"]):
            raise ValueError(
                f"analyte {entry['id']}: unregistered display_unit "
                f"{entry['display_unit']!r}"
            )

        analyte = Analyte(
            id=entry["id"],
            name=entry["name"],
            short_name=entry.get("short_name", entry["name"]),
            group=entry["group"],
            display_unit=entry["display_unit"],
            casrn=entry.get("casrn"),
            health_basis=entry.get("health_basis"),
            aliases=tuple(entry.get("aliases", ())),
            limits=limits,
            is_aggregate=bool(entry.get("is_aggregate", False)),
            components=tuple(entry.get("components", ())),
        )
        if analyte.id in analytes:
            raise ValueError(f"duplicate analyte id: {analyte.id}")
        analytes[analyte.id] = analyte

        if analyte.casrn:
            by_casrn[_norm_casrn(analyte.casrn)] = analyte.id
        for label in (analyte.id, analyte.name, analyte.short_name, *analyte.aliases):
            for key in _name_keys(label, for_index=True):
                existing = by_name.get(key)
                if existing and existing != analyte.id:
                    raise ValueError(
                        f"alias collision on {key!r}: {existing} vs {analyte.id}"
                    )
                by_name[key] = analyte.id

    hi = raw.get("hazard_index", {})
    for comp in hi.get("components", []):
        if comp not in analytes:
            raise ValueError(f"hazard_index references unknown analyte {comp!r}")
        if analytes[comp].limit("HBWC") is None:
            raise ValueError(f"hazard_index component {comp!r} has no HBWC limit")

    registry = Registry(
        analytes=analytes,
        hazard_index_components=tuple(hi.get("components", ())),
        hazard_index_limit=float(hi.get("limit", 1.0)),
        version=raw.get("version", "unknown"),
        limit_review=raw.get("limit_review", {}),
        _by_casrn=by_casrn,
        _by_name=by_name,
    )
    for code, aid in codemap.items():
        registry.register_code(code, aid)
    return registry


@lru_cache(maxsize=1)
def registry() -> Registry:
    """Load and index the analyte table. Cached for the process lifetime."""
    raw = json.loads(_ANALYTES_PATH.read_text(encoding="utf-8"))
    codemap: dict[str, str] = {}
    if _CODEMAP_PATH.exists():
        codemap = json.loads(_CODEMAP_PATH.read_text(encoding="utf-8")).get("codes", {})
    return _build(raw, codemap)


def resolve(
    name: str | None = None,
    casrn: str | None = None,
    code: str | int | None = None,
) -> Analyte | None:
    return registry().resolve(name=name, casrn=casrn, code=code)


def get(analyte_id: str) -> Analyte | None:
    return registry().get(analyte_id)


# --- PFAS Hazard Index ------------------------------------------------------


@dataclass(frozen=True)
class HazardIndex:
    """EPA PFAS mixture Hazard Index: sum of measured/HBWC across four PFAS."""

    value: float
    limit: float
    #: analyte id -> its contribution to the sum
    contributions: dict[str, float]
    #: components with no result available; the index understates risk by this much
    missing: tuple[str, ...]

    @property
    def exceeds(self) -> bool:
        return self.value > self.limit

    @property
    def is_complete(self) -> bool:
        return not self.missing

    def to_dict(self) -> dict[str, Any]:
        return {
            "value": round(self.value, 4),
            "limit": self.limit,
            "exceeds": self.exceeds,
            "complete": self.is_complete,
            "contributions": {k: round(v, 4) for k, v in self.contributions.items()},
            "missingComponents": list(self.missing),
        }


def hazard_index(concentrations_ng_l: dict[str, float | None]) -> HazardIndex:
    """Compute the PFAS Hazard Index from ng/L concentrations keyed by analyte id.

    A `None` value means "not measured" and is reported in `missing`, so a
    partial index is never mistaken for a complete one. A non-detect should be
    passed as `0.0`, not `None` — that is a measurement, and EPA's rule treats
    non-detects as zero contribution.
    """
    reg = registry()
    total = 0.0
    contributions: dict[str, float] = {}
    missing: list[str] = []
    for comp in reg.hazard_index_components:
        analyte = reg.analytes[comp]
        hbwc = analyte.limit("HBWC")
        assert hbwc is not None and hbwc.value  # validated at load time
        measured = concentrations_ng_l.get(comp)
        if measured is None:
            missing.append(comp)
            continue
        hbwc_ng_l = units.to_ng_l(hbwc.value, hbwc.unit or "ng/L")
        share = float(measured) / hbwc_ng_l
        contributions[comp] = share
        total += share
    return HazardIndex(
        value=total,
        limit=reg.hazard_index_limit,
        contributions=contributions,
        missing=tuple(missing),
    )


def all_analytes() -> Iterable[Analyte]:
    return registry().analytes.values()
