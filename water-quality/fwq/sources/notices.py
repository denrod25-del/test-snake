"""Boil-water notice ingestion.

Florida publishes no statewide machine-readable boil-water-notice feed. A
notice is issued by the utility (or a county health department), posted to
whatever page that utility uses for alerts, and taken down or struck through
when it is rescinded. There is no identifier, no schema, and often no
structured date.

So this module does not pretend to be a feed reader. It is:

* a **registry** of per-utility notice pages with an extraction strategy each,
  following the same pattern as `scraper/sources_permits.json` elsewhere in
  this repo;
* a **classifier** (`classify_notice`) that reads notice prose and decides
  active vs rescinded and precautionary vs mandatory — pure, testable, and the
  part most likely to be wrong in an interesting way;
* a **manual entry** path, because during an actual boil-water event the
  fastest correct answer is often a human pasting the utility's own wording in.

Correctness bias: when the text is ambiguous, a notice stays `active`. Telling
somebody their water is safe when it is not is the one error mode here that
actually hurts people, so ambiguity resolves toward caution.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Literal, Sequence

from ..schema import BoilWaterNotice, Provenance, Source, validate_pwsid

log = logging.getLogger(__name__)

MANUAL_PATH = Path(__file__).parent.parent / "data" / "manual_notices.json"

RESCINDED_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"\brescind(?:ed|s)?\b",
        r"\blifted\b",
        r"\bcancell?ed\b",
        r"\bno longer in effect\b",
        r"\bhas been cleared\b",
        r"\bsafe to (?:drink|consume)\b",
        r"\bwater is safe\b",
        r"\bresolved\b",
        r"\bexpired\b",
        r"\bnow over\b",
    )
)

ACTIVE_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"\bboil\s+water\b",
        r"\bin effect\b",
        r"\buntil further notice\b",
        r"\bdo not drink\b",
        r"\bbring .{0,20}water to a (?:rolling )?boil\b",
    )
)

PRECAUTIONARY_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"\bprecaution(?:ary)?\b",
        r"\bas a precaution\b",
        r"\bPBWN\b",
    )
)

_ZIP_RE = re.compile(r"\b(3[23]\d{3})\b")  # Florida ZIPs are 32xxx-34xxx
_DATE_PATTERNS: tuple[str, ...] = (
    "%B %d, %Y", "%b %d, %Y", "%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%B %d %Y",
)


@dataclass(frozen=True)
class NoticeClassification:
    status: Literal["active", "rescinded", "unknown"]
    is_precautionary: bool | None
    #: Why the classifier decided what it decided, for auditability.
    rationale: str


def classify_notice(text: str, *, has_rescind_date: bool = False) -> NoticeClassification:
    """Decide whether a notice is still in effect from its own wording.

    An explicit rescission date wins outright. Otherwise the text is scanned for
    rescission language, and then for active-notice language.

    A notice that matches *both* — very common, because a rescission notice
    repeats the original boil-water wording while announcing its end — is
    treated as rescinded, since rescission language only appears once the event
    is over. A notice matching neither stays `unknown`, which downstream is
    displayed as still active.
    """
    body = re.sub(r"\s+", " ", text or "")
    if not body.strip():
        return NoticeClassification("unknown", None, "empty notice text")

    rescinded = [p.pattern for p in RESCINDED_PATTERNS if p.search(body)]
    active = [p.pattern for p in ACTIVE_PATTERNS if p.search(body)]
    precautionary = any(p.search(body) for p in PRECAUTIONARY_PATTERNS)
    is_precautionary: bool | None = True if precautionary else None

    if has_rescind_date:
        return NoticeClassification(
            "rescinded", is_precautionary, "explicit rescission date present"
        )
    if rescinded:
        return NoticeClassification(
            "rescinded", is_precautionary, f"rescission language: {rescinded[0]}"
        )
    if active:
        return NoticeClassification(
            "active", is_precautionary, f"active-notice language: {active[0]}"
        )
    return NoticeClassification(
        "unknown", is_precautionary, "no decisive language; treated as still in effect"
    )


def extract_zips(text: str) -> list[str]:
    """Pull Florida ZIP codes out of a notice's area description."""
    return sorted(set(_ZIP_RE.findall(text or "")))


def parse_notice_date(text: str) -> date | None:
    """Find the first parseable date in a notice."""
    if not text:
        return None
    candidates = re.findall(
        r"(?:[A-Z][a-z]+ \d{1,2},? \d{4})|(?:\d{1,2}[/-]\d{1,2}[/-]\d{4})|(?:\d{4}-\d{2}-\d{2})",
        text,
    )
    for candidate in candidates:
        cleaned = candidate.replace(",", "").strip()
        for fmt in _DATE_PATTERNS:
            try:
                return datetime.strptime(cleaned, fmt.replace(",", "")).date()
            except ValueError:
                continue
    return None


