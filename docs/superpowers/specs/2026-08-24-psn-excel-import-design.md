# PSN Excel Import Design

## Goal

Replace the decorative `/psn` page with a working, file-based PSN import that imports game titles Sony actually includes in a Data Access Excel export.

## Scope

- Accept PlayStation `.xlsx` Data Access exports up to the existing 10 MB limit.
- Extract and deduplicate game titles from:
  - `Transaction Detail` rows whose `Content Type` is `Game`.
  - `Gameplay Online` and `PS VR` rows when a recognised title column is present.
  - Other game-context worksheets with a recognised title column, preserving the existing conservative header matching.
- Show an upload, preview, selection, confirmation, and result flow at `/psn`.
- Explain a valid-but-empty export as a lack of PSN game data, not as an invalid file.

## Non-goals

- Do not claim to synchronise an entire PSN library, trophies, friends, online presence, or PS Plus.
- Do not add PSN credential-based trophy access, scraping, or CSV/JSON import formats.
- Do not infer games from wallet, subscription, account, friend, or PlayStation Stars records.

## Architecture

The FastAPI preview endpoint remains the authoritative parser. It classifies supported worksheets, returns normalised title strings, and raises a distinct 422 error when a valid Excel workbook has no importable game entries. The existing confirmation endpoint persists the user-selected titles with stable PSN external IDs and remains idempotent.

The TanStack `/psn` route owns the import UI and calls the existing preview and confirmation API helpers. It removes mock account claims and exposes only functionality backed by the API.

## User Flow

1. The signed-in user chooses an `.xlsx` file.
2. The client uploads it to `/psn/import/preview`.
3. On success, the UI displays the unique detected titles with selected state and a confirmation action.
4. On confirmation, it sends selected titles to `/psn/import/confirm` and displays created, updated, and skipped counts.
5. If the workbook is structurally valid but contains no supported game records, the UI displays: `This PSN export was read successfully, but it contains no game activity or game purchases to import.`

## Error Handling

- Non-XLSX uploads retain the existing format error.
- Invalid or unreadable XLSX files retain the existing upload error.
- A workbook with no recognised game rows produces the specific no-game-data message above.
- Backend errors surface in the import screen without clearing an already successful import result.

## Testing

- Parser tests cover game transactions, ignored non-game transactions, online/VR game-title rows, and an empty-but-valid workbook.
- Route tests cover file preview, selected-title confirmation, success counts, and the no-game-data error.
- Existing API helper contracts remain unchanged.
