"""Unit tests for DeedAuction JSON scrape helpers and RealAuction host candidates."""

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from realauction import (
    _host_candidates,
    is_live_realauction_host,
    is_tax_deed_preview_html,
    scrape_realauction_county,
)


class TestRealAuctionHelpers(unittest.TestCase):
    def test_host_candidates_prefer_realforeclose_sibling(self):
        hosts = _host_candidates("https://charlotte.realtaxdeed.com")
        self.assertEqual(hosts[0], "https://charlotte.realtaxdeed.com")
        self.assertIn("https://charlotte.realforeclose.com", hosts)

    def test_host_candidates_from_realforeclose(self):
        hosts = _host_candidates("https://walton.realforeclose.com")
        self.assertEqual(hosts[0], "https://walton.realforeclose.com")
        self.assertIn("https://walton.realtaxdeed.com", hosts)

    def test_is_tax_deed_preview_rejects_foreclosure_only(self):
        fc = "Auction Type: FORECLOSURE Plaintiff Final Judgment Case #"
        self.assertFalse(is_tax_deed_preview_html(fc))
        td = "Auction Type: TAXDEED Certificate # 2021-123 Parcel"
        self.assertTrue(is_tax_deed_preview_html(td))

    def test_splash_homepage_still_live_for_preview(self):
        """Logged-out splash homepage must not be treated as a dead marketing host."""
        session = MagicMock()
        resp = MagicMock()
        resp.url = "https://palmbeach.realtaxdeed.com/"
        resp.status_code = 200
        resp.text = "<html><title>RealForeclose- Palm Beach County -Splash Page</title></html>"
        session.get.return_value = resp
        self.assertTrue(is_live_realauction_host(session, "https://palmbeach.realtaxdeed.com"))

    def test_marketing_redirect_host_not_live(self):
        session = MagicMock()
        resp = MagicMock()
        resp.url = "https://www.realauction.com/"
        resp.status_code = 200
        resp.text = "<html><title>Online Auction Software Solutions</title></html>"
        session.get.return_value = resp
        self.assertFalse(is_live_realauction_host(session, "https://collier.realtaxdeed.com"))

    def test_primary_empty_calendar_not_labeled_foreclosure_only(self):
        """Live tax-deed host with no future dates must not report sibling FC-only."""
        from unittest.mock import patch

        with patch("realauction.requests.Session") as SessionCls, patch(
            "realauction.is_live_realauction_host", return_value=True
        ), patch(
            "realauction.discover_preview_dates",
            side_effect=lambda session, url, max_dates=8: (
                []
                if "realtaxdeed" in url
                else ["2026-09-20", "2026-09-27"]
            ),
        ), patch(
            "realauction.count_parcels_for_date", return_value=0
        ):
            SessionCls.return_value = MagicMock()
            sales = scrape_realauction_county("https://sarasota.realtaxdeed.com")
        self.assertEqual(sales, [])
        err = scrape_realauction_county.last_error
        self.assertIn("no future tax-deed sale dates on https://sarasota.realtaxdeed.com", err)
        self.assertNotIn("foreclosure-only calendar)", err)


if __name__ == "__main__":
    unittest.main()
