# PSN Library Repair Design

## Outcome

Repair existing PlayStation imports without asking users to re-upload files. Linked games retain a real IGDB identity and catalog artwork; unlinked titles remain explicit RAW entries; non-game purchases can be reversibly quarantined.

## Data model

`games` gains nullable indexed `catalog_game_id` and `link_state` (`linked`, `raw`, or `quarantined`). Existing `img_icon_url` stores the normalized IGDB cover URL. A migration backfills PSN `psn:<digits>` rows as linked and `psn:manual:*` rows as raw; it leaves every non-PSN row unchanged and performs no network I/O.

## Reconciliation API

Authenticated preview reads only the caller's PSN rows. It batch-searches RAW titles in IGDB and returns stable game IDs with `linked`, `auto_link`, `review`, or `quarantine` suggestions. Exact unique results auto-link; ambiguity or no result is review. Maintained exact service/app/theme identities and narrow normalized non-game phrases produce quarantine suggestions.

Apply accepts only explicit row actions: link (validated IGDB ID), keep RAW, quarantine, restore, and delete. It is owner-scoped and transactional. Linking a RAW row to an already-linked PSN row merges them, retaining the earliest creation date and meaningful notes/playtime.

## Library behavior

Normal and public library views exclude quarantined rows. Linked PSN cards use `catalog_game_id` for detail navigation and their stored IGDB cover/title. RAW cards deliberately have no catalog route and read “PSN title — not linked to catalog”. The library exposes RAW/quarantined counts and a Repair PSN library action.

## Import behavior

Bulk selection selects only `matched` rows with catalog IDs. Mapping rows retain per-row catalog suggestions/search and RAW is an explicit choice only. Confirmation separates Catalog, RAW, and Skipped counts and requires acknowledgment before RAW entries are persisted. Catalog imports write catalog ID, normalized catalog title, cover, and `linked`; RAW imports write `raw`.

## Safety and testing

No uploaded spreadsheet content is persisted or committed. Tests use anonymized fixtures and mock catalog/Redis integrations. Coverage includes migration backfill, ownership, rollback, duplicate merging/idempotency, quarantine visibility/restore/delete, overview/detail behavior, and the bulk-select/RAW acknowledgement regressions.
