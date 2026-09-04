# AI Search: Validated Results Design

## Goal

Let a signed-in user describe any kind of game in natural language and receive up to ten relevant, real, catalog-linked game recommendations. A failed provider or catalog lookup must neither leave the interface loading indefinitely nor consume a daily successful-search allowance.

## User experience

The search form keeps its AI mode. The model is asked for **up to ten** recommendations, rather than exactly ten: it must return only games it believes genuinely fit the prompt. The result page renders every recommendation that has been resolved to a real IGDB game. Each displayed item is a normal clickable `GameCard`; no title-only cards or search-link fallbacks are shown.

On desktop, the result grid uses five columns, so ten results form two rows. Existing responsive breakpoints reduce the column count on narrower viewports.

When a title cannot be resolved, it is omitted. A result of six valid games is successful and renders six cards. When zero titles resolve, the UI shows a recoverable empty/error state and no allowance is consumed.

## Backend flow

1. Validate the authenticated request and check the account-level daily quota and cooldown without incrementing it.
2. Send the natural-language prompt to OpenAI. The structured response includes up to ten distinct title recommendations, with a concise reason and optional release year.
3. Resolve all returned titles through one bounded IGDB batch lookup. Exact normalized title matching attaches the matching catalog record.
4. Return only resolved recommendations, retaining their catalog identifier, cover, platform, and genre data. A zero-result resolution raises a typed, user-safe unavailable/no-match response.
5. Increment and commit the quota only after at least one resolved, renderable recommendation is ready. Provider failure, catalog failure, and zero matched titles leave quota unchanged.

The batch lookup receives a sensible end-to-end timeout and one short retry only for transient transport failures. It replaces the present per-title catalog searches, whose serialized provider lock can make the request take more than a minute.

## Quota semantics

The allowance remains three successful AI searches per UTC day for each authenticated `user_id`, with the existing per-account cooldown. It is not keyed by IP address. A request blocked by the limit or cooldown does not change the count. A request that cannot return any valid card also does not change the count.

## Error handling

The API differentiates invalid prompts, unauthenticated users, cooldown/limit failures, provider failures, catalog failures, and no resolved matches. The browser client has an explicit request timeout and renders the returned message with a retry action. It never shows an unbounded loading indicator.

## Local-first acceptance criteria

- A complex natural-language prompt can yield between one and ten clickable catalog cards.
- A model response with unresolved titles yields only its resolved subset.
- A response with no resolved titles does not consume quota and presents a retryable state.
- OpenAI/IGDB timeouts do not consume quota and the browser exits loading within its timeout.
- Ten results render as two rows of five at the desktop breakpoint.
- All backend and frontend tests pass locally before any deployment is considered.
