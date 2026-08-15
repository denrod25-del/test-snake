"""Boil-water notice classification and extraction.

This module carries more consequence per line than anything else in the
pipeline: its output tells someone whether their tap water is safe to drink.
The bias it is built around — ambiguity resolves toward "still in effect" — is
asserted here explicitly, because a future refactor that quietly flips it would
mark live notices as rescinded.

All notice text below is invented and uses the fictional FL999xxxx PWSIDs.
"""
from __future__ import annotations

import json
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest import mock

from fwq.sources import notices

from . import fixtures

RETRIEVED = datetime(2026, 8, 15, tzinfo=timezone.utc)


class TestClassification(unittest.TestCase):
    def test_active_notice_language(self):
        result = notices.classify_notice(
            "A precautionary boil water notice is in effect for customers on "
            "Example Street until further notice."
        )
        self.assertEqual(result.status, "active")
        self.assertTrue(result.is_precautionary)
        self.assertIn("active-notice language", result.rationale)

    def test_rescission_language_wins_over_repeated_boil_water_wording(self):
        # A rescission notice almost always restates the original warning while
        # announcing its end. Reading the restated warning as "still active"
        # would keep every resolved event permanently open.
        result = notices.classify_notice(
            "The boil water notice issued for the Example Gardens area has been "
            "rescinded. Customers no longer need to boil water before drinking."
        )
        self.assertEqual(result.status, "rescinded")

    def test_various_rescission_phrasings(self):
        for text in (
            "Boil water advisory lifted for the 33403 area.",
            "The boil water notice has been cancelled.",
            "Boil water notice: water is safe to drink as of this morning.",
            "The boil water advisory is no longer in effect.",
        ):
            with self.subTest(text=text):
                self.assertEqual(notices.classify_notice(text).status, "rescinded")

    def test_explicit_rescind_date_overrides_the_text(self):
        result = notices.classify_notice(
            "Boil water notice in effect until further notice.",
            has_rescind_date=True,
        )
        self.assertEqual(result.status, "rescinded")
        self.assertIn("explicit rescission date", result.rationale)

    def test_ambiguous_text_stays_unknown_and_is_treated_as_in_effect(self):
        result = notices.classify_notice("Crews are repairing a water main break.")
        self.assertEqual(result.status, "unknown")
        self.assertIn("still in effect", result.rationale)

    def test_empty_text_is_unknown_not_rescinded(self):
        self.assertEqual(notices.classify_notice("").status, "unknown")
        self.assertEqual(notices.classify_notice("   ").status, "unknown")

    def test_mandatory_notice_is_not_marked_precautionary(self):
        result = notices.classify_notice(
            "DO NOT DRINK. Boil water before consumption following a confirmed "
            "E. coli detection."
        )
        self.assertEqual(result.status, "active")
        self.assertIsNone(
            result.is_precautionary,
            "a mandatory notice must not be softened into a precautionary one",
        )

    def test_rationale_is_always_populated_for_auditability(self):
        for text in ("boil water in effect", "rescinded", "unrelated text", ""):
            with self.subTest(text=text):
                self.assertTrue(notices.classify_notice(text).rationale)


