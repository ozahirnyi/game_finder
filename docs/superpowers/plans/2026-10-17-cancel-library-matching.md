# Library matching restart confirmation and cancellation

User requested implementation inline. Existing results must survive an accidental click; an explicit cancellation must stop queued/running work and preserve completed batches. Work stays local for review.

**Design:** Confirm `Find catalog matches again?` before replacing a completed/cancelled preview or starting from an already matched library. Offer `Keep current results` and `Search again`. Running work exposes `Cancel` in place of the disabled start button. Cancelled jobs remain visible after navigation with their saved suggestions, counts and a clear stopped state. No game links are changed.

**Architecture:** Add an explicit terminal `cancelled` status to the existing job model/schema with an Alembic check-constraint migration. A source/owner-scoped POST cancellation endpoint revokes the lease atomically and retains the saved result. Matching workers monitor their lease while awaiting catalog work; cancellation interrupts pending async calls, suppresses final writes/requeues and prevents recovery from reviving the task. Calls already completed cannot be undone. Cancelling a job that finished concurrently returns its actual terminal state.

## Tasks

- [x] Add failing API tests for authentication, foreign/wrong-operation IDs, queued/running cancellation, repeated cancellation, completed-job races, saved partial batches and safe restart.
- [x] Add failing worker tests for cancellation before claim and during a blocked lookup, including no extra batch delivery and no overwrite after cancellation.
- [x] Add a failing migration round-trip test: new constraint accepts cancelled; downgrade maps cancelled to failed before restoring the old constraint. Update the single-head assertion.
- [x] Implement `cancelled` in `app/database.py`, `app/schemas.py`, `app/background_jobs.py`; add `alembic/versions/f3c1d5e7a9b2_cancel_background_jobs.py` after f2b0c4d6e8a1.
- [x] Add POST `/library/catalog-matches/jobs/{job_id}/cancel` in `app/main.py`, locking by owner and operation and returning BackgroundJobRead. Extend terminal dismissal to cancelled.
- [x] Implement lease monitoring in `app/worker.py` only for library matching; use a fresh short-lived session per check and cancel/drain pending work before returning.
- [x] Add failing frontend/API tests for restart cancel/confirm, existing-linked-library guard, cancel request/failure, saved partial results after cancellation, no automatic retry and late-response account isolation.
- [x] Extend `web/src/lib/api.ts`, `useLibraryCatalogJob.ts` and matching UI; pass known-linked state from Library. Preserve one spinner and manual uncertainty confirmation.
- [x] Add desktop/mobile browser coverage for restart confirmation and actual cancellation response, navigation/reload restoration and no unexpected start/apply calls.
- [x] Run focused RED/GREEN, full backend coverage, frontend tests, lint, type check, build and browser regression. Review inline; rebuild local app/web/worker and verify with the existing local account without applying or unlinking games.

## Verification

- Full backend coverage gate: 870 passed; 94.37% coverage (minimum 94%).
- Frontend: 428 passed in 56 files; full ESLint and TypeScript checks pass.
- Full Playwright: 58 passed, including restart/cancel/navigation on desktop and mobile.
- Local Docker app, web and worker rebuilt successfully; PostgreSQL migrated to f3c1d5e7a9b2.
- Real local browser/API check: Keep current results sent no start request; Search again created one task; Cancel persisted cancelled status after reload with no spinner. All six game rows and their links were unchanged, and no JavaScript page errors occurred.
- Review performed inline: owner/operation scoping, terminal-state races, pending I/O cancellation/draining, revoked lease publication guard, no recovery of cancelled work, and account-safe frontend cache updates.
- Local site remains available at http://localhost:3000/library. Changes are not pushed, merged or deployed.
