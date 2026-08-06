"""Tests for surplus row quality gate."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from surplus_quality import validate_surplus_record


def test_manatee_row_passes():
    rec = {
        "sale_date": "2025-08-18",
        "parcel_id": None,
        "property_addr": "Thelma Hennigar",
        "prior_owner": "Thelma Hennigar",
        "surplus_amount": 35111.62,
    }
    ok, reason = validate_surplus_record(rec, scraped=True)
    assert ok, reason


def test_polk_template_rejected():
    rec = {
        "sale_date": None,
        "parcel_id": '20. {{getFeeCodeData(515,"fee_name")}}',
        "prior_owner": '20. {{getFeeCodeData(515,"fee_name")}}',
        "surplus_amount": 20.0,
    }
    ok, reason = validate_surplus_record(rec, scraped=True)
    assert not ok
    assert reason in ("template_tokens", "junk_parcel_id", "amount_below_floor", "missing_sale_date")


def test_hillsborough_noise_rejected():
    rec = {
        "sale_date": None,
        "parcel_id": None,
        "property_addr": None,
        "prior_owner": None,
        "surplus_amount": 100.0,
    }
    ok, reason = validate_surplus_record(rec, scraped=True)
    assert not ok
    assert reason in ("amount_below_floor", "missing_sale_date", "missing_identity")


def test_manual_row_allows_small_amount():
    rec = {
        "sale_date": "2026-03-04",
        "parcel_id": "23-22-30-1234-00-010",
        "property_addr": "1247 Magnolia Ave, Orlando, FL",
        "prior_owner": "Williams Family Trust",
        "surplus_amount": 18420.00,
    }
    ok, reason = validate_surplus_record(rec, scraped=False)
    assert ok, reason
