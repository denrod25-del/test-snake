"""Unit conversion and analyte-registry integrity."""
from __future__ import annotations

import unittest

from fwq import analytes, units


class TestUnits(unittest.TestCase):
    def test_ppb_is_ug_per_litre(self):
        self.assertEqual(units.canonical_unit_for("ppb"), "ug/L")
        self.assertEqual(units.canonical_unit_for("PPB"), "ug/L")
        self.assertEqual(units.canonical_unit_for("parts per billion"), "ug/L")

    def test_micro_sign_variants_collapse(self):
        for spelling in ("ug/L", "µg/L", "μg/L", "UG/L", "ug/l"):
            self.assertEqual(units.canonical_unit_for(spelling), "ug/L", spelling)

    def test_mass_conversions_are_exact_powers_of_ten(self):
        self.assertEqual(units.to_ng_l(1, "mg/L"), 1e6)
        self.assertEqual(units.to_ng_l(1, "ug/L"), 1e3)
        self.assertEqual(units.to_ng_l(1, "ng/L"), 1.0)
        self.assertAlmostEqual(units.convert(0.0062, "ug/L", "ng/L"), 6.2)
        self.assertAlmostEqual(units.convert(80, "ug/L", "mg/L"), 0.08)

    def test_round_trip_preserves_value(self):
        for unit in ("mg/L", "ug/L", "ng/L", "pg/L"):
            there = units.convert(1.2345, unit, "ng/L")
            back = units.convert(there, "ng/L", unit)
            self.assertAlmostEqual(back, 1.2345, places=9, msg=unit)

    def test_cross_dimension_conversion_is_refused(self):
        with self.assertRaises(units.ConversionError):
            units.convert(1.0, "mg/L", "pCi/L")
        with self.assertRaises(units.ConversionError):
            units.to_ng_l(1.0, "NTU")

    def test_nonlinear_units_refuse_conversion_but_allow_identity(self):
        self.assertEqual(units.convert(7.2, "pH", "pH"), 7.2)
        with self.assertRaises(units.ConversionError):
            units.convert(7.2, "pH", "unitless")

    def test_hardness_grains_per_gallon(self):
        self.assertAlmostEqual(units.convert(1, "gpg", "mg/L as CaCO3"), 17.118, places=3)

    def test_unknown_unit_raises_rather_than_guessing(self):
        with self.assertRaises(units.UnknownUnitError):
            units.parse_unit("bananas per litre")
        self.assertFalse(units.is_known_unit("bananas per litre"))

    def test_format_quantity_avoids_scientific_notation_in_normal_range(self):
        self.assertEqual(units.format_quantity(4.0, "ng/L"), "4 ng/L")
        self.assertEqual(units.format_quantity(0.0062, "mg/L"), "0.0062 mg/L")


