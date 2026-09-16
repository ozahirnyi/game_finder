# Full AI card descriptions

AI recommendation reasons remain inside their own `GameCard`, but are no longer line-clamped. This keeps every explanation readable without an extra interaction. Cards can have different heights; the grid remains structurally correct because each description belongs to its card.

The change does not affect the AI search cache, game links, or the return-to-search flow.

Tests will assert that the card description has no line-clamping class and remains rendered in full.
