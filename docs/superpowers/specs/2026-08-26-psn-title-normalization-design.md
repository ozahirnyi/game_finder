# PSN catalog title normalization

## Goal

Increase successful PSN-to-catalog game matches without automatically importing
subscriptions, DLC, demos, or ambiguous games.

## Matching order

For each purchase candidate, the importer continues to reject known
non-game product markers before catalog lookup. It then compares catalog
results in this order:

1. Exact normalized title: case, whitespace, trademark symbols, and Unicode
   punctuation are normalized.
2. Base-title match: apply the same normalization and remove only recognized
   edition and platform suffixes, such as `Complete Edition`, `Deluxe Edition`,
   `Game of the Year Edition`, `PS4`, `PS5`, and `PS4 & PS5`.

A candidate is automatically confirmed only if exactly one catalog result
matches at either stage. A zero-match or multi-match result remains a review
item and is never included in the confirmation payload.

## Safety

Normalization does not remove meaningful words from the game title, does not
use loose substring matching, and does not override the existing product-name
exclusions. The preview shows the canonical catalog title when a match is
confirmed.

## Testing

Unit tests cover an edition/platform PSN name that resolves to its base IGDB
title, a trademark/punctuation variant, and an ambiguous base-title result
that remains in review. The API test verifies confirmed IDs are returned only
for the unique safe match.
