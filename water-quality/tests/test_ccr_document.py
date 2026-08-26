"""End-to-end CCR document parsing: a real PDF and a real HTML page in, results out.

`tests/test_normalize.py` covers the parsing logic over already-extracted cells.
This covers the layer under it — that `parse_document` actually gets tables out
of a document at all — by generating a PDF and running the real extraction path.

The generated CCR is SYNTHETIC: a fictional utility, invented values. It is
built to look like a typical Florida CCR table (contaminant / units / MCL /
MCLG / level detected / range / violation), which is the layout the header
mapper targets.

This is not a substitute for running a real utility's PDF through the parser.
Real CCRs use borderless tables, multi-column layouts, and footnote markers
inside cells, none of which this fixture reproduces. What it does prove is that
the PDF path is wired correctly and that a well-formed table survives the whole
journey to canonical `Result` records.
"""
from __future__ import annotations

import unittest
from datetime import datetime, timezone

from fwq.schema import Provenance, Source
from fwq.sources import ccr

from . import fixtures

RETRIEVED = datetime(2026, 8, 15, tzinfo=timezone.utc)

HEADERS = ["Contaminant", "Units", "MCL", "MCLG", "Level Detected", "Range", "Violation"]
DATA_ROWS = [
    ["Total Trihalomethanes (TTHM)", "ppb", "80", "N/A", "42", "18 - 61", "No"],
    ["Haloacetic Acids (HAA5)", "ppb", "60", "N/A", "31", "12 - 44", "No"],
    ["Lead", "ppb", "AL=15", "0", "ND", "", "No"],
    ["Copper", "ppm", "AL=1.3", "1.3", "0.21", "0.02 - 0.34", "No"],
    ["Nitrate (as N)", "ppm", "10", "10", "0.42", "0.31 - 0.55", "No"],
    ["Sodium", "ppm", "N/A", "N/A", "24", "20 - 28", "No"],
]


def build_ccr_pdf() -> bytes:
    """Render a synthetic CCR table to a PDF with drawn cell borders."""
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=792, height=612)
    page.insert_text((36, 50), "2024 Annual Water Quality Report", fontsize=16)
    page.insert_text((36, 70), "Example Shoreline Utility Authority (SYNTHETIC)", fontsize=10)

    widths = [190, 45, 60, 55, 95, 100, 65]
    x0, y, row_height = 36, 90, 26
    for row in [HEADERS] + DATA_ROWS:
        x = x0
        for index, cell in enumerate(row):
            rect = pymupdf.Rect(x, y, x + widths[index], y + row_height)
            page.draw_rect(rect, color=(0, 0, 0), width=0.7)
            page.insert_textbox(rect + (3, 7, -3, 0), cell, fontsize=8)
            x += widths[index]
        y += row_height

    data = doc.tobytes()
    doc.close()
    return data


def build_ccr_html() -> str:
    rows = "".join(
        "<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>"
        for row in DATA_ROWS
    )
    header = "".join(f"<th>{h}</th>" for h in HEADERS)
    return (
        "<html><body><h1>2024 Water Quality Report</h1>"
        "<p>Example Shoreline Utility Authority (SYNTHETIC)</p>"
        f"<table><thead><tr>{header}</tr></thead><tbody>{rows}</tbody></table>"
        "</body></html>"
    )


def _provenance():
    return Provenance(
        source=Source.CCR,
        retrieved_at=RETRIEVED,
        source_url="https://example.test/ccr-2024.pdf",
    )


try:
    import pymupdf  # noqa: F401
    HAS_PYMUPDF = True
except ImportError:  # pragma: no cover
    HAS_PYMUPDF = False


