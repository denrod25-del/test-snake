"""Public-site safety checks — no dev commands or mislabeled sample data."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PUBLIC_HTML = [
    "index.html",
    "tax-deeds.html",
    "permit-search.html",
    "data-sources.html",
    "trust.html",
    "pricing.html",
    "methodology.html",
    "status.html",
    "florida-permit-search.html",
    "florida-tax-deed-sales.html",
    "palm-beach-county-tax-deed-sales.html",
]

FAKE_COUNTY_RE = re.compile(
    r"(West Palm Beach|Boca Raton|Jupiter|Royal Palm Beach|Boynton Beach)\s+County",
    re.I,
)

FORBIDDEN_PATTERNS = [
    re.compile(r"scrape_permits\.py", re.I),
    re.compile(r"python\s+scripts/", re.I),
    re.compile(r"build_site_fallbacks\.py", re.I),
    re.compile(r"Manual Upload", re.I),
]

# User-facing copy must not call sample datasets "live data".
SAMPLE_MISLABEL = re.compile(
    r"sample.{0,80}\blive data\b|\blive data\b.{0,80}sample",
    re.I | re.DOTALL,
)


class TestPublicSite(unittest.TestCase):
    def test_public_pages_exclude_dev_commands(self):
        for rel in PUBLIC_HTML:
            path = ROOT / rel
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8")
            for pattern in FORBIDDEN_PATTERNS:
                match = pattern.search(text)
                self.assertIsNone(
                    match,
                    f"{rel} contains forbidden dev text: {match.group(0) if match else ''}",
                )

    def test_no_city_labeled_as_county(self):
        counties_dir = ROOT / "counties"
        for path in counties_dir.glob("*.html"):
            if path.name == "index.html":
                continue
            text = path.read_text(encoding="utf-8")
            m = FAKE_COUNTY_RE.search(text)
            self.assertIsNone(m, f"{path.name} mislabels city as county: {m.group(0) if m else ''}")

    def test_municipality_pages_use_correct_geography(self):
        muni = ROOT / "municipalities" / "boca-raton.html"
        if muni.exists():
            text = muni.read_text(encoding="utf-8")
            self.assertIn("Boca Raton, Palm Beach County", text)
            self.assertNotIn("Boca Raton County", text)

    def test_county_registry_has_crawlable_rows(self):
        td = (ROOT / "tax-deeds.html").read_text(encoding="utf-8")
        rows = re.findall(r"<tr data-name=", td)
        self.assertGreaterEqual(len(rows), 67, "tax-deeds registry tbody should have 67 SSR rows")

    def test_data_sources_has_inventory_table(self):
        ds = (ROOT / "data-sources.html").read_text(encoding="utf-8")
        self.assertIn("ds-dataset-table", ds)
        self.assertNotIn("Run python scripts/build_site_fallbacks", ds)

    def test_trust_center_has_inventory_table(self):
        trust = (ROOT / "trust.html").read_text(encoding="utf-8")
        self.assertIn("ds-dataset-table", trust)
        self.assertNotIn("Run python scripts/build_site_fallbacks", trust)

    def test_permit_index_sample_scope_not_marked_live_in_html(self):
        """Coverage notes in JSON should not leak as 'live data' on public permit pages."""
        index_path = ROOT / "data" / "permits" / "index.json"
        doc = json.loads(index_path.read_text(encoding="utf-8"))
        for cov in doc.get("coverage") or []:
            if cov.get("status") in ("stale", "manual") or "sample" in (cov.get("scope") or "").lower():
                scope = cov.get("scope") or ""
                self.assertNotIn(
                    "live data",
                    scope.lower(),
                    f"{cov.get('county')} scope mislabels sample as live",
                )

    def test_pricing_no_conditional_stripe_wording(self):
        text = (ROOT / "pricing.html").read_text(encoding="utf-8")
        self.assertNotIn("when configured", text.lower())

    def test_no_sample_mislabel_in_public_html(self):
        for rel in PUBLIC_HTML:
            path = ROOT / rel
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8")
            self.assertIsNone(
                SAMPLE_MISLABEL.search(text),
                f"{rel} may mislabel sample data as live",
            )


class TestStripeWebhook(unittest.TestCase):
    def test_webhook_verifies_signature(self):
        src = (ROOT / "netlify" / "functions" / "stripe-webhook.js").read_text(encoding="utf-8")
        self.assertIn("constructEvent", src)
        self.assertIn("STRIPE_WEBHOOK_SECRET", src)


class TestSupabaseRLS(unittest.TestCase):
    def test_rls_enabled_on_user_tables(self):
        sql = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")
        for table in ("profiles", "watchlist_parcels", "alert_subscriptions", "surplus_history", "shop_api_keys"):
            self.assertIn(f"alter table public.{table} enable row level security", sql.lower())
        self.assertIn("users can view own profile", sql.lower())
        self.assertIn("users manage own parcels", sql.lower())
        self.assertIn("pro users can view surplus", sql.lower())


if __name__ == "__main__":
    unittest.main()
