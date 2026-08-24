from io import BytesIO

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


def test_parse_psn_export_rejects_a_sheet_without_games():
    content = make_export([("Email", "Country"), ("player@example.com", "UA")], sheet_name="Account")

    with pytest.raises(HTTPException, match="contains no game activity or game purchases"):
        parse_psn_export(content)


def test_parse_psn_export_imports_only_game_transactions():
    content = make_export(
        [
            ("Transaction Date", "Game Name", "Content Type"),
            ("2026-01-01", "Returnal", "Game"),
            ("2026-01-01", "Returnal: Ascension", "DLC"),
            ("2026-01-02", "Wallet top up", "Wallet"),
        ],
        sheet_name='"Transaction Detail"',
    )

    assert parse_psn_export(content) == ["Returnal"]


def test_parse_psn_export_reads_online_and_vr_activity_titles():
    online_content = make_export([("Game Title",), ("Astro Bot",)], sheet_name='"Gameplay Online"')
    vr_content = make_export([("Game Title",), ("Beat Saber",)], sheet_name='"PS VR"')

    assert parse_psn_export(online_content) == ["Astro Bot"]
    assert parse_psn_export(vr_content) == ["Beat Saber"]


def test_parse_psn_export_explains_valid_export_without_game_records():
    content = make_export(
        [("If data is found the below table shows Gameplay Online Details.",)],
        sheet_name='"Gameplay Online"',
    )

    with pytest.raises(HTTPException, match="contains no game activity or game purchases"):
        parse_psn_export(content)


def test_psn_external_id_is_stable_across_whitespace_and_case():
    assert psn_external_id("Hades") == psn_external_id("  hades  ")
