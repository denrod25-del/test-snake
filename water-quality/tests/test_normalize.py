"""Normalization of SDWIS, UCMR 5, and CCR rows into canonical records.

The recurring theme in these tests is the non-detect. Almost every way this
kind of dataset gets misrepresented traces back to treating "below the
reporting limit" as either a measurement or a zero.
"""
from __future__ import annotations

import unittest
from datetime import date, datetime, timezone

from fwq import normalize
from fwq.schema import Censoring, Provenance, Source
from fwq.sources import ccr

from . import fixtures

RETRIEVED = datetime(2026, 8, 15, tzinfo=timezone.utc)


class TestWaterSystemNormalization(unittest.TestCase):
    def test_system_fields_and_code_expansion(self):
        report = normalize.NormalizationReport()
        system = normalize.normalize_water_system(
            fixtures.WATER_SYSTEM_ROWS[0], RETRIEVED,
            geographic_rows=fixtures.GEOGRAPHIC_AREA_ROWS, report=report,
        )
        self.assertEqual(system.pwsid, fixtures.SYNTHETIC_PWSID_A)
        self.assertEqual(system.system_type, "community")
        self.assertEqual(system.primary_source, "groundwater")
        self.assertEqual(system.population_served, 78000)
        self.assertTrue(system.is_active)

    def test_inactive_system_flagged(self):
        system = normalize.normalize_water_system(
            fixtures.WATER_SYSTEM_ROWS[2], RETRIEVED
        )
        self.assertFalse(system.is_active)
        self.assertEqual(system.primary_source, "purchased surface water")

    def test_service_area_dedupes_and_truncates_zip_plus_four(self):
        system = normalize.normalize_water_system(
            fixtures.WATER_SYSTEM_ROWS[0], RETRIEVED,
            geographic_rows=fixtures.GEOGRAPHIC_AREA_ROWS,
        )
        area = system.service_area.to_dict()
        self.assertEqual(area["zips"], ["33408", "33410", "33418"])
        self.assertEqual(area["counties"], ["Palm Beach"])
        self.assertIn("Example Gardens", area["cities"])

    def test_row_without_pwsid_is_reported_not_crashed(self):
        report = normalize.NormalizationReport()
        self.assertIsNone(
            normalize.normalize_water_system({"pws_name": "X"}, RETRIEVED, report=report)
        )
        self.assertEqual(report.skipped["water_system_no_pwsid"], 1)


class TestViolationNormalization(unittest.TestCase):
    def test_resolved_violation_uses_return_to_compliance_date(self):
        violation = normalize.normalize_violation(
            fixtures.VIOLATION_ROWS[0], RETRIEVED,
            contaminant_names=fixtures.CONTAMINANT_CODES,
        )
        self.assertEqual(violation.category, "MCL")
        self.assertEqual(violation.analyte_id, "tthm")
        self.assertTrue(violation.resolved)
        self.assertFalse(violation.is_open)
        self.assertTrue(violation.is_health_based)
        self.assertEqual(violation.begin_date, date(2024, 1, 1))
        self.assertEqual(violation.public_notification_tier, 2)

    def test_open_monitoring_violation_is_not_health_based(self):
        violation = normalize.normalize_violation(
            fixtures.VIOLATION_ROWS[1], RETRIEVED,
            contaminant_names=fixtures.CONTAMINANT_CODES,
        )
        self.assertEqual(violation.category, "MR")
        self.assertTrue(violation.is_open)
        self.assertFalse(violation.is_health_based)

    def test_unmapped_contaminant_keeps_the_violation_with_its_label(self):
        report = normalize.NormalizationReport()
        violation = normalize.normalize_violation(
            fixtures.VIOLATION_ROWS[1], RETRIEVED,
            contaminant_names=fixtures.CONTAMINANT_CODES, report=report,
        )
        self.assertIsNone(violation.analyte_id)
        self.assertEqual(violation.unmapped_analyte, "Consumer Confidence Report")
        self.assertEqual(report.unmapped_analytes["Consumer Confidence Report"], 1)

    def test_row_missing_violation_id_is_skipped_and_counted(self):
        report = normalize.NormalizationReport()
        self.assertIsNone(
            normalize.normalize_violation(
                fixtures.VIOLATION_ROWS[2], RETRIEVED, report=report
            )
        )
        self.assertEqual(report.skipped["violation_missing_key"], 1)

    def test_summary_separates_open_health_based_from_paperwork(self):
        violations = [
            normalize.normalize_violation(
                row, RETRIEVED, contaminant_names=fixtures.CONTAMINANT_CODES
            )
            for row in fixtures.VIOLATION_ROWS[:2]
        ]
        summary = normalize.summarize_violations(violations)
        self.assertEqual(summary["total"], 2)
        self.assertEqual(summary["open"], 1)
        self.assertEqual(summary["healthBased"], 1)
        self.assertEqual(summary["openHealthBased"], 0)


