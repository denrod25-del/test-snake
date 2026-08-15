"""End-to-end ingest: fixtures in, published dataset out, then validated.

These run the real orchestrator over a fake HTTP transport, so the wiring
between the source clients, the normalizers, the profile assembler, and the
writer is exercised without touching the network.
"""
from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fwq import build, utilities
from fwq.__main__ import main as cli_main
from fwq.schema import DataStatus

from . import fixtures

RETRIEVED = datetime(2026, 8, 15, tzinfo=timezone.utc)

#: Fixture ingests write their learned contaminant-code map here instead of
#: into fwq/data/, so running the tests never mutates shipped package data.
_SCRATCH = tempfile.TemporaryDirectory()
CODEMAP = Path(_SCRATCH.name) / "sdwis_contaminant_codes.json"
unittest.addModuleCleanup(_SCRATCH.cleanup)


def _example_config() -> dict[str, utilities.UtilityConfig]:
    config = utilities.UtilityConfig.from_dict({
        "slug": "example",
        "name": "Example Shoreline Utility Authority",
        "pwsid_resolution": {"search_fragment": "SHORELINE", "expect_type": "CWS"},
        "priority_analytes": {"ids": ["pfoa", "pfos", "lead", "tthm"]},
    })
    config.pwsid = fixtures.SYNTHETIC_PWSID_A
    return {"example": config}


class TestIngestPipeline(unittest.TestCase):
    def setUp(self):
        self.client = fixtures.FakeClient()
        self.result = build.ingest_state(
            self.client,
            state="FL",
            focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
            retrieved_at=RETRIEVED,
            codemap_path=CODEMAP,
        )

    def test_inventory_and_deep_pull_both_land(self):
        self.assertEqual(len(self.result.systems), 3)
        self.assertEqual(len(self.result.violations), 2)  # third row lacks an id
        self.assertTrue(self.result.results)
        self.assertEqual(self.result.overall_status, DataStatus.LIVE)

    def test_normalization_report_records_every_drop(self):
        report = self.result.report
        self.assertEqual(report.skipped["violation_missing_key"], 1)
        self.assertIn("EXAMPLIUM-7", report.unmapped_analytes)

    def test_blocked_inventory_yields_a_blocked_dataset_not_an_empty_one(self):
        blocked = build.ingest_state(
            fixtures.FakeClient(fail={"water_system"}),
            focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
            retrieved_at=RETRIEVED,
            codemap_path=CODEMAP,
        )
        self.assertEqual(blocked.overall_status, DataStatus.BLOCKED)
        self.assertEqual(blocked.systems, [])

    def test_one_degraded_section_downgrades_live_to_cached(self):
        degraded = build.ingest_state(
            fixtures.FakeClient(fail={"ucmr5"}),
            focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
            retrieved_at=RETRIEVED,
            codemap_path=CODEMAP,
        )
        self.assertTrue(degraded.systems, "the inventory still succeeded")
        self.assertEqual(degraded.overall_status, DataStatus.CACHED)


    def test_the_test_run_never_writes_into_the_packages_data_directory(self):
        # Regression: `ingest_state` used to persist the learned SDWIS
        # contaminant-code map straight into fwq/data/, so merely running the
        # suite wrote fixture-derived mappings into shipped package data — and
        # very nearly committed invented contaminant codes.
        shipped = build.CODEMAP_PATH
        before = shipped.read_text() if shipped.exists() else None
        build.ingest_state(
            fixtures.FakeClient(),
            focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
            retrieved_at=RETRIEVED,
            codemap_path=CODEMAP,
        )
        after = shipped.read_text() if shipped.exists() else None
        self.assertEqual(before, after, f"{shipped} was modified by a test run")
        self.assertTrue(CODEMAP.exists(), "the scratch code map should have been written")

    def test_learned_code_map_separates_mapped_from_unmapped(self):
        build.ingest_state(
            fixtures.FakeClient(),
            focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
            retrieved_at=RETRIEVED,
            codemap_path=CODEMAP,
        )
        payload = json.loads(CODEMAP.read_text())
        self.assertEqual(payload["codes"]["2950"], "tthm")
        self.assertIn(
            "9999", payload["unmapped"],
            "codes EPA describes but we cannot map must be listed as a to-do",
        )


