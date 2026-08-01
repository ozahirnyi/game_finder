# PSN Import Formats Design

## Goal

Allow a signed-in player to preview and import a real PlayStation data export supplied as XLSX, CSV, or JSON, without presenting synthetic sample results in production.

## Scope

This work package covers PSN import parsing and the PSN import screen only. Restoring Home recommendations and configuring the production Telegram bot are separate follow-up packages.

## Architecture

`app.psn_export.parse_psn_export` will accept the uploaded bytes and filename. It will enforce the existing 10 MB limit once, select XLSX, CSV, or JSON from a supported filename extension, and delegate format reading to a small private parser. Each parser produces candidate values; a shared normalization and case-insensitive deduplication layer produces at most 500 stable display titles.

The preview endpoint will validate the same three extensions and pass the filename to the parser. The confirm endpoint will continue to consume only the preview token, so its API contract remains unchanged.

## Format Rules

- XLSX retains the current PlayStation-aware rules, including `Transaction Detail` filtering to `Content Type == Game`.
- CSV reads UTF-8 (including a BOM) and finds a title column using the existing normalized header vocabulary.
- JSON accepts either a top-level list of game objects or a top-level object containing a list under a recognized collection key. A game object contributes a title only when a recognized title field has a non-empty string value.
- Headers and JSON keys are normalized by trimming, condensing whitespace, and case-folding. Recognized title names are the existing `TITLE_HEADERS` vocabulary.
- Duplicate titles are removed case-insensitively while retaining the first normalized spelling. Blank values and values longer than 255 characters are ignored.

## Errors and Safety

- An empty upload returns HTTP 400; an upload over 10 MB returns HTTP 413.
- An unsupported extension or malformed CSV/JSON/XLSX returns HTTP 400 with a format-specific, actionable message.
- A supported document that contains no usable game titles returns HTTP 422 with the existing honest “No game list was found” message.
- JSON must be decoded as UTF-8 and must be a list or object of the supported shapes; no user-controlled data is logged.

## UI

The PSN import route retains file drop and file selection for `.xlsx`, `.csv`, and `.json`, and displays the API error returned by preview. It removes the `Use sample export`, `Preview empty state`, and `Preview error state` controls so all production states originate from a real user-selected file and server response.

## Testing

Tests are written first. Parser tests cover valid CSV, valid JSON, deduplication across case and whitespace, malformed JSON, unsupported extensions, and empty title sets; the existing XLSX tests remain regression coverage. API tests verify preview accepts each supported extension and preserves validation responses. Frontend route tests verify the demo controls are absent and real upload errors are shown.

## Non-goals

- Importing a live PSN account or scraping PlayStation.
- Guessing game titles from arbitrary columns, arbitrary JSON text, or invalid file extensions.
- Changing the preview-token confirmation contract.
- Reintroducing sample or mock content in production.