class TestExtraction(unittest.TestCase):
    def test_florida_zips_extracted_and_out_of_state_ignored(self):
        found = notices.extract_zips(
            "Affects 33410, 33403 and 32801 but not 90210 or 12345."
        )
        self.assertEqual(found, ["32801", "33403", "33410"])

    def test_no_zips_returns_empty_list(self):
        self.assertEqual(notices.extract_zips("No postal codes here."), [])

    def test_date_parsing_across_formats(self):
        cases = {
            "Issued August 3, 2026 at 4pm": date(2026, 8, 3),
            "Notice posted 08/03/2026": date(2026, 8, 3),
            "Effective 2026-08-03": date(2026, 8, 3),
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(notices.parse_notice_date(text), expected)

    def test_undated_text_returns_none(self):
        self.assertIsNone(notices.parse_notice_date("Issued this morning."))
        self.assertIsNone(notices.parse_notice_date(""))

    def test_notice_id_is_stable_for_the_same_notice(self):
        args = (fixtures.SYNTHETIC_PWSID_A, date(2026, 8, 3), "boil water notice text")
        self.assertEqual(notices.notice_id(*args), notices.notice_id(*args))

    def test_notice_id_differs_across_utilities_dates_and_text(self):
        base = notices.notice_id(fixtures.SYNTHETIC_PWSID_A, date(2026, 8, 3), "text one")
        self.assertNotEqual(
            base,
            notices.notice_id(fixtures.SYNTHETIC_PWSID_B, date(2026, 8, 3), "text one"),
        )
        self.assertNotEqual(
            base,
            notices.notice_id(fixtures.SYNTHETIC_PWSID_A, date(2026, 8, 4), "text one"),
        )
        self.assertNotEqual(
            base,
            notices.notice_id(fixtures.SYNTHETIC_PWSID_A, date(2026, 8, 3), "text two"),
        )

    def test_notice_id_ignores_whitespace_reflow(self):
        # The same notice re-scraped with different HTML wrapping must keep its id.
        self.assertEqual(
            notices.notice_id(fixtures.SYNTHETIC_PWSID_A, date(2026, 8, 3), "a  b\n c"),
            notices.notice_id(fixtures.SYNTHETIC_PWSID_A, date(2026, 8, 3), "a b c"),
        )


class TestCandidateConversion(unittest.TestCase):
    def _candidate(self, text: str) -> notices.NoticeCandidate:
        return notices.NoticeCandidate(
            text=text, url="https://example.test/alerts", title=None
        )

    def test_non_boil_water_content_is_rejected(self):
        self.assertIsNone(
            notices.candidate_to_notice(
                self._candidate("Scheduled hydrant flushing next week."),
                fixtures.SYNTHETIC_PWSID_A, RETRIEVED,
            )
        )

    def test_active_notice_becomes_a_record_with_zips_and_provenance(self):
        notice = notices.candidate_to_notice(
            self._candidate(
                "Precautionary boil water notice issued August 3, 2026 for ZIP "
                "33410 following a main break. In effect until further notice."
            ),
            fixtures.SYNTHETIC_PWSID_A, RETRIEVED,
        )
        self.assertIsNotNone(notice)
        self.assertEqual(notice.pwsid, fixtures.SYNTHETIC_PWSID_A)
        self.assertEqual(notice.status, "active")
        self.assertEqual(notice.issued_at, date(2026, 8, 3))
        self.assertEqual(notice.affected_zips, ["33410"])
        self.assertTrue(notice.is_precautionary)
        self.assertEqual(notice.provenance.source_url, "https://example.test/alerts")
        self.assertIn("status inferred", notice.provenance.note)

    def test_undated_notice_falls_back_to_the_retrieval_date(self):
        notice = notices.candidate_to_notice(
            self._candidate("Boil water notice in effect for the north service area."),
            fixtures.SYNTHETIC_PWSID_A, RETRIEVED,
        )
        self.assertEqual(notice.issued_at, RETRIEVED.date())

    def test_hyphenated_and_spaced_spellings_both_match(self):
        for spelling in ("boil water", "boil-water", "Boil Water", "boil  water"):
            with self.subTest(spelling=spelling):
                self.assertIsNotNone(
                    notices.candidate_to_notice(
                        self._candidate(f"A {spelling} notice is in effect."),
                        fixtures.SYNTHETIC_PWSID_A, RETRIEVED,
                    )
                )

    def test_serialized_notice_carries_status_and_provenance(self):
        notice = notices.candidate_to_notice(
            self._candidate("Boil water notice in effect for 33410."),
            fixtures.SYNTHETIC_PWSID_A, RETRIEVED,
        )
        payload = notice.to_dict()
        self.assertEqual(payload["status"], "active")
        self.assertEqual(payload["affectedZips"], ["33410"])
        self.assertTrue(payload["provenance"]["source"])
        self.assertTrue(payload["provenance"]["retrievedAt"])


class TestManualEntries(unittest.TestCase):
    def test_missing_file_yields_no_notices_rather_than_an_error(self):
        with mock.patch.object(notices, "MANUAL_PATH", Path("/nonexistent/x.json")):
            self.assertEqual(notices.load_manual_notices(), [])

    def test_manual_entries_load_with_a_visible_manual_provenance(self):
        payload = {
            "notices": [{
                "pwsid": fixtures.SYNTHETIC_PWSID_A,
                "issuedAt": "2026-08-03",
                "rescindedAt": "2026-08-05",
                "status": "rescinded",
                "areaDescription": "Example Gardens, north of Example Blvd",
                "affectedZips": ["33410"],
                "reason": "main break",
                "isPrecautionary": True,
                "sourceUrl": "https://example.test/notice",
            }]
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "manual_notices.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            with mock.patch.object(notices, "MANUAL_PATH", path):
                loaded = notices.load_manual_notices()

        self.assertEqual(len(loaded), 1)
        notice = loaded[0]
        self.assertEqual(notice.status, "rescinded")
        self.assertEqual(notice.issued_at, date(2026, 8, 3))
        self.assertEqual(notice.rescinded_at, date(2026, 8, 5))
        self.assertIn("manual entry", notice.provenance.note)
        self.assertTrue(notice.notice_id, "an id must be derived when none is given")

    def test_shipped_manual_file_parses_if_present(self):
        # The committed template must always be loadable; a syntax error there
        # would silently drop every hand-entered notice during a live event.
        if notices.MANUAL_PATH.exists():
            notices.load_manual_notices()


if __name__ == "__main__":
    unittest.main()
