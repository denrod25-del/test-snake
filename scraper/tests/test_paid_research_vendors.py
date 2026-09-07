"""Paid research vendor wiring gates."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class TestPaidResearchVendors(unittest.TestCase):
    def test_env_var_names_documented(self):
        setup = (ROOT / "SETUP.md").read_text(encoding="utf-8")
        guide = (ROOT / "docs" / "ENABLE_PAID_RESEARCH_APIS.md").read_text(encoding="utf-8")
        for name in ("BATCHDATA_API_TOKEN", "RENTCAST_API_KEY"):
            self.assertIn(name, setup)
            self.assertIn(name, guide)

    def test_functions_fail_fast_without_keys(self):
        skip = (ROOT / "netlify" / "functions" / "skip-trace.js").read_text(encoding="utf-8")
        avm = (ROOT / "netlify" / "functions" / "avm-lookup.js").read_text(encoding="utf-8")
        rent = (ROOT / "netlify" / "functions" / "rent-lookup.js").read_text(encoding="utf-8")
        self.assertIn("vendor_not_configured", skip)
        self.assertIn("vendor_not_configured", avm)
        self.assertIn("vendor_not_configured", rent)
        # Preflight must run before the first credit spend call.
        self.assertLess(skip.index("!process.env.BATCHDATA_API_TOKEN"), skip.index("spendCredit("))
        self.assertLess(avm.index("!process.env.RENTCAST_API_KEY"), avm.index("spendCredit("))
        self.assertLess(rent.index("!process.env.RENTCAST_API_KEY"), rent.index("spendCredit("))

    def test_credits_balance_reports_vendor_flags(self):
        credits = (ROOT / "netlify" / "functions" / "credits-balance.js").read_text(encoding="utf-8")
        self.assertIn("vendors:", credits)
        self.assertIn("BATCHDATA_API_TOKEN", credits)
        self.assertIn("RENTCAST_API_KEY", credits)

    def test_advanced_lookups_feature_flag_on(self):
        html = (ROOT / "tax-deeds.html").read_text(encoding="utf-8")
        self.assertRegex(html, re.compile(r"advanced_lookups\s*:\s*true"))


if __name__ == "__main__":
    unittest.main()