class TestLeadCopperNormalization(unittest.TestCase):
    def test_lead_converts_mg_per_litre_to_micrograms(self):
        result = normalize.normalize_lcr_result(
            fixtures.LCR_ROWS[0], RETRIEVED,
            contaminant_names=fixtures.CONTAMINANT_CODES,
        )
        self.assertEqual(result.analyte_id, "lead")
        self.assertAlmostEqual(result.value, 4.0)  # 0.004 mg/L -> 4 ug/L
        self.assertEqual(result.unit, "ug/L")
        self.assertTrue(result.is_percentile_90)
        self.assertEqual(result.reported_unit, "mg/L")

    def test_lead_below_action_level_is_not_an_exceedance(self):
        result = normalize.normalize_lcr_result(
            fixtures.LCR_ROWS[0], RETRIEVED,
            contaminant_names=fixtures.CONTAMINANT_CODES,
        )
        comparison = result.compare_to_limit()
        self.assertEqual(comparison["limitKind"], "AL")
        self.assertEqual(comparison["limitValue"], 15.0)
        self.assertFalse(comparison["exceeds"])

    def test_sign_column_wins_over_value_column_for_non_detects(self):
        result = normalize.normalize_lcr_result(
            fixtures.LCR_ROWS[2], RETRIEVED,
            contaminant_names=fixtures.CONTAMINANT_CODES,
        )
        self.assertFalse(result.detected)
        self.assertIsNone(result.value, "a non-detect must not carry a measured value")
        self.assertEqual(result.censoring, Censoring.BELOW)
        self.assertAlmostEqual(result.detection_limit, 1.0)
        self.assertIsNone(
            result.compare_to_limit(),
            "a non-detect can never be reported as exceeding a limit",
        )


class TestUcmr5Normalization(unittest.TestCase):
    def test_pfoa_detection_converts_to_nanograms_and_exceeds_mcl(self):
        result = normalize.normalize_ucmr5_result(fixtures.UCMR5_ROWS[0], RETRIEVED)
        self.assertEqual(result.analyte_id, "pfoa")
        self.assertAlmostEqual(result.value, 6.2)  # 0.0062 ug/L -> 6.2 ng/L
        self.assertEqual(result.unit, "ng/L")
        self.assertTrue(result.detected)
        self.assertEqual(result.sample_date, date(2024, 5, 14))
        comparison = result.compare_to_limit()
        self.assertTrue(comparison["exceeds"])
        self.assertAlmostEqual(comparison["ratioToLimit"], 1.55)

    def test_non_detect_does_not_become_a_detection_at_the_reporting_limit(self):
        result = normalize.normalize_ucmr5_result(fixtures.UCMR5_ROWS[1], RETRIEVED)
        self.assertEqual(result.analyte_id, "pfos")
        self.assertFalse(result.detected)
        self.assertIsNone(result.value)
        self.assertAlmostEqual(result.detection_limit, 4.0)
        self.assertIsNone(result.compare_to_limit())

    def test_unmapped_analyte_is_reported_not_silently_dropped(self):
        report = normalize.NormalizationReport()
        self.assertIsNone(
            normalize.normalize_ucmr5_result(
                fixtures.UCMR5_ROWS[4], RETRIEVED, report=report
            )
        )
        self.assertEqual(report.unmapped_analytes["EXAMPLIUM-7"], 1)
        self.assertEqual(report.skipped["ucmr5_unmapped_analyte"], 1)


class TestAggregation(unittest.TestCase):
    def _results(self):
        return [
            r for r in (
                normalize.normalize_ucmr5_result(row, RETRIEVED)
                for row in fixtures.UCMR5_ROWS
            ) if r is not None
        ]

    def test_hazard_index_counts_non_detect_as_zero_but_measured(self):
        # PFHxS 5 ng/L -> 0.5, PFBS 400 ng/L -> 0.2, PFNA and HFPO-DA unsampled.
        index = normalize.pfas_hazard_index(self._results())
        self.assertAlmostEqual(index.value, 0.7)
        self.assertFalse(index.is_complete)
        self.assertIn("pfna", index.missing)

    def test_latest_by_analyte_prefers_a_detection_over_an_older_non_detect(self):
        results = [
            r for r in (
                normalize.normalize_lcr_result(
                    row, RETRIEVED, contaminant_names=fixtures.CONTAMINANT_CODES
                )
                for row in fixtures.LCR_ROWS
            ) if r is not None
        ]
        latest = normalize.latest_by_analyte(results)
        self.assertTrue(
            latest["lead"].detected,
            "the 2024 detection must win over the 2022 non-detect",
        )


