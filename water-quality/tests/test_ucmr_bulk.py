"""UCMR 5 bulk data-file reading.

All fixture content is SYNTHETIC — fictional FL999xxxx / GA999xxxx PWSIDs and
invented result values. The column names are real: they mirror EPA's published
UCMR layout, because the whole point is that a bulk row normalizes through the
same `normalize_ucmr5_result` as an Envirofacts row with no special-casing.
"""
from __future__ import annotations

import io
import tempfile
import unittest
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fwq import normalize
from fwq.sources import ucmr_bulk

from . import fixtures

RETRIEVED = datetime(2026, 8, 15, tzinfo=timezone.utc)

HEADERS = [
    "PWSID", "PWSName", "Size", "FacilityID", "FacilityName", "SamplePointID",
    "SamplePointName", "CollectionDate", "SampleID", "Contaminant", "MRL",
    "MethodID", "AnalyticalResultsSign", "AnalyticalResultValue",
    "MonitoringRequirement", "Region", "State", "UnitOfMeasure",
]


def _row(pwsid, contaminant, sign, value, state="FL", mrl="0.004"):
    return [
        pwsid, "EXAMPLE SHORELINE UTILITY AUTHORITY", "L", "F1", "PLANT 1", "EP-1",
        "ENTRY POINT 1", "05/14/2024", f"S-{contaminant}", contaminant, mrl,
        "533", sign, value, "AM", "04", state, "ug/L",
    ]


def _table(delimiter="\t", rows=None):
    rows = rows if rows is not None else [
        _row(fixtures.SYNTHETIC_PWSID_A, "PFOA", "=", "0.0062"),
        _row(fixtures.SYNTHETIC_PWSID_A, "PFOS", "<", "0.004"),
        _row(fixtures.SYNTHETIC_PWSID_B, "PFOA", "=", "0.0011"),
        _row("GA9990001", "PFOA", "=", "0.0500", state="GA"),
    ]
    lines = [delimiter.join(HEADERS)]
    lines.extend(delimiter.join(r) for r in rows)
    return "\n".join(lines) + "\n"


class TestDelimiterSniffing(unittest.TestCase):
    def test_picks_the_delimiter_that_yields_the_most_fields(self):
        self.assertEqual(ucmr_bulk.sniff_delimiter("\t".join(HEADERS)), "\t")
        self.assertEqual(ucmr_bulk.sniff_delimiter("|".join(HEADERS)), "|")
        self.assertEqual(ucmr_bulk.sniff_delimiter(",".join(HEADERS)), ",")

    def test_a_tab_file_is_not_mistaken_for_csv_because_a_name_has_a_comma(self):
        header = "PWSID\tContaminant\tPWSName"
        self.assertEqual(ucmr_bulk.sniff_delimiter(header), "\t")

    def test_undelimited_header_raises_rather_than_guessing(self):
        with self.assertRaises(ucmr_bulk.UcmrParseError):
            ucmr_bulk.sniff_delimiter("just one column")


class TestRowParsing(unittest.TestCase):
    def test_reads_rows_with_upstream_column_names_preserved(self):
        rows = list(ucmr_bulk.iter_rows(io.StringIO(_table())))
        self.assertEqual(len(rows), 4)
        self.assertEqual(rows[0]["PWSID"], fixtures.SYNTHETIC_PWSID_A)
        self.assertEqual(rows[0]["Contaminant"], "PFOA")
        self.assertEqual(rows[0]["AnalyticalResultsSign"], "=")

    def test_state_filter_applies_while_streaming(self):
        rows = list(ucmr_bulk.iter_rows(io.StringIO(_table()), state="FL"))
        self.assertEqual(len(rows), 3)
        self.assertTrue(all(r["State"] == "FL" for r in rows))

    def test_every_delimiter_produces_identical_rows(self):
        baseline = list(ucmr_bulk.iter_rows(io.StringIO(_table("\t"))))
        for delimiter in ("|", ","):
            with self.subTest(delimiter=delimiter):
                self.assertEqual(
                    list(ucmr_bulk.iter_rows(io.StringIO(_table(delimiter)))), baseline
                )

    def test_blank_lines_and_trailing_newlines_are_skipped(self):
        text = _table() + "\n\n"
        self.assertEqual(len(list(ucmr_bulk.iter_rows(io.StringIO(text)))), 4)

    def test_rows_without_a_pwsid_are_dropped(self):
        rows = [_row("", "PFOA", "=", "0.001"), _row(fixtures.SYNTHETIC_PWSID_A, "PFOA", "=", "0.001")]
        self.assertEqual(len(list(ucmr_bulk.iter_rows(io.StringIO(_table(rows=rows))))), 1)

    def test_a_file_missing_required_columns_is_refused(self):
        text = "SomeColumn\tAnother\nvalue\tvalue\n"
        with self.assertRaises(ucmr_bulk.UcmrParseError) as ctx:
            list(ucmr_bulk.iter_rows(io.StringIO(text)))
        self.assertIn("pwsid", str(ctx.exception))

    def test_empty_input_yields_nothing_rather_than_raising(self):
        self.assertEqual(list(ucmr_bulk.iter_rows(io.StringIO(""))), [])

    def test_rows_shorter_than_the_header_do_not_crash(self):
        text = "\t".join(HEADERS) + "\n" + "\t".join(["FL9990001", "NAME", "L"]) + "\n"
        rows = list(ucmr_bulk.iter_rows(io.StringIO(text)))
        self.assertEqual(rows[0]["PWSID"], "FL9990001")
        self.assertNotIn("UnitOfMeasure", rows[0])

    def test_a_row_with_no_state_column_is_kept_not_silently_dropped(self):
        headers = [h for h in HEADERS if h != "State"]
        text = "\t".join(headers) + "\n" + "\t".join(
            ["FL9990001"] + ["x"] * (len(headers) - 1)
        ) + "\n"
        self.assertEqual(len(list(ucmr_bulk.iter_rows(io.StringIO(text), state="FL"))), 1)


