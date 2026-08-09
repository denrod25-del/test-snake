"""Unit tests for DeedAuction JSON scrape helpers and RealAuction host candidates."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from realauction import _host_candidates


def test_host_candidates_prefer_realforeclose_sibling():
    hosts = _host_candidates("https://charlotte.realtaxdeed.com")
    assert hosts[0] == "https://charlotte.realtaxdeed.com"
    assert "https://charlotte.realforeclose.com" in hosts


def test_host_candidates_from_realforeclose():
    hosts = _host_candidates("https://walton.realforeclose.com")
    assert hosts[0] == "https://walton.realforeclose.com"
    assert "https://walton.realtaxdeed.com" in hosts
