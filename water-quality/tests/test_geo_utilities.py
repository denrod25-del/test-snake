"""Service-area lookup and utility PWSID resolution."""
from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone

from fwq import normalize, utilities
from fwq.geo import ServiceIndex

from . import fixtures

RETRIEVED = datetime(2026, 8, 15, tzinfo=timezone.utc)


def _systems():
    return [
        normalize.normalize_water_system(
            row, RETRIEVED, geographic_rows=fixtures.GEOGRAPHIC_AREA_ROWS
        )
        for row in fixtures.WATER_SYSTEM_ROWS
    ]


class TestServiceIndex(unittest.TestCase):
    def setUp(self):
        self.index = ServiceIndex.from_systems(_systems())

    def test_index_round_trips_through_json(self):
        restored = ServiceIndex.from_dict(json.loads(json.dumps(self.index.to_dict())))
        self.assertEqual(
            restored.lookup_zip("33410")["candidateCount"],
            self.index.lookup_zip("33410")["candidateCount"],
        )

    def test_shared_zip_returns_all_candidates_and_is_not_definitive(self):
        result = self.index.lookup_zip("33410")
        self.assertEqual(result["candidateCount"], 2)
        self.assertFalse(
            result["isDefinitive"],
            "two systems serve this ZIP, so no single answer is defensible",
        )
        self.assertIn("mail routes", result["caveat"])

    def test_community_system_outranks_a_transient_one(self):
        result = self.index.lookup_zip("33410")
        first = result["candidates"][0]
        self.assertEqual(first["pwsid"], fixtures.SYNTHETIC_PWSID_A)
        self.assertEqual(first["systemType"], "community")

    def test_single_system_zip_is_definitive(self):
        result = self.index.lookup_zip("33408")
        self.assertEqual(result["candidateCount"], 1)
        self.assertTrue(result["isDefinitive"])

    def test_city_narrows_and_is_recorded_as_a_reason(self):
        result = self.index.lookup_zip("33410", city="North Example")
        self.assertEqual(result["method"], "zip+city")
        top = result["candidates"][0]
        self.assertEqual(top["pwsid"], fixtures.SYNTHETIC_PWSID_A)
        self.assertTrue(any("North Example" in r for r in top["reasons"]))

    def test_inactive_system_is_penalised(self):
        result = self.index.lookup_zip("33999")
        self.assertEqual(result["candidates"][0]["pwsid"], fixtures.SYNTHETIC_PWSID_C)
        self.assertTrue(
            any("inactive" in r for r in result["candidates"][0]["reasons"])
        )

    def test_zip_plus_four_input_is_normalized(self):
        self.assertEqual(
            self.index.lookup_zip("33408-1234")["candidateCount"],
            self.index.lookup_zip("33408")["candidateCount"],
        )

    def test_unknown_zip_explains_itself_instead_of_returning_empty(self):
        result = self.index.lookup_zip("90210")
        self.assertEqual(result["candidateCount"], 0)
        self.assertIn("private wells", result["caveat"])

    def test_invalid_zip_is_rejected(self):
        self.assertEqual(self.index.lookup_zip("abc")["method"], "none")

    def test_city_lookup(self):
        result = self.index.lookup_city("Example Gardens")
        self.assertEqual(result["candidateCount"], 2)
        self.assertFalse(result["isDefinitive"])


class TestUtilityResolution(unittest.TestCase):
    def setUp(self):
        self.config = utilities.UtilityConfig.from_dict({
            "slug": "example",
            "name": "Example Shoreline Utility Authority",
            "pwsid_resolution": {
                "search_fragment": "SHORELINE",
                "expect_type": "CWS",
                "expect_counties": ["Palm Beach"],
                "expect_population_min": 50000,
            },
        })

    def test_seacoast_config_ships_without_a_hardcoded_pwsid(self):
        configs = utilities.load_configs()
        self.assertIn("seacoast", configs)
        seacoast = configs["seacoast"]
        self.assertIsNone(
            seacoast.pwsid,
            "a guessed PWSID would attach another utility's data to Seacoast",
        )
        self.assertEqual(seacoast.resolution["search_fragment"], "SEACOAST")
        self.assertTrue(seacoast.priority_analytes)

    def test_correct_system_wins_with_high_confidence(self):
        outcome = utilities.resolve_pwsid(
            self.config,
            fixtures.WATER_SYSTEM_ROWS,
            geographic_rows=fixtures.GEOGRAPHIC_AREA_ROWS,
        )
        self.assertEqual(outcome.pwsid, fixtures.SYNTHETIC_PWSID_A)
        self.assertEqual(outcome.confidence, "high")
        self.assertTrue(outcome.checks["typeMatches"])
        self.assertTrue(outcome.checks["meetsPopulationMinimum"])
        self.assertTrue(outcome.checks["countyMatches"])

    def test_rejected_candidates_are_recorded_for_review(self):
        outcome = utilities.resolve_pwsid(self.config, fixtures.WATER_SYSTEM_ROWS)
        rejected = {r["pwsid"] for r in outcome.rejected}
        self.assertIn(fixtures.SYNTHETIC_PWSID_B, rejected)

    def test_no_candidates_yields_unresolved_not_a_wrong_guess(self):
        outcome = utilities.resolve_pwsid(self.config, [])
        self.assertIsNone(outcome.pwsid)
        self.assertEqual(outcome.confidence, "unresolved")
        self.assertTrue(outcome.warnings)

    def test_a_weak_match_is_flagged_rather_than_accepted_silently(self):
        config = utilities.UtilityConfig.from_dict({
            "slug": "weak",
            "name": "Example Inland Water District",
            "pwsid_resolution": {
                "search_fragment": "INLAND",
                "expect_type": "CWS",
                "expect_population_min": 500000,
            },
        })
        outcome = utilities.resolve_pwsid(config, [fixtures.WATER_SYSTEM_ROWS[2]])
        self.assertNotEqual(outcome.confidence, "high")
        self.assertTrue(outcome.warnings)

    def test_low_confidence_resolution_is_not_applied_to_configs(self):
        configs = {"weak": utilities.UtilityConfig.from_dict(
            {"slug": "weak", "name": "Weak"}
        )}
        utilities.apply_lockfile(configs, {
            "utilities": {"weak": {"pwsid": "FL9990009", "confidence": "low"}}
        })
        self.assertIsNone(configs["weak"].pwsid)

    def test_high_confidence_resolution_is_applied(self):
        configs = {"ok": utilities.UtilityConfig.from_dict(
            {"slug": "ok", "name": "OK"}
        )}
        utilities.apply_lockfile(configs, {
            "utilities": {"ok": {"pwsid": "FL9990009", "confidence": "high"}}
        })
        self.assertEqual(configs["ok"].pwsid, "FL9990009")


if __name__ == "__main__":
    unittest.main()
