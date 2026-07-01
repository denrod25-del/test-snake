"""Validate permit JSON output shape from scraper data files."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PERMITS_DIR = ROOT / "data" / "permits"
REQUIRED_PERMIT_KEYS = {"permitNumber", "address", "status"}


class TestPermitOutputShape(unittest.TestCase):
    def test_sources_manifest_exists(self):
        manifest = PERMITS_DIR / "sources.json"
        self.assertTrue(manifest.exists(), "data/permits/sources.json missing")
        doc = json.loads(manifest.read_text(encoding="utf-8"))
        self.assertIn("sources", doc)
        self.assertTrue(len(doc["sources"]) >= 1)

    def test_active_source_files_parse(self):
        manifest = json.loads((PERMITS_DIR / "sources.json").read_text(encoding="utf-8"))
        for src in manifest.get("sources", []):
            if src.get("status") != "active":
                continue
            data_file = ROOT / src["dataFile"]
            if not data_file.exists():
                continue
            doc = json.loads(data_file.read_text(encoding="utf-8"))
            permits = doc.get("permits") or []
            if not permits and doc.get("permitsByParcel"):
                for arr in doc["permitsByParcel"].values():
                    permits.extend(arr or [])
            self.assertGreater(len(permits), 0, f"{src['id']} active file empty")
            sample = permits[0]
            missing = REQUIRED_PERMIT_KEYS - set(sample.keys())
            self.assertFalse(missing, f"{src['id']} missing keys: {missing}")


if __name__ == "__main__":
    unittest.main()
