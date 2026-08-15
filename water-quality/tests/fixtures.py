"""SYNTHETIC test fixtures.

Every value in this file is invented. The PWSIDs (FL9990001, FL9990002,
FL9990003) use a 999 prefix that no real Florida system uses, and the utility
names are fictional.

This is deliberate and load-bearing: publishing a fabricated PFAS or lead
number against a real utility's identifier — even in a test file, even
accidentally copied into a fixture directory that later gets served — would be
a genuinely harmful thing to ship. Real numbers only ever enter this repo by
being fetched from a cited source at ingest time.

The field names, however, are real: they mirror the column names EPA's
Envirofacts SDWIS and UCMR 5 extracts actually use, since that is exactly what
the normalizers are being tested against.
"""
from __future__ import annotations

from typing import Any

SYNTHETIC_PWSID_A = "FL9990001"
SYNTHETIC_PWSID_B = "FL9990002"
SYNTHETIC_PWSID_C = "FL9990003"


WATER_SYSTEM_ROWS: list[dict[str, Any]] = [
    {
        "pwsid": SYNTHETIC_PWSID_A,
        "pws_name": "EXAMPLE SHORELINE UTILITY AUTHORITY",
        "pws_type_code": "CWS",
        "primary_source_code": "GW",
        "owner_type_code": "L",
        "population_served_count": "78000",
        "service_connections_count": "31000",
        "pws_activity_code": "A",
        "phone_number": "555-0100",
        "state_code": "FL",
    },
    {
        "pwsid": SYNTHETIC_PWSID_B,
        "pws_name": "EXAMPLE SHORELINE RV PARK",
        "pws_type_code": "TNCWS",
        "primary_source_code": "GW",
        "population_served_count": "80",
        "pws_activity_code": "A",
        "state_code": "FL",
    },
    {
        "pwsid": SYNTHETIC_PWSID_C,
        "pws_name": "EXAMPLE INLAND WATER DISTRICT",
        "pws_type_code": "CWS",
        "primary_source_code": "SWP",
        "population_served_count": "12000",
        "pws_activity_code": "I",
        "state_code": "FL",
    },
]

GEOGRAPHIC_AREA_ROWS: list[dict[str, Any]] = [
    {"pwsid": SYNTHETIC_PWSID_A, "state_served": "FL", "county_served": "PALM BEACH",
     "city_served": "EXAMPLE GARDENS", "zip_code_served": "33410"},
    {"pwsid": SYNTHETIC_PWSID_A, "state_served": "FL", "county_served": "PALM BEACH",
     "city_served": "NORTH EXAMPLE", "zip_code_served": "33408"},
    {"pwsid": SYNTHETIC_PWSID_A, "state_served": "FL", "county_served": "PALM BEACH",
     "city_served": "EXAMPLE GARDENS", "zip_code_served": "33418-1234"},
    {"pwsid": SYNTHETIC_PWSID_B, "state_served": "FL", "county_served": "PALM BEACH",
     "city_served": "EXAMPLE GARDENS", "zip_code_served": "33410"},
    {"pwsid": SYNTHETIC_PWSID_C, "state_served": "FL", "county_served": "EXAMPLE",
     "city_served": "INLAND CITY", "zip_code_served": "33999"},
]

VIOLATION_ROWS: list[dict[str, Any]] = [
    {
        "pwsid": SYNTHETIC_PWSID_A,
        "violation_id": "9000001",
        "violation_category_code": "MCL",
        "contaminant_code": "2950",
        "compl_per_begin_date": "01/01/2024",
        "compl_per_end_date": "03/31/2024",
        "calculated_rtc_date": "06/15/2024",
        "is_health_based_ind": "Y",
        "violation_status": "Resolved",
        "public_notification_tier": "2",
    },
    {
        "pwsid": SYNTHETIC_PWSID_A,
        "violation_id": "9000002",
        "violation_category_code": "MR",
        "contaminant_code": "9999",
        "compl_per_begin_date": "2025-01-01",
        "is_health_based_ind": "N",
        "violation_status": "Unaddressed",
    },
    {
        # Missing violation_id — must be skipped and reported, not crash.
        "pwsid": SYNTHETIC_PWSID_A,
        "violation_category_code": "MCL",
    },
]

#: EPA reference table: SDWIS contaminant code -> description.
CONTAMINANT_CODES: dict[str, str] = {
    "2950": "TTHM",
    "1030": "Lead",
    "1022": "Copper",
    "9999": "Consumer Confidence Report",
}

LCR_ROWS: list[dict[str, Any]] = [
    {
        "pwsid": SYNTHETIC_PWSID_A,
        "sample_id": "LCR-1",
        "contaminant_code": "1030",
        "sample_measure": "0.004",
        "unit_of_measure": "mg/L",
        "sampling_end_date": "09/30/2024",
        "result_sign_code": "=",
    },
    {
        "pwsid": SYNTHETIC_PWSID_A,
        "sample_id": "LCR-2",
        "contaminant_code": "1022",
        "sample_measure": "0.21",
        "unit_of_measure": "mg/L",
        "sampling_end_date": "09/30/2024",
        "result_sign_code": "=",
    },
    {
        # Non-detect: the sign column says "<", so 0.001 is a reporting limit.
        "pwsid": SYNTHETIC_PWSID_A,
        "sample_id": "LCR-3",
        "contaminant_code": "1030",
        "sample_measure": "0.001",
        "unit_of_measure": "mg/L",
        "sampling_end_date": "09/30/2022",
        "result_sign_code": "<",
    },
]

