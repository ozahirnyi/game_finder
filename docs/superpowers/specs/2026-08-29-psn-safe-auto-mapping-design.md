# PSN Safe Auto-Mapping Design

## Goal

Increase automatic catalog matches for PSN imports without turning ambiguous titles into incorrect catalog links or mass RAW entries.

## Approach

Normalize only provider formatting: Unicode punctuation, registered/trademark glyphs, edition/platform suffixes, region/console separators, and repeated whitespace. Preserve game-identifying words. Compare normalized PSN titles against normalized IGDB result names.

An import row is automatically linked only when the normalized match is unique after platform-aware disambiguation. Multiple or absent matches remain `needs_mapping` with suggestions. No fuzzy-score threshold, first-result bulk choice, or default RAW behavior is introduced.

## Validation

Unit/contract tests cover representative title formatting variants, exact uniqueness, ambiguity, and non-game exclusion. Provider calls stay mocked.
