"""Marketing funnel gates from the DeedScout website improvement spec."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class TestMarketingFunnel(unittest.TestCase):
    def test_homepage_keeps_utm_params(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("LEGACY", html)
        self.assertIn("Marketing params must not redirect", html)
        # Must not redirect on any query string.
        self.assertNotRegex(
            html,
            re.compile(r"if\s*\(\s*q\s*\|\|\s*h\s*\)\s*window\.location\.replace"),
        )
        self.assertIn("(county|parcel|sale|view|tab)", html)

    def test_homepage_hero_sells_missed_sale(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("Never miss a Florida tax deed sale again", html)
        self.assertIn("See upcoming sales free", html)
        self.assertIn('plausible-event-name=signup_start', html)
        self.assertIn('plausible-event-name=pro_intent', html)
        self.assertIn('id="hero-sale-stats"', html)
        # No Public Beta above the buy button.
        self.assertNotIn("Public Beta</p>", html.split("<h1>")[0])

    def test_plausible_on_core_marketing_pages(self):
        needle = "plausible.io/js/pa-W5hLWZYnOYQ6KHHQAhUDL.js"
        for rel in (
            "index.html",
            "pricing.html",
            "tax-deeds.html",
            "counties/broward.html",
            "counties/index.html",
            "learn/index.html",
            "about.html",
            "privacy.html",
        ):
            text = (ROOT / rel).read_text(encoding="utf-8")
            self.assertIn(needle, text, msg=rel)

    def test_csp_allows_plausible(self):
        toml = (ROOT / "netlify.toml").read_text(encoding="utf-8")
        self.assertIn("https://plausible.io", toml)

    def test_pricing_is_two_tiers(self):
        html = (ROOT / "pricing.html").read_text(encoding="utf-8")
        self.assertNotIn("Investor Pro", html)
        self.assertNotIn("Team / Enterprise", html)
        self.assertIn("ds-pricing-anchor", html)
        self.assertIn("Alert coverage", html)
        self.assertIn("pro_intent_pricing", html)
        self.assertEqual(html.count("ds-pricing-card"), 2)

    def test_county_pages_have_next_sale_and_capture(self):
        broward = (ROOT / "counties/broward.html").read_text(encoding="utf-8")
        self.assertIn("Next Broward County tax deed sale:", broward)
        self.assertIn('name="county-sale-alert"', broward)
        self.assertIn("FAQPage", broward)
        baker = (ROOT / "counties/baker.html").read_text(encoding="utf-8")
        self.assertIn("We do not yet scrape live dates for this county", baker)

    def test_surplus_landing_page_exists(self):
        page = ROOT / "florida-surplus-funds" / "index.html"
        self.assertTrue(page.exists())
        text = page.read_text(encoding="utf-8")
        self.assertIn("Florida tax deed surplus funds", text)
        self.assertIn("digest_signup", text)

    def test_organization_jsonld_on_homepage(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('"@type": "Organization"', html)
        self.assertIn("DeedScout · Florida Tax Deed Sale Calendar", html)

    def test_digest_form_has_no_name_field(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        form = html.split('name="weekly-digest"', 1)[1].split("</form>", 1)[0]
        self.assertNotIn('name="name"', form)
        self.assertIn('name="email"', form)
        self.assertIn("Broward: next sale Oct 26", html)


if __name__ == "__main__":
    unittest.main()
