# AI Search: Eight Recommendations Design

## Goal

AI search returns eight relevant, unique game recommendations instead of three, including when the local fallback is used.

## Architecture

The recommendation endpoint and its JSON response schema remain unchanged. The backend changes only the recommendation count requested from the AI model and the local fallback selection limit.

## Components and data flow

`build_prompt()` will instruct the AI model to return exactly eight recommendation items. `fallback_recommendations()` will first select games associated with keywords in the user's request, then append unique catalog entries in catalog order until it has eight results. The result remains a `RecommendationResponse`, so the existing web client will render the full list without a UI change.

## Error handling

Existing OpenAI errors and fallback behavior are unchanged. A fallback result always contains up to eight unique games; the shipped catalog contains more than eight games, so ordinary fallback requests will return exactly eight.

## Testing

Add a backend test asserting that a keyword-based fallback response contains eight unique games. Run the focused test and the relevant backend test suite.

## Scope

No API contract changes, new configuration, frontend layout changes, or unrelated refactors.
