from io import BytesIO
import re
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from fastapi import HTTPException
from openpyxl import Workbook

from app.psn_export import PsnExportCandidate, parse_psn_export, parse_psn_export_candidates, psn_external_id


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

    with pytest.raises(HTTPException, match="contains no game activity or game purchases"):
        parse_psn_export(content)


def test_parse_psn_export_uses_only_game_transactions_from_playstation_export():
    content = make_export(
        [
            ("PlayStation Data Access export",),
            ("Transaction Detail",),
            ("Transaction Date", "Game Name", "Product Name", "Content Type", "Platform"),
            ("2026-01-01", "Returnal", "Returnal", "Game", "PS5"),
            ("2026-01-01", "Returnal", "Returnal: Ascension", "DLC", "PS5"),
            ("2026-01-02", "Hades", "Hades", "GAME", "PS5"),
            ("2026-01-03", "Wallet", "Wallet top up", "Wallet", "PSN"),
        ],
        sheet_name="Transaction Detail",
    )

    assert parse_psn_export(content) == ["Returnal", "Hades"]


def test_parse_psn_export_reads_product_purchases_with_content_descriptors():
    content = make_export(
        [
            ("If data is found the below table shows the Details of Store Transactions.",),
            (),
            ("Transaction Detail",),
            ("Transaction Date", "Game Name", "Product Name", "Content Type", "Transaction Type"),
            ("2021-06-09", "GOD OF WAR", "God of War", "Violence", "Product Purchase"),
            ("2021-06-09", "Wallet", "Wallet top up", "Wallet", "Wallet Funding"),
        ],
        sheet_name='"Transaction Detail"',
    )

    assert parse_psn_export_candidates(content) == [
        PsnExportCandidate("GOD OF WAR", "God of War", None, "Product Purchase", "Violence"),
        PsnExportCandidate("Wallet", "Wallet top up", None, "Wallet Funding", "Wallet"),
    ]
    assert parse_psn_export(content) == ["GOD OF WAR"]


def test_parse_psn_export_candidates_retains_non_product_transactions_for_preview_classification():
    content = make_export(
        [
            ("Transaction Date", "Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"),
            ("2026-01-01", "Service item", "Service item", "Service", "Subscription Renewal", "PS5"),
        ],
        sheet_name="Transaction Detail",
    )

    assert parse_psn_export_candidates(content) == [
        PsnExportCandidate(
            "Service item",
            "Service item",
            "PS5",
            "Subscription Renewal",
            "Service",
        )
    ]


def test_parse_psn_export_reads_quoted_transaction_detail_sheet_name():
    content = make_export(
        [
            ("Transaction Date", "Game Name", "Content Type"),
            ("2026-01-01", "Returnal", "Game"),
            ("2026-01-01", "Returnal: Ascension", "DLC"),
        ],
        sheet_name='"Transaction Detail"',
    )

    assert parse_psn_export(content) == ["Returnal"]


def test_parse_psn_export_candidates_retains_transaction_detail_platform():
    content = make_export(
        [
            ("Transaction Date", "Game Name", "Product Name", "Content Type", "Platform"),
            ("2026-01-01", "MORTAL KOMBAT X", "MORTAL KOMBAT X", "Game", "PS4"),
        ],
        sheet_name="Transaction Detail",
    )

    assert parse_psn_export_candidates(content) == [
        PsnExportCandidate("MORTAL KOMBAT X", "MORTAL KOMBAT X", "PS4", None, "Game")
    ]


def test_parse_psn_export_candidates_preserves_paired_transaction_evidence():
    content = make_export([
        ("Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"),
        ("Example Game", "Example Game", "Game", "Product Purchase", "PS5"),
        ("Example Game", "Example Game Demo", "Game", "Voucher Purchase", "PS5"),
    ], sheet_name="Transaction Detail")

    [candidate] = parse_psn_export_candidates(content, "export.xlsx")

    assert [(row.product_name, row.transaction_type) for row in candidate.transactions] == [
        ("Example Game", "Product Purchase"), ("Example Game Demo", "Voucher Purchase"),
    ]


def test_parse_psn_export_candidates_aggregates_all_transaction_evidence_for_one_title():
    content = make_export(
        [
            ("Transaction Date", "Game Name", "Product Name", "Content Type", "Transaction Type", "Platform"),
            ("2026-01-01", "Hades", "Hades", "Violence", "Product Purchase", "PS5"),
            ("2026-01-02", " hades ", "Hades Complete Edition", "Game", "Product Purchase", "PS4"),
        ],
        sheet_name="Transaction Detail",
    )

    [candidate] = parse_psn_export_candidates(content)

    assert candidate.title == "Hades"
    assert candidate.product_names == ("Hades", "Hades Complete Edition")
    assert candidate.platforms == ("PS5", "PS4")
    assert candidate.content_types == ("Violence", "Game")
    assert candidate.transaction_types == ("Product Purchase",)


def test_parse_psn_export_explains_export_without_game_data():
    content = make_export(
        [("If data is found the below table shows Gameplay Online Details.",)],
        sheet_name='"Gameplay Online"',
    )

    with pytest.raises(HTTPException, match="contains no game activity or game purchases"):
        parse_psn_export(content)


def test_psn_external_id_is_stable_across_whitespace_and_case():
    assert psn_external_id("Hades") == psn_external_id("  hades  ")


def test_parse_psn_export_reads_unique_game_titles_from_csv():
    content = b"Game Title,Platform\nHades,PS5\n hades ,PS4\nCeleste,PS4\n"

    assert parse_psn_export(content, "library.csv") == ["Hades", "Celeste"]


def test_parse_psn_export_reads_titles_from_json_game_collection():
    content = b'{"games": [{"title": "Returnal"}, {"game name": "Hades"}, {"title": " returnal "}]}'

    assert parse_psn_export(content, "library.json") == ["Returnal", "Hades"]


def test_parse_psn_export_rejects_invalid_json():
    with pytest.raises(HTTPException, match="valid JSON"):
        parse_psn_export(b"{", "library.json")


def test_parse_psn_export_rejects_unsupported_file_extension():
    with pytest.raises(HTTPException, match="supported PSN export"):
        parse_psn_export(b"Game Title\nHades\n", "library.txt")
