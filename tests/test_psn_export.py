from io import BytesIO
import re
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from fastapi import HTTPException
from openpyxl import Workbook

from app.psn_export import parse_psn_export, psn_external_id


def make_export(rows: list[tuple[str, ...]], sheet_name: str = "Game Library") -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet_name
    for row in rows:
        worksheet.append(row)
    content = BytesIO()
    workbook.save(content)
    return content.getvalue()


def with_incorrect_sheet_dimension(content: bytes) -> bytes:
    source = BytesIO(content)
    result = BytesIO()
    with ZipFile(source) as workbook, ZipFile(result, "w", ZIP_DEFLATED) as rewritten:
        for entry in workbook.infolist():
            data = workbook.read(entry.filename)
            if entry.filename == "xl/worksheets/sheet1.xml":
                data = re.sub(br'(<dimension[^>]*ref=")[^"]+(")', br'\g<1>A1\g<2>', data)
            rewritten.writestr(entry, data)
    return result.getvalue()


def test_parse_psn_export_reads_unique_game_titles():
    content = make_export(
        [
            ("Game Title", "Date"),
            ("Hades", "2025-01-01"),
            ("hades", "2025-01-02"),
            ("  Returnal ", "2025-01-03"),
        ]
    )

    assert parse_psn_export(content) == ["Hades", "Returnal"]


def test_parse_psn_export_reads_titles_when_psn_sheet_dimension_is_incorrect():
    content = with_incorrect_sheet_dimension(
        make_export(
            [
                ("Game Name", "Product Name"),
                ("Hades", "Hades"),
                ("Returnal", "Returnal"),
            ],
            sheet_name="Transaction Detail",
        )
    )

    assert parse_psn_export(content) == ["Hades", "Returnal"]


def test_parse_psn_export_rejects_a_sheet_without_games():
    content = make_export([("Email", "Country"), ("player@example.com", "UA")], sheet_name="Account")

    with pytest.raises(HTTPException, match="No game list"):
        parse_psn_export(content)


def test_psn_external_id_is_stable_across_whitespace_and_case():
    assert psn_external_id("Hades") == psn_external_id("  hades  ")