@unittest.skipUnless(HAS_PYMUPDF, "PyMuPDF not installed")
class TestPdfExtraction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pdf = build_ccr_pdf()

    def test_a_bordered_table_is_found_in_the_pdf(self):
        tables = ccr.extract_tables_from_pdf(self.pdf)
        self.assertEqual(len(tables), 1)
        self.assertEqual(tables[0][0], HEADERS)
        self.assertEqual(len(tables[0]), len(DATA_ROWS) + 1)

    def test_a_non_pdf_payload_does_not_crash_the_ingest(self):
        self.assertEqual(ccr.extract_tables_from_pdf(b"not a pdf at all"), [])

    def test_an_html_error_page_served_from_a_pdf_url_degrades_quietly(self):
        # The realistic case: the CCR link 404s or redirects to a login page and
        # the response body is HTML. One utility doing that must not abort the
        # ingest for every utility behind it in the queue.
        error_page = b"<html><body><h1>404 - Page Not Found</h1></body></html>"
        self.assertEqual(ccr.extract_tables_from_pdf(error_page), [])
        results, issues = ccr.parse_document(
            error_page, pwsid=fixtures.SYNTHETIC_PWSID_A,
            provenance=_provenance(), content_type="pdf",
        )
        self.assertEqual(results, [])
        self.assertEqual(issues, [])

    def test_an_empty_payload_degrades_quietly(self):
        self.assertEqual(ccr.extract_tables_from_pdf(b""), [])

    def test_full_document_parse_produces_canonical_results(self):
        results, issues = ccr.parse_document(
            self.pdf, pwsid=fixtures.SYNTHETIC_PWSID_A,
            provenance=_provenance(), content_type="pdf", default_year=2024,
        )
        by_id = {r.analyte_id: r for r in results}
        self.assertEqual(
            set(by_id), {"tthm", "haa5", "lead", "copper", "nitrate", "sodium"}
        )
        self.assertEqual(issues, [])

    def test_units_are_canonicalized_out_of_the_pdf(self):
        results, _ = ccr.parse_document(
            self.pdf, pwsid=fixtures.SYNTHETIC_PWSID_A,
            provenance=_provenance(), default_year=2024,
        )
        by_id = {r.analyte_id: r for r in results}
        self.assertEqual(by_id["tthm"].unit, "ug/L")      # ppb
        self.assertAlmostEqual(by_id["tthm"].value, 42.0)
        self.assertEqual(by_id["copper"].unit, "mg/L")    # ppm
        self.assertAlmostEqual(by_id["copper"].value, 0.21)

    def test_a_non_detect_in_the_pdf_stays_a_non_detect(self):
        results, _ = ccr.parse_document(
            self.pdf, pwsid=fixtures.SYNTHETIC_PWSID_A,
            provenance=_provenance(), default_year=2024,
        )
        lead = next(r for r in results if r.analyte_id == "lead")
        self.assertFalse(lead.detected)
        self.assertIsNone(lead.value)
        self.assertIsNone(
            lead.compare_to_limit(),
            "an ND read from a PDF must not become an action-level exceedance",
        )

    def test_the_range_column_survives_pdf_extraction(self):
        results, _ = ccr.parse_document(
            self.pdf, pwsid=fixtures.SYNTHETIC_PWSID_A,
            provenance=_provenance(), default_year=2024,
        )
        tthm = next(r for r in results if r.analyte_id == "tthm")
        self.assertIn("reported range", tthm.provenance.note or "")
        self.assertIn("61", tthm.provenance.note or "")

    def test_every_result_from_the_pdf_carries_its_source_url(self):
        results, _ = ccr.parse_document(
            self.pdf, pwsid=fixtures.SYNTHETIC_PWSID_A,
            provenance=_provenance(), default_year=2024,
        )
        self.assertTrue(results)
        for result in results:
            self.assertEqual(
                result.provenance.source_url, "https://example.test/ccr-2024.pdf"
            )
            self.assertEqual(result.provenance.source, Source.CCR)


class TestHtmlExtraction(unittest.TestCase):
    def setUp(self):
        try:
            import bs4  # noqa: F401
        except ImportError:
            self.skipTest("beautifulsoup4 not installed")

    def test_html_and_pdf_paths_agree(self):
        html_results, _ = ccr.parse_document(
            build_ccr_html().encode("utf-8"), pwsid=fixtures.SYNTHETIC_PWSID_A,
            provenance=_provenance(), content_type="html", default_year=2024,
        )
        by_id = {r.analyte_id: r for r in html_results}
        self.assertEqual(
            set(by_id), {"tthm", "haa5", "lead", "copper", "nitrate", "sodium"}
        )
        self.assertAlmostEqual(by_id["tthm"].value, 42.0)
        self.assertFalse(by_id["lead"].detected)


if __name__ == "__main__":
    unittest.main()
