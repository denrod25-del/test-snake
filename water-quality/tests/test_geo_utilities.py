"""Service-area lookup and utility PWSID resolution."""
from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone

from fwq import normalize, utilities
from fwq import geo as geo_module
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


class FakeGeocoder:
    """Stands in for the Census Bureau geocoder.

    `payload` is returned verbatim; `raise_with` simulates the geocoder being
    unreachable, which must be distinguished from an address that simply does
    not match.
    """

    def __init__(self, payload=None, raise_with: Exception | None = None):
        self.payload = payload
        self.raise_with = raise_with
        self.urls: list[str] = []

    def get_json(self, url, *, empty_on_404: bool = True):
        self.urls.append(url)
        if self.raise_with is not None:
            raise self.raise_with
        return self.payload


def _census_match(zip_code="33410", city="EXAMPLE GARDENS", state="FL"):
    return {"result": {"addressMatches": [{
        "matchedAddress": f"1 EXAMPLE ST, {city}, {state}, {zip_code}",
        "addressComponents": {"zip": zip_code, "city": city, "state": state},
        "coordinates": {"x": -80.1, "y": 26.8},
    }]}}


class TestAddressResolution(unittest.TestCase):
    def setUp(self):
        self.index = ServiceIndex.from_systems(_systems())

    def test_geocode_extracts_the_fields_the_lookup_needs(self):
        client = FakeGeocoder(_census_match())
        geo = geo_module.geocode_address(client, "1 Example St, Example Gardens FL")
        self.assertEqual(geo["zip"], "33410")
        self.assertEqual(geo["state"], "FL")
        self.assertEqual((geo["lat"], geo["lon"]), (26.8, -80.1))

    def test_address_is_url_encoded_into_the_request(self):
        client = FakeGeocoder(_census_match())
        geo_module.geocode_address(client, "1 Example St #4, Palm Beach Gardens")
        self.assertNotIn(" ", client.urls[0])
        self.assertIn("%23", client.urls[0], "the '#' must be encoded, not truncate the URL")

    def test_zip_plus_four_from_the_geocoder_is_truncated(self):
        client = FakeGeocoder(_census_match(zip_code="33410-1234"))
        self.assertEqual(geo_module.geocode_address(client, "x")["zip"], "33410")

    def test_no_match_returns_none(self):
        self.assertIsNone(
            geo_module.geocode_address(FakeGeocoder({"result": {"addressMatches": []}}), "x")
        )
        self.assertIsNone(geo_module.geocode_address(FakeGeocoder(None), "x"))

    def test_resolved_address_returns_ranked_candidates_and_states_its_method(self):
        result = geo_module.resolve_address(
            self.index, FakeGeocoder(_census_match()), "1 Example St"
        )
        self.assertEqual(result["method"], "geocode+zip+city")
        self.assertEqual(result["candidateCount"], 2)
        self.assertEqual(result["candidates"][0]["pwsid"], fixtures.SYNTHETIC_PWSID_A)
        self.assertEqual(result["geocode"]["zip"], "33410")

    def test_caveat_admits_this_is_not_a_service_area_boundary_lookup(self):
        result = geo_module.resolve_address(
            self.index, FakeGeocoder(_census_match()), "1 Example St"
        )
        self.assertIn("not a service-area boundary lookup", result["caveat"])

    def test_out_of_state_address_is_refused_rather_than_matched_by_zip(self):
        result = geo_module.resolve_address(
            self.index,
            FakeGeocoder(_census_match(zip_code="90210", city="BEVERLY HILLS", state="CA")),
            "1 Example St, Beverly Hills CA",
        )
        self.assertEqual(result["candidateCount"], 0)
        self.assertIn("outside Florida", result["caveat"])

    def test_unmatched_address_says_so_and_suggests_a_zip_lookup(self):
        result = geo_module.resolve_address(
            self.index, FakeGeocoder({"result": {"addressMatches": []}}), "nowhere"
        )
        self.assertEqual(result["candidateCount"], 0)
        self.assertIn("could not be geocoded", result["caveat"])

    def test_unreachable_geocoder_is_not_reported_as_a_bad_address(self):
        # These are different failures and the wording must not conflate them:
        # "we couldn't reach the geocoder" is our problem, "no such address" is
        # the user's, and only the second should send them to fix their input.
        result = geo_module.resolve_address(
            self.index, FakeGeocoder(raise_with=RuntimeError("connection refused")),
            "1 Example St",
        )
        self.assertEqual(result["candidateCount"], 0)
        self.assertIn("could not be reached", result["caveat"])
        self.assertNotIn("could not be geocoded", result["caveat"])


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

    def test_no_shipped_config_hardcodes_a_pwsid(self):
        # The whole audit trail depends on this. A PWSID typed into a config
        # bypasses name resolution, scoring, and the reviewable lockfile diff.
        for slug, config in utilities.load_configs().items():
            with self.subTest(slug=slug):
                self.assertIsNone(config.pwsid, f"{slug} pins a PWSID in its config")

    def test_every_shipped_config_is_resolvable_and_self_consistent(self):
        registry_ids = set(__import__("fwq.analytes", fromlist=["x"]).registry().analytes)
        for slug, config in utilities.load_configs().items():
            with self.subTest(slug=slug):
                self.assertTrue(config.name)
                self.assertTrue(
                    config.resolution.get("search_fragment"),
                    "resolution needs a search fragment or it cannot find the system",
                )
                self.assertEqual(config.state, "FL")
                unknown = set(config.priority_analytes) - registry_ids
                self.assertEqual(
                    unknown, set(),
                    f"{slug} lists analytes absent from analytes.json: {unknown}",
                )

    def test_no_config_publishes_an_unverified_url_as_verified(self):
        for slug, config in utilities.load_configs().items():
            for source in (*config.ccr_sources, *config.notice_sources):
                with self.subTest(slug=slug, source=source.id):
                    if source.verified:
                        self.fail(
                            f"{slug}/{source.id} claims verified=true, but no source "
                            "has been probed successfully from any environment yet"
                        )

    def test_slugs_and_search_fragments_are_distinct(self):
        configs = utilities.load_configs()
        fragments = [c.search_fragment.casefold() for c in configs.values()]
        self.assertEqual(
            len(fragments), len(set(fragments)),
            "two utilities sharing a search fragment would resolve to the same system",
        )

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
