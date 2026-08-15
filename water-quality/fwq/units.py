"""Unit normalization for water-quality measurements.

Every upstream source reports concentrations in whatever unit its lab or its
reporting rule happened to use. EPA's UCMR 5 PFAS extract uses ug/L, most
utility CCRs print PFAS as ppt and disinfection byproducts as ppb, SDWIS's
lead-and-copper table uses mg/L, and Florida CCR templates mix ppm and ppb in
the same table. Comparing anything across those sources means putting them all
on one scale first.

Design
------
Units are grouped into **dimensions**. Only units inside the same dimension are
convertible. `MASS_CONC` (mg/L, ug/L, ng/L, ppm, ppb, ppt, ...) is the dimension
that matters for contaminant limits and is normalized to **ng/L**, the finest
scale in common use, so PFAS values stay integer-ish and no conversion loses
precision by rounding toward zero.

The ppm/ppb/ppt <-> mg/L/ug/L/ng/L equivalence assumes dilute aqueous solution
at ~1 kg/L density. That is the same assumption EPA and every CCR make, and it
is exact enough that regulatory limits are written as if the units were
interchangeable. `PPX_ASSUMES_WATER_DENSITY` documents it for auditability.

Units outside `MASS_CONC` (pCi/L, NTU, MPN/100mL, pH, ...) are recognized and
canonicalized in spelling but never cross-converted; callers get a
`ConversionError` rather than a silently wrong number.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final

# Documented modeling assumption behind ppm == mg/L (see module docstring).
PPX_ASSUMES_WATER_DENSITY: Final[str] = (
    "ppm/ppb/ppt are treated as mg/L / ug/L / ng/L, assuming dilute aqueous "
    "solution at 1 kg/L. This is the convention used by EPA SDWIS and by CCR "
    "reporting rules."
)

# --- dimensions -------------------------------------------------------------

MASS_CONC: Final[str] = "mass_concentration"
RADIO_CONC: Final[str] = "radioactivity_concentration"
TURBIDITY: Final[str] = "turbidity"
MICROBIAL: Final[str] = "microbial_density"
CONDUCTIVITY: Final[str] = "conductivity"
ACIDITY: Final[str] = "acidity"
HARDNESS: Final[str] = "hardness"
DIMENSIONLESS: Final[str] = "dimensionless"

#: Canonical unit for each dimension. Values in `MASS_CONC` are stored as ng/L.
CANONICAL_UNIT: Final[dict[str, str]] = {
    MASS_CONC: "ng/L",
    RADIO_CONC: "pCi/L",
    TURBIDITY: "NTU",
    MICROBIAL: "MPN/100mL",
    CONDUCTIVITY: "uS/cm",
    ACIDITY: "pH",
    HARDNESS: "mg/L as CaCO3",
    DIMENSIONLESS: "unitless",
}


@dataclass(frozen=True)
class Unit:
    """A recognized unit: its canonical spelling, dimension, and scale."""

    canonical: str
    dimension: str
    #: Multiplier that converts a value in this unit to the dimension's
    #: canonical unit. `None` for dimensions with no linear scale (e.g. pH).
    to_canonical: float | None


class ConversionError(ValueError):
    """Raised when two units cannot be meaningfully converted."""


class UnknownUnitError(ValueError):
    """Raised when a unit string is not in the registry."""


def _u(canonical: str, dimension: str, factor: float | None) -> Unit:
    return Unit(canonical=canonical, dimension=dimension, to_canonical=factor)


# --- registry ---------------------------------------------------------------
# Keys are normalized spellings (see `_key`). Many upstream spellings map to the
# same Unit; that collapsing is the point.

_REGISTRY: Final[dict[str, Unit]] = {}


def _register(unit: Unit, *spellings: str) -> None:
    for s in spellings:
        _REGISTRY[_key(s)] = unit


def _key(raw: str) -> str:
    """Normalize a unit string for lookup.

    Folds case, strips whitespace and surrounding punctuation, and unifies the
    several ways sources write "micro" (`u`, `µ` U+00B5, `μ` U+03BC).
    """
    s = str(raw).strip().strip("()[]").strip()
    s = s.replace("µ", "u").replace("μ", "u")
    s = s.replace(" ", "")
    return s.casefold()


_MG_L = _u("mg/L", MASS_CONC, 1e6)
_UG_L = _u("ug/L", MASS_CONC, 1e3)
_NG_L = _u("ng/L", MASS_CONC, 1.0)
_PG_L = _u("pg/L", MASS_CONC, 1e-3)

_register(_MG_L, "mg/L", "mg/l", "MG/L", "ppm", "PPM", "mgl", "milligrams/liter",
          "mg per liter", "parts per million")
_register(_UG_L, "ug/L", "ug/l", "UG/L", "ppb", "PPB", "ugl", "micrograms/liter",
          "ug per liter", "parts per billion")
_register(_NG_L, "ng/L", "ng/l", "NG/L", "ppt", "PPT", "ngl", "nanograms/liter",
          "ng per liter", "parts per trillion")
_register(_PG_L, "pg/L", "pg/l", "ppq", "picograms/liter", "parts per quadrillion")

_register(_u("pCi/L", RADIO_CONC, 1.0), "pCi/L", "pci/l", "PCI/L", "picocuries/liter")
_register(_u("mrem/yr", RADIO_CONC, None), "mrem/yr", "mrem/year", "millirems/year")

_register(_u("NTU", TURBIDITY, 1.0), "NTU", "ntu", "nephelometric turbidity units")

_register(_u("MPN/100mL", MICROBIAL, 1.0), "MPN/100mL", "mpn/100ml", "MPN/100ML")
_register(_u("CFU/100mL", MICROBIAL, 1.0), "CFU/100mL", "cfu/100ml", "CFU/100ML")
_register(_u("presence/absence", MICROBIAL, None), "presence/absence", "P/A", "pa")
_register(_u("%positive", MICROBIAL, 1.0), "%positive", "% positive", "percentpositive")

_register(_u("uS/cm", CONDUCTIVITY, 1.0), "uS/cm", "us/cm", "umho/cm", "umhos/cm")
_register(_u("pH", ACIDITY, None), "pH", "ph", "standard units", "su", "pHunits")

_HARD_CACO3 = _u("mg/L as CaCO3", HARDNESS, 1.0)
_register(_HARD_CACO3, "mg/L as CaCO3", "mg/l as caco3", "ppm as CaCO3", "mgcaco3/l")
# 1 grain per gallon == 17.118 mg/L as CaCO3 (US grain, US gallon).
_register(_u("gpg", HARDNESS, 17.118), "gpg", "grains/gallon", "grains per gallon")

_register(_u("unitless", DIMENSIONLESS, 1.0), "unitless", "none", "n/a", "na", "")


# --- public API -------------------------------------------------------------


def parse_unit(raw: str | None) -> Unit:
    """Resolve a raw unit string to a registered `Unit`.

    Raises `UnknownUnitError` rather than guessing, so an unrecognized unit
    surfaces as a normalization warning instead of a wrong conversion.
    """
    if raw is None:
        raise UnknownUnitError("unit is None")
    try:
        return _REGISTRY[_key(raw)]
    except KeyError:
        raise UnknownUnitError(f"unrecognized unit: {raw!r}") from None


def is_known_unit(raw: str | None) -> bool:
    if raw is None:
        return False
    return _key(raw) in _REGISTRY


def canonical_unit_for(raw: str) -> str:
    """Canonical spelling of `raw`'s own unit (not its dimension's base unit)."""
    return parse_unit(raw).canonical


def convert(value: float, from_unit: str, to_unit: str) -> float:
    """Convert `value` between two units of the same dimension.

    Raises `ConversionError` across dimensions, and for dimensions that have no
    linear scale (pH, presence/absence) unless the units are identical.
    """
    src = parse_unit(from_unit)
    dst = parse_unit(to_unit)
    if src.dimension != dst.dimension:
        raise ConversionError(
            f"cannot convert {src.canonical} ({src.dimension}) to "
            f"{dst.canonical} ({dst.dimension})"
        )
    if src.canonical == dst.canonical:
        return float(value)
    if src.to_canonical is None or dst.to_canonical is None:
        raise ConversionError(
            f"{src.canonical} -> {dst.canonical} is not a linear conversion"
        )
    return float(value) * src.to_canonical / dst.to_canonical


def to_canonical(value: float, from_unit: str) -> tuple[float, str]:
    """Convert `value` to its dimension's canonical unit.

    Returns `(converted_value, canonical_unit)`. For non-linear dimensions the
    value passes through unchanged in its own canonical spelling.
    """
    src = parse_unit(from_unit)
    base = CANONICAL_UNIT[src.dimension]
    if src.to_canonical is None:
        return float(value), src.canonical
    return convert(value, src.canonical, base), base


def to_ng_l(value: float, from_unit: str) -> float:
    """Convert a mass concentration to ng/L. Raises outside `MASS_CONC`."""
    src = parse_unit(from_unit)
    if src.dimension != MASS_CONC:
        raise ConversionError(
            f"{src.canonical} is {src.dimension}, not a mass concentration"
        )
    return float(value) * src.to_canonical  # type: ignore[operator]


def dimension_of(raw: str) -> str:
    return parse_unit(raw).dimension


def format_quantity(value: float, unit: str, sig: int = 4) -> str:
    """Render a value for display without scientific notation for normal ranges."""
    if value == 0:
        return f"0 {unit}"
    magnitude = abs(value)
    if magnitude >= 1e6 or magnitude < 1e-4:
        return f"{value:.{sig}g} {unit}"
    decimals = max(0, sig - 1 - int(f"{magnitude:e}".split("e")[1]))
    return f"{value:.{min(decimals, 6)}f}".rstrip("0").rstrip(".") + f" {unit}"