class TestProfileAssembly(unittest.TestCase):
    def setUp(self):
        self.configs = _example_config()
        self.result = build.ingest_state(
            fixtures.FakeClient(),
            focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
            retrieved_at=RETRIEVED,
            codemap_path=CODEMAP,
        )
        system = next(
            s for s in self.result.systems if s.pwsid == fixtures.SYNTHETIC_PWSID_A
        )
        self.profile = build.build_profile(
            system,
            results=self.result.results,
            violations=self.result.violations,
            boil_water=self.result.boil_water_notices,
            ccrs=self.result.ccr_documents,
            generated_at=RETRIEVED,
            config=self.configs["example"],
        )

    def test_summary_counts_the_pfoa_exceedance(self):
        summary = self.profile["summary"]
        self.assertEqual(summary["exceedanceCount"], 1)
        exceeded = {e["analyteId"] for e in self.profile["exceedances"]}
        self.assertEqual(exceeded, {"pfoa"})

    def test_pfas_hazard_index_is_present_and_marked_incomplete(self):
        hazard = self.profile["summary"]["pfas"]["hazardIndex"]
        self.assertAlmostEqual(hazard["value"], 0.7)
        self.assertFalse(hazard["complete"])
        self.assertIn("pfna", hazard["missingComponents"])

    def test_non_detects_appear_as_results_but_never_as_exceedances(self):
        pfos = next(r for r in self.profile["results"] if r["analyteId"] == "pfos")
        self.assertFalse(pfos["detected"])
        self.assertNotIn("comparison", pfos)
        self.assertNotIn("pfos", {e["analyteId"] for e in self.profile["exceedances"]})

    def test_priority_analytes_are_surfaced_first(self):
        priority = [r["analyteId"] for r in self.profile["priorityResults"]]
        self.assertEqual(priority[0], "pfoa")
        self.assertIn("lead", priority)

    def test_every_result_carries_provenance(self):
        for record in self.profile["results"]:
            with self.subTest(analyte=record["analyteId"]):
                provenance = record.get("provenance", {})
                self.assertTrue(provenance.get("source"))
                self.assertTrue(provenance.get("retrievedAt"))


class TestDatasetWriting(unittest.TestCase):
    def test_write_then_validate_round_trip(self):
        configs = _example_config()
        result = build.ingest_state(
            fixtures.FakeClient(),
            focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
            retrieved_at=RETRIEVED,
            codemap_path=CODEMAP,
        )
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            manifest = build.write_dataset(result, configs, out_dir=out)

            for name in (
                "index.json", "analytes.json", "systems.json",
                "service-index.json", "utilities.json", "ingest-report.json",
            ):
                self.assertTrue((out / name).exists(), name)
            profile_path = out / "systems" / f"{fixtures.SYNTHETIC_PWSID_A}.json"
            self.assertTrue(profile_path.exists())

            self.assertEqual(manifest["counts"]["systems"], 3)
            self.assertEqual(manifest["counts"]["profiles"], 1)
            self.assertEqual(manifest["meta"]["status"], "live")

            # The CLI validator must pass on freshly written output.
            self.assertEqual(cli_main(["--out", str(out), "validate"]), 0)

    def test_validator_catches_a_non_detect_carrying_an_exceedance(self):
        configs = _example_config()
        result = build.ingest_state(
            fixtures.FakeClient(),
            focus_pwsids=[fixtures.SYNTHETIC_PWSID_A],
            retrieved_at=RETRIEVED,
            codemap_path=CODEMAP,
        )
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            build.write_dataset(result, configs, out_dir=out)
            profile_path = out / "systems" / f"{fixtures.SYNTHETIC_PWSID_A}.json"
            profile = json.loads(profile_path.read_text())
            corrupted = next(r for r in profile["results"] if not r["detected"])
            corrupted["comparison"] = {"exceeds": True, "limitKind": "MCL"}
            profile_path.write_text(json.dumps(profile))

            self.assertEqual(
                cli_main(["--out", str(out), "validate"]), 1,
                "the validator must reject a non-detect presented as an exceedance",
            )

    def test_utilities_file_withholds_an_unverified_website_url(self):
        configs = utilities.load_configs()
        result = build.ingest_state(fixtures.FakeClient(), retrieved_at=RETRIEVED, codemap_path=CODEMAP)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            build.write_dataset(result, configs, out_dir=out)
            payload = json.loads((out / "utilities.json").read_text())
            seacoast = next(u for u in payload["utilities"] if u["slug"] == "seacoast")
            self.assertIsNone(
                seacoast["website"],
                "an unprobed URL must not be published as a working link",
            )
            self.assertTrue(seacoast["websiteUnverified"])

    def test_manifest_declares_its_endpoints_and_limitations(self):
        result = build.ingest_state(fixtures.FakeClient(), retrieved_at=RETRIEVED, codemap_path=CODEMAP)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            manifest = build.write_dataset(result, {}, out_dir=out)
            self.assertIn("lookup", manifest["endpoints"])
            self.assertIn("not a substitute", manifest["meta"]["limitations"].lower())


if __name__ == "__main__":
    unittest.main()
