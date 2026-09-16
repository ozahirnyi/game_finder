# AI recommendation card and return context

## Goal

Keep the explanation for each AI recommendation visible in its own card, and make the game-detail "Back to search" link return to the originating AI search without sending another AI request.

## Card layout

`GameCard` receives an optional description field. AI search passes the recommendation reason through that field. The card renders it inside its content area, below the title and clamps it to three lines. Other catalog cards remain unchanged because the field is optional.

## Return flow

When an AI result opens a game detail page, its link includes a return-search value for `/search?mode=ai&q=<prompt>`. The game detail page uses that value for its "Back to search" link. Directly opened games and catalog results continue to point to `/search`.

The search page uses the existing React Query entry keyed by the prompt, so returning restores the same cached result set and does not call the AI endpoint again.

## Tests

- AI results render the reason within the card and not as a sibling below it.
- An AI result link carries the exact AI return context.
- Game details use that context for "Back to search" and retain the existing default for ordinary navigation.