class TestZipReading(unittest.TestCase):
    def _archive(self, members: dict[str, str]) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            for name, content in members.items():
                archive.writestr(name, content)
        return buffer.getvalue()

    def test_reads_data_members_and_skips_documentation(self):
        data = self._archive({
            "UCMR5_All.txt": _table(),
            "README.pdf": "not a data file",
            "UCMR5_DataDictionary.xlsx": "also not",
        })
        rows = list(ucmr_bulk.iter_zip_rows(data, state="FL"))
        self.assertEqual(len(rows), 3)

    def test_an_unparseable_member_does_not_abort_the_archive(self):
        data = self._archive({
            "notes.txt": "this is prose, not a table\n",
            "UCMR5_All.txt": _table(),
        })
        rows = list(ucmr_bulk.iter_zip_rows(data, state="FL"))
        self.assertEqual(len(rows), 3, "the good member must still be read")

    def test_multiple_data_members_are_concatenated(self):
        data = self._archive({"part1.txt": _table(), "part2.csv": _table(",")})
        self.assertEqual(len(list(ucmr_bulk.iter_zip_rows(data, state="FL"))), 6)

    def test_read_bulk_file_handles_both_zip_and_plain_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            zip_path = Path(tmp) / "ucmr5.zip"
            zip_path.write_bytes(self._archive({"UCMR5_All.txt": _table()}))
            self.assertEqual(len(ucmr_bulk.read_bulk_file(zip_path, state="FL")), 3)

            txt_path = Path(tmp) / "ucmr5.txt"
            txt_path.write_text(_table(), encoding="utf-8")
            self.assertEqual(len(ucmr_bulk.read_bulk_file(txt_path, state="FL")), 3)

    def test_missing_file_raises_a_clear_error(self):
        with self.assertRaises(FileNotFoundError):
            ucmr_bulk.read_bulk_file("/nonexistent/ucmr5.zip")

    def test_summary_counts_systems_and_contaminants(self):
        rows = list(ucmr_bulk.iter_rows(io.StringIO(_table()), state="FL"))
        summary = ucmr_bulk.summarize(rows)
        self.assertEqual(summary, {"rows": 3, "systems": 2, "contaminants": 2})


class TestBulkRowsNormalizeIdentically(unittest.TestCase):
    """The point of the whole module: no special-casing downstream."""

    def test_a_bulk_row_normalizes_through_the_existing_ucmr5_normalizer(self):
        rows = list(ucmr_bulk.iter_rows(io.StringIO(_table()), state="FL"))
        detection = next(r for r in rows if r["Contaminant"] == "PFOA"
                         and r["PWSID"] == fixtures.SYNTHETIC_PWSID_A)
        result = normalize.normalize_ucmr5_result(detection, RETRIEVED)
        self.assertEqual(result.analyte_id, "pfoa")
        self.assertAlmostEqual(result.value, 6.2)  # 0.0062 ug/L -> 6.2 ng/L
        self.assertEqual(result.unit, "ng/L")
        self.assertTrue(result.compare_to_limit()["exceeds"])

    def test_a_bulk_non_detect_stays_a_non_detect(self):
        rows = list(ucmr_bulk.iter_rows(io.StringIO(_table()), state="FL"))
        non_detect = next(r for r in rows if r["Contaminant"] == "PFOS")
        result = normalize.normalize_ucmr5_result(non_detect, RETRIEVED)
        self.assertFalse(result.detected)
        self.assertIsNone(result.value)
        self.assertAlmostEqual(result.detection_limit, 4.0)
        self.assertIsNone(result.compare_to_limit())

    def test_bulk_and_envirofacts_rows_produce_the_same_record(self):
        bulk = next(
            r for r in ucmr_bulk.iter_rows(io.StringIO(_table()), state="FL")
            if r["Contaminant"] == "PFOA" and r["PWSID"] == fixtures.SYNTHETIC_PWSID_A
        )
        from_bulk = normalize.normalize_ucmr5_result(bulk, RETRIEVED)
        from_api = normalize.normalize_ucmr5_result(fixtures.UCMR5_ROWS[0], RETRIEVED)
        self.assertEqual(from_bulk.analyte_id, from_api.analyte_id)
        self.assertEqual(from_bulk.value, from_api.value)
        self.assertEqual(from_bulk.unit, from_api.unit)
        self.assertEqual(from_bulk.detected, from_api.detected)
        self.assertEqual(from_bulk.sample_date, from_api.sample_date)


if __name__ == "__main__":
    unittest.main()