class TestCCRParsing(unittest.TestCase):
    def setUp(self):
        self.provenance = Provenance(
            source=Source.CCR,
            retrieved_at=RETRIEVED,
            source_url="https://example.test/ccr-2024.pdf",
        )

    def test_measurement_cell_shapes(self):
        cases = {
            "ND": (None, False, Censoring.BELOW),
            "Non-Detect": (None, False, Censoring.BELOW),
            "< 0.5": (None, False, Censoring.BELOW),
            "0.0062": (0.0062, True, Censoring.NONE),
            "1,200": (1200.0, True, Censoring.NONE),
            "2.1 (1.0-3.5)": (2.1, True, Censoring.NONE),
        }
        for cell, (value, detected, censoring) in cases.items():
            with self.subTest(cell=cell):
                parsed = ccr.parse_measurement(cell)
                self.assertEqual(parsed.value, value)
                self.assertEqual(parsed.detected, detected)
                self.assertEqual(parsed.censoring, censoring)

    def test_bare_range_uses_the_midpoint_and_keeps_the_bounds(self):
        parsed = ccr.parse_measurement("18 - 61")
        self.assertAlmostEqual(parsed.value, 39.5)
        self.assertEqual((parsed.range_low, parsed.range_high), (18.0, 61.0))

    def test_not_measured_is_distinct_from_non_detect(self):
        not_measured = ccr.parse_measurement("N/A")
        self.assertTrue(not_measured.not_measured)
        self.assertEqual(not_measured.censoring, Censoring.NONE)

        non_detect = ccr.parse_measurement("ND")
        self.assertFalse(non_detect.not_measured)
        self.assertEqual(non_detect.censoring, Censoring.BELOW)

    def test_reported_zero_is_read_as_a_non_detect(self):
        parsed = ccr.parse_measurement("0")
        self.assertFalse(parsed.detected)
        self.assertEqual(parsed.censoring, Censoring.BELOW)

    def test_header_mapping_prefers_specific_columns(self):
        mapping = ccr.map_headers(fixtures.CCR_TABLE[0])
        self.assertEqual(mapping[0], "contaminant")
        self.assertEqual(mapping[1], "unit")
        self.assertEqual(mapping[4], "detected")
        self.assertEqual(mapping[5], "range_text")

    def test_full_table_converts_units_to_each_analyte_canonical_unit(self):
        rows = ccr.rows_from_table(fixtures.CCR_TABLE, default_year=2024)
        issues: list[ccr.ParseIssue] = []
        results = {
            r.analyte_id: r
            for r in (
                ccr.row_to_result(row, fixtures.SYNTHETIC_PWSID_A, self.provenance,
                                  issues=issues)
                for row in rows
            )
            if r is not None
        }

        # ppb stays ug/L for TTHM; ppm becomes mg/L for nitrate.
        self.assertAlmostEqual(results["tthm"].value, 42.0)
        self.assertEqual(results["tthm"].unit, "ug/L")
        self.assertAlmostEqual(results["nitrate"].value, 0.42)
        self.assertEqual(results["nitrate"].unit, "mg/L")
        self.assertEqual(results["nitrate"].sample_date, date(2024, 12, 31))

        # Lead is reported in ppb in the CCR but canonicalized to ug/L, and ND.
        self.assertFalse(results["lead"].detected)
        self.assertIsNone(results["lead"].compare_to_limit())

        # The unknown contaminant is reported, not silently dropped.
        self.assertNotIn("examplium", results)
        self.assertTrue(
            any(i.kind == "unmapped_analyte" and "Examplium" in i.raw for i in issues)
        )

    def test_reported_range_is_preserved_in_provenance(self):
        rows = ccr.rows_from_table(fixtures.CCR_TABLE, default_year=2024)
        tthm_row = next(r for r in rows if "TTHM" in r.contaminant)
        result = ccr.row_to_result(tthm_row, fixtures.SYNTHETIC_PWSID_A, self.provenance)
        self.assertIn("reported range", result.provenance.note or "")

    def test_unknown_unit_is_refused_rather_than_assumed(self):
        issues: list[ccr.ParseIssue] = []
        row = ccr.CCRRow(contaminant="Lead", detected="5", unit="bananas")
        self.assertIsNone(
            ccr.row_to_result(row, fixtures.SYNTHETIC_PWSID_A, self.provenance, issues=issues)
        )
        self.assertEqual(issues[0].kind, "unknown_unit")

    def test_missing_unit_falls_back_to_the_analyte_unit_and_says_so(self):
        row = ccr.CCRRow(contaminant="Lead", detected="5", unit=None)
        result = ccr.row_to_result(row, fixtures.SYNTHETIC_PWSID_A, self.provenance)
        self.assertEqual(result.unit, "ug/L")
        self.assertIn("assumed", (result.provenance.note or "").lower())


if __name__ == "__main__":
    unittest.main()
