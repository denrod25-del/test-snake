"""Property Intelligence parcel registry coverage gates."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REG = ROOT / "data" / "parcels" / "registry.json"
ZONING = ROOT / "data" / "signals" / "zoning-layers.json"


class TestPiParcelCoverage(unittest.TestCase):
    def test_registry_has_fdor_majors(self):
        reg = json.loads(REG.read_text(encoding="utf-8"))
        counties = reg["counties"]
        self.assertGreaterEqual(len(counties), 31)
        for slug in (
            "osceola",
            "lake",
            "marion",
            "st-lucie",
            "clay",
            "hernando",
            "indian-river",
            "okaloosa",
        ):
            self.assertIn(slug, counties)
            self.assertEqual(counties[slug]["status"], "cached")
            self.assertIn("CO_NO=", counties[slug]["extraWhere"])

    def test_charlotte_zoning_fields_in_outfields(self):
        reg = json.loads(REG.read_text(encoding="utf-8"))
        out = set(reg["counties"]["charlotte"]["outFields"])
        for f in ("zoningcode", "landuse", "description"):
            self.assertIn(f, out)

    def test_fdor_dor_uc_zoning_fallback(self):
        z = json.loads(ZONING.read_text(encoding="utf-8"))
        fb = z["parcelAttrFallback"]
        self.assertEqual(fb["osceola"]["status"], "cached")
        self.assertIn("DOR_UC", fb["osceola"]["map"]["code"])


if __name__ == "__main__":
    unittest.main()
