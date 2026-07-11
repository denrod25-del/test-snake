"""Launch-readiness checks for DeedScout public beta."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TOP_METROS = {
    "Miami-Dade", "Broward", "Palm Beach", "Hillsborough", "Orange",
    "Pinellas", "Duval", "Lee", "Polk", "Brevard",
}


class TestLaunchReadiness(unittest.TestCase):
    def test_sales_json_has_curated_top_metros(self):
        path = ROOT / "sales.json"
        self.assertTrue(path.exists(), "sales.json missing — run build_curated_sales + scrape_sales")
        doc = json.loads(path.read_text(encoding="utf-8"))
        stats = doc.get("stats") or {}
        sales = doc.get("sales") or {}
        scraped = stats.get("scraped", 0)
        curated = stats.get("curated", 0)
        # Prefer live scrape recovery; curated cadence fills gaps when scrape fails.
        self.assertTrue(
            scraped >= 20 or curated >= 8,
            f"expected scraped>=20 or curated>=8, got scraped={scraped} curated={curated}",
        )
        for county in TOP_METROS:
            self.assertIn(county, sales, f"{county} missing from sales.json")
            self.assertTrue(sales[county], f"{county} has no future sale dates")
            for entry in sales[county]:
                self.assertIn(entry.get("source"), ("cadence", "manual", "scraper", "manual_verified"))
            if any(e.get("source") == "scraper" for e in sales[county]):
                self.assertTrue(
                    any(isinstance(e.get("count"), int) for e in sales[county] if e.get("source") == "scraper"),
                    f"{county} scraper rows should include parcel counts",
                )

    def test_plumbing_not_in_primary_nav(self):
        js = (ROOT / "assets" / "deedscout.js").read_text(encoding="utf-8")
        main_nav_match = re.search(r"var mainNav = \[([\s\S]*?)\];", js)
        self.assertIsNotNone(main_nav_match)
        self.assertNotIn("plumbing", main_nav_match.group(1).lower())
        td = (ROOT / "tax-deeds.html").read_text(encoding="utf-8")
        self.assertNotIn('href="plumbing-reviews.html" class="nav-ext"', td)

    def test_csv_export_implemented(self):
        td = (ROOT / "tax-deeds.html").read_text(encoding="utf-8")
        self.assertIn("exportNotebookCsv", td)
        self.assertIn("text/csv", td)

    def test_curated_sales_pipeline_files(self):
        self.assertTrue((ROOT / "data" / "sale-schedules.json").exists())
        self.assertTrue((ROOT / "scripts" / "build_curated_sales.py").exists())
        self.assertTrue((ROOT / "scraper" / "curated_sales.json").exists())

    def test_homepage_hero_sale_date_honesty(self):
        idx = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertTrue(
            "confirm on the official source" in idx.lower()
            or "always confirm" in idx.lower(),
            "homepage must tell users to verify on official sources",
        )
        self.assertNotIn('href="plumbing-reviews.html"', idx)
        self.assertIn("labs/plumbing-reviews.html", idx)

    def test_domain_dual_support(self):
        td = (ROOT / "tax-deeds.html").read_text(encoding="utf-8")
        self.assertIn("deedscout.app", td)
        self.assertIn("deedscout.netlify.app", td)

    def test_advanced_lookups_enabled(self):
        td = (ROOT / "tax-deeds.html").read_text(encoding="utf-8")
        self.assertIn("advanced_lookups: true", td)
        self.assertTrue((ROOT / "assets" / "parcel-registry.js").exists())
        self.assertTrue((ROOT / "data" / "parcels" / "registry.json").exists())

    def test_launch_audit_doc(self):
        self.assertTrue((ROOT / "docs" / "LAUNCH_AUDIT.md").exists())


if __name__ == "__main__":
    unittest.main()