class TestAnalyteRegistry(unittest.TestCase):
    def setUp(self):
        self.registry = analytes.registry()

    def test_registry_loads_and_is_internally_consistent(self):
        # _build raises on duplicate ids, alias collisions, unknown units, and
        # hazard-index components lacking an HBWC, so a clean load is the check.
        self.assertGreater(len(self.registry.analytes), 50)
        self.assertIn("pfoa", self.registry.analytes)

    def test_every_limit_unit_is_convertible_to_its_analyte_display_unit(self):
        for analyte in self.registry.analytes.values():
            for limit in analyte.limits:
                if limit.unit is None or limit.value is None:
                    continue
                with self.subTest(analyte=analyte.id, kind=limit.kind):
                    # Must not raise: a limit we cannot compare against is useless.
                    units.convert(limit.value, limit.unit, analyte.display_unit)

    def test_resolution_by_name_alias_and_casrn(self):
        cases = {
            "PFOA": "pfoa",
            "Perfluorooctanoic acid": "pfoa",
            "PFOA (C8)": "pfoa",
            "GenX": "hfpo_da",
            "Total trihalomethanes (TTHM)": "tthm",
            "TTHM": "tthm",
            "haloacetic acids": "haa5",
            "Nitrate (as N)": "nitrate",
            "Copper, total": "copper",
            "E. coli": "e_coli",
        }
        for name, expected in cases.items():
            with self.subTest(name=name):
                resolved = self.registry.resolve(name=name)
                self.assertIsNotNone(resolved, name)
                self.assertEqual(resolved.id, expected)
        self.assertEqual(self.registry.resolve(casrn="1763-23-1").id, "pfos")
        self.assertEqual(self.registry.resolve(casrn="335-67-1").id, "pfoa")

    def test_measurement_qualifier_does_not_confuse_two_analytes(self):
        # "(as Cl2)" appears on both; identity must come from the name, not it.
        self.assertEqual(self.registry.resolve(name="Chlorine (as Cl2)").id, "chlorine")
        self.assertEqual(self.registry.resolve(name="Chloramines (as Cl2)").id, "chloramines")

    def test_unknown_name_resolves_to_none_rather_than_a_guess(self):
        self.assertIsNone(self.registry.resolve(name="Examplium-7"))
        self.assertIsNone(self.registry.resolve(name=""))

    def test_secondary_standard_is_not_treated_as_enforceable(self):
        sulfate = self.registry.get("sulfate")
        self.assertIsNotNone(sulfate.limit("SMCL"))
        self.assertIsNone(
            sulfate.enforceable_limit,
            "an aesthetic SMCL must never be reported as an enforceable limit",
        )

    def test_lead_uses_action_level_not_mcl(self):
        lead = self.registry.get("lead")
        self.assertIsNone(lead.limit("MCL"), "lead is regulated by action level, not MCL")
        self.assertEqual(lead.enforceable_limit.kind, "AL")
        self.assertEqual(lead.enforceable_limit.value, 15.0)

    def test_every_limit_names_an_authority_and_citation(self):
        for analyte in self.registry.analytes.values():
            for limit in analyte.limits:
                with self.subTest(analyte=analyte.id, kind=limit.kind):
                    self.assertTrue(limit.authority)
                    self.assertTrue(limit.citation)


class TestHazardIndex(unittest.TestCase):
    def test_index_sums_ratios_against_health_based_water_concentrations(self):
        # 5/10 + 2/10 + 0/10 + 400/2000 = 0.5 + 0.2 + 0 + 0.2 = 0.9
        index = analytes.hazard_index(
            {"pfhxs": 5.0, "pfna": 2.0, "hfpo_da": 0.0, "pfbs": 400.0}
        )
        self.assertAlmostEqual(index.value, 0.9)
        self.assertFalse(index.exceeds)
        self.assertTrue(index.is_complete)

    def test_index_over_one_is_an_exceedance(self):
        index = analytes.hazard_index(
            {"pfhxs": 8.0, "pfna": 4.0, "hfpo_da": 0.0, "pfbs": 0.0}
        )
        self.assertAlmostEqual(index.value, 1.2)
        self.assertTrue(index.exceeds)

    def test_unmeasured_component_marks_the_index_incomplete(self):
        index = analytes.hazard_index({"pfhxs": 5.0, "pfna": None, "pfbs": 0.0})
        self.assertFalse(index.is_complete)
        self.assertIn("pfna", index.missing)
        self.assertIn("hfpo_da", index.missing)

    def test_non_detect_zero_differs_from_unmeasured_none(self):
        measured = analytes.hazard_index(
            {"pfhxs": 0.0, "pfna": 0.0, "hfpo_da": 0.0, "pfbs": 0.0}
        )
        unmeasured = analytes.hazard_index({})
        self.assertTrue(measured.is_complete)
        self.assertFalse(unmeasured.is_complete)
        self.assertEqual(measured.value, unmeasured.value)


if __name__ == "__main__":
    unittest.main()