def notice_id(pwsid: str, issued: date | datetime | None, text: str) -> str:
    """Stable id for a notice that upstream gave no identifier.

    Hashing the utility, the issue date, and the first 200 characters of the
    text means the same notice keeps its id across runs, while a genuinely new
    notice on the same day gets a different one.
    """
    stamp = issued.isoformat() if issued else "undated"
    excerpt = re.sub(r"\s+", " ", text or "")[:200]
    digest = hashlib.sha256(f"{pwsid}|{stamp}|{excerpt}".encode("utf-8")).hexdigest()[:12]
    return f"bwn-{pwsid}-{stamp}-{digest}"


@dataclass
class NoticeCandidate:
    """A block of text scraped from a utility notice page, before interpretation."""

    text: str
    url: str
    title: str | None = None
    published: date | None = None


def candidate_to_notice(
    candidate: NoticeCandidate, pwsid: str, retrieved_at: datetime
) -> BoilWaterNotice | None:
    """Interpret one scraped notice block, or `None` if it is not a BWN at all."""
    body = f"{candidate.title or ''} {candidate.text}".strip()
    if not re.search(r"boil\s*[- ]?\s*water", body, re.I):
        return None

    classification = classify_notice(body)
    issued = candidate.published or parse_notice_date(body) or retrieved_at.date()
    return BoilWaterNotice(
        pwsid=validate_pwsid(pwsid),
        notice_id=notice_id(pwsid, issued, body),
        provenance=Provenance(
            source=Source.UTILITY_NOTICE,
            retrieved_at=retrieved_at,
            source_url=candidate.url,
            note=f"status inferred from notice text ({classification.rationale})",
        ),
        issued_at=issued,
        status=classification.status,
        area_description=(candidate.title or candidate.text)[:500] or None,
        affected_zips=extract_zips(body),
        is_precautionary=classification.is_precautionary,
    )


def extract_candidates_from_html(
    html: str, url: str, *, selector: str | None = None
) -> list[NoticeCandidate]:
    """Pull plausible notice blocks out of a utility alerts page.

    Without a configured CSS selector this falls back to scanning common
    content containers for blocks mentioning boil water. It is deliberately
    permissive: `candidate_to_notice` does the filtering, and a false positive
    that never mentions boil water is dropped there.
    """
    try:
        from bs4 import BeautifulSoup  # type: ignore[import-untyped]
    except ImportError:
        log.warning("beautifulsoup4 not installed; notice pages will not be parsed")
        return []

    soup = BeautifulSoup(html, "html.parser")
    if selector:
        blocks = soup.select(selector)
    else:
        blocks = soup.find_all(["article", "li", "section", "div"])

    out: list[NoticeCandidate] = []
    seen: set[str] = set()
    for block in blocks:
        text = re.sub(r"\s+", " ", block.get_text(" ")).strip()
        if not (40 <= len(text) <= 4000):
            continue
        if not re.search(r"boil\s*[- ]?\s*water", text, re.I):
            continue
        key = text[:200]
        if key in seen:
            continue
        seen.add(key)
        heading = block.find(["h1", "h2", "h3", "h4"])
        out.append(
            NoticeCandidate(
                text=text,
                url=url,
                title=re.sub(r"\s+", " ", heading.get_text(" ")).strip() if heading else None,
                published=parse_notice_date(text),
            )
        )
    return out


def load_manual_notices() -> list[BoilWaterNotice]:
    """Load hand-entered notices.

    During a live event a person transcribing the utility's own wording beats
    any scraper. These entries are merged with scraped notices and are marked
    with a `manual entry` provenance note so their origin stays visible.
    """
    if not MANUAL_PATH.exists():
        return []
    payload = json.loads(MANUAL_PATH.read_text(encoding="utf-8"))
    out: list[BoilWaterNotice] = []
    for entry in payload.get("notices", []):
        issued = entry["issuedAt"]
        issued_date = date.fromisoformat(issued[:10])
        rescinded = entry.get("rescindedAt")
        out.append(
            BoilWaterNotice(
                pwsid=entry["pwsid"],
                notice_id=entry.get("noticeId")
                or notice_id(entry["pwsid"], issued_date, entry.get("areaDescription", "")),
                provenance=Provenance(
                    source=Source.UTILITY_NOTICE,
                    retrieved_at=datetime.now(timezone.utc),
                    source_url=entry.get("sourceUrl"),
                    note="manual entry transcribed from the utility's published notice",
                ),
                issued_at=issued_date,
                status=entry.get("status", "active"),
                rescinded_at=date.fromisoformat(rescinded[:10]) if rescinded else None,
                area_description=entry.get("areaDescription"),
                affected_zips=entry.get("affectedZips", []),
                affected_streets=entry.get("affectedStreets", []),
                reason=entry.get("reason"),
                is_precautionary=entry.get("isPrecautionary"),
            )
        )
    return out
