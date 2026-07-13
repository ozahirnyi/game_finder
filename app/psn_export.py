import hashlib
import re
from io import BytesIO
from itertools import chain
from typing import Iterable

from fastapi import HTTPException
from openpyxl import load_workbook


MAX_EXPORT_BYTES = 10 * 1024 * 1024
MAX_IMPORTED_GAMES = 500
TITLE_HEADERS = {
    "game",
    "game title",
    "title",
    "product name",
    "content title",
    "game name",
}
GAME_SHEET_MARKERS = {"game", "troph", "purchase", "library", "content"}


def normalize_title(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    title = re.sub(r"\s+", " ", value).strip()
    if not title or len(title) > 255:
        return None
    return title


def _normalized_header(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _candidate_columns(rows: Iterable[tuple[object, ...]], sheet_name: str) -> tuple[int, list[int]] | None:
    name = sheet_name.lower()
    for row_index, row in enumerate(rows):
        headers = [_normalized_header(value) for value in row]
        columns = [index for index, header in enumerate(headers) if header in TITLE_HEADERS]
        has_game_context = any(marker in name for marker in GAME_SHEET_MARKERS) or any(
            marker in header for header in headers for marker in GAME_SHEET_MARKERS
        )
        if columns and has_game_context:
            return row_index, columns
    return None


def parse_psn_export(content: bytes) -> list[str]:
    if not content:
        raise HTTPException(status_code=400, detail="The PSN export file is empty")
    if len(content) > MAX_EXPORT_BYTES:
        raise HTTPException(status_code=413, detail="The PSN export must be 10 MB or smaller")

    try:
        workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Upload the Excel file received from PlayStation (.xlsx)") from exc

    titles: dict[str, str] = {}
    try:
        for worksheet in workbook.worksheets:
            rows = worksheet.iter_rows(values_only=True)
            buffered_rows: list[tuple[object, ...]] = []
            for _ in range(20):
                try:
                    buffered_rows.append(next(rows))
                except StopIteration:
                    break
            header = _candidate_columns(buffered_rows, worksheet.title)
            if not header:
                continue
            header_index, columns = header
            for row in chain(buffered_rows[header_index + 1 :], rows):
                for column in columns:
                    title = normalize_title(row[column] if column < len(row) else None)
                    if title:
                        titles.setdefault(title.casefold(), title)
                        if len(titles) >= MAX_IMPORTED_GAMES:
                            return list(titles.values())
    finally:
        workbook.close()

    if not titles:
        raise HTTPException(
            status_code=422,
            detail="No game list was found in this export. PlayStation exports vary by region; check the file or request a new Data Access export.",
        )
    return list(titles.values())


def psn_external_id(title: str) -> str:
    normalized = re.sub(r"\s+", " ", title).strip().casefold()
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]
    return f"psn:{digest}"