UCMR5_ROWS: list[dict[str, Any]] = [
    {
        "PWSID": SYNTHETIC_PWSID_A,
        "Contaminant": "PFOA",
        "AnalyticalResultsSign": "=",
        "AnalyticalResultValue": "0.0062",
        "MRL": "0.004",
        "UnitOfMeasure": "ug/L",
        "CollectionDate": "05/14/2024",
        "SamplePointName": "EP-1",
        "SampleID": "S-1",
    },
    {
        # Non-detect. The value column repeats the MRL; reading it as a
        # measurement would invent a 4 ng/L PFOS detection.
        "PWSID": SYNTHETIC_PWSID_A,
        "Contaminant": "PFOS",
        "AnalyticalResultsSign": "<",
        "AnalyticalResultValue": "0.004",
        "MRL": "0.004",
        "UnitOfMeasure": "ug/L",
        "CollectionDate": "05/14/2024",
        "SampleID": "S-2",
    },
    {
        "PWSID": SYNTHETIC_PWSID_A,
        "Contaminant": "PFHxS",
        "AnalyticalResultsSign": "=",
        "AnalyticalResultValue": "0.005",
        "MRL": "0.003",
        "UnitOfMeasure": "ug/L",
        "CollectionDate": "05/14/2024",
        "SampleID": "S-3",
    },
    {
        "PWSID": SYNTHETIC_PWSID_A,
        "Contaminant": "PFBS",
        "AnalyticalResultsSign": "=",
        "AnalyticalResultValue": "0.4",
        "MRL": "0.003",
        "UnitOfMeasure": "ug/L",
        "CollectionDate": "05/14/2024",
        "SampleID": "S-4",
    },
    {
        # An analyte deliberately absent from analytes.json, to prove unmapped
        # rows are reported rather than silently dropped.
        "PWSID": SYNTHETIC_PWSID_A,
        "Contaminant": "EXAMPLIUM-7",
        "AnalyticalResultsSign": "=",
        "AnalyticalResultValue": "1.0",
        "UnitOfMeasure": "ug/L",
        "CollectionDate": "05/14/2024",
        "SampleID": "S-5",
    },
]

#: A CCR table as an extractor would hand it over: header row plus data rows.
CCR_TABLE: list[list[str]] = [
    ["Contaminant", "Units", "MCL", "MCLG", "Level Detected", "Range", "Violation"],
    ["Total Trihalomethanes (TTHM)", "ppb", "80", "N/A", "42", "18 - 61", "No"],
    ["Haloacetic Acids (HAA5)", "ppb", "60", "N/A", "31", "12 - 44", "No"],
    ["Lead", "ppb", "AL=15", "0", "ND", "", "No"],
    ["Nitrate (as N)", "ppm", "10", "10", "0.42", "0.31 - 0.55", "No"],
    ["Sodium", "ppm", "N/A", "N/A", "24", "20 - 28", "No"],
    ["Hardness", "ppm", "N/A", "N/A", "210", "190 - 240", "No"],
    ["Examplium-7", "ppb", "N/A", "N/A", "3.0", "", "No"],
]


class FakeClient:
    """Stands in for `fwq.sources.http.Client`, serving fixtures by URL pattern.

    Matching is by substring of the requested Envirofacts URL, which is how the
    real table routing works, so the normalizers and orchestrator are exercised
    over their real code path with no network.
    """

    def __init__(self, *, fail: set[str] | None = None) -> None:
        self.fail = fail or set()
        self.calls: list[str] = []

        class _Stats:
            def to_dict(self) -> dict[str, int]:
                return {"requests": 0, "cacheHits": 0, "retries": 0, "failures": 0}

        self.stats = _Stats()

    def get_json(self, url: str, *, empty_on_404: bool = True) -> Any:
        from fwq.sources.http import SourceUnavailable

        self.calls.append(url)
        for marker in self.fail:
            if marker in url:
                raise SourceUnavailable(url, "HTTP 403 (access denied, not retried)")

        # Envirofacts pages are 1-indexed inclusive; serve page one, then empty.
        first_page = "/1:" in url

        if "water_system" in url and "facility" not in url:
            return WATER_SYSTEM_ROWS if first_page else []
        if "geographic_area" in url:
            return GEOGRAPHIC_AREA_ROWS if first_page else []
        if "violation" in url:
            return VIOLATION_ROWS if first_page else []
        if "lcr_sample_result" in url:
            return LCR_ROWS if first_page else []
        if "water_system_facility" in url:
            return []
        if "ref_code_values" in url:
            return (
                [
                    {"value_code": code, "value_description": desc}
                    for code, desc in CONTAMINANT_CODES.items()
                ]
                if first_page else []
            )
        if "ucmr5" in url:
            return UCMR5_ROWS if first_page else []
        return []

    def get_bytes(self, url: str) -> bytes:
        raise NotImplementedError

    def probe(self, url: str) -> dict[str, Any]:
        return {"url": url, "reachable": True, "httpStatus": 200, "detail": "", "elapsedMs": 1}

    def close(self) -> None:
        pass

    def __enter__(self) -> "FakeClient":
        return self

    def __exit__(self, *exc: object) -> None:
        pass
