# PSN Durable Catalog Enrichment Design

## Goal

Make PSN catalog matching complete independently of an open browser tab, while
retaining the existing conservative matching rules and making the progress and
final state visible in the library.

## Context

PSN import currently persists selected entries as `raw`. The browser opens the
library and repeatedly calls `/psn/library-repair/enrich` to run catalog
matching. Consequently a user who leaves the page never receives enrichment.
The library query is keyed as `library-overview-page`, while several mutation
callbacks invalidate `library` or `library-overview`; these keys do not refresh
the active paginated library query.

The application already has a durable `background_jobs` table, Redis-backed ARQ
delivery, lease recovery, and a separate `app-worker` production service. This
feature extends that mechanism; it does not add Celery, a second Redis queue, or
FastAPI in-process background tasks.

## Architecture

### Job lifecycle

After `POST /psn/import/confirm` persists its selected PSN games, it creates or
reuses one active `psn_catalog_enrichment` job for the authenticated user. The
idempotency key is stable per owner and operation, so repeated confirms while a
job is queued or running reuse the same job. The endpoint returns the ordinary
import counts plus a safe `BackgroundJobRead` representation for this job.

The request attempts Redis dispatch after the database commit. Redis dispatch
failure does not fail the import: the durable job stays `queued` and the
existing worker recovery cron re-delivers it.

The ARQ worker handles `psn_catalog_enrichment`. It repeatedly obtains the
user's pending PSN rows in the existing bounded order and batch size, invokes
the existing `resolve_psn_catalog_evidence` decision logic, and commits each
completed batch. It finishes only when no pending rows remain. The worker uses
the existing linking, quarantine, matcher-version, and owner-scoping rules so
the HTTP endpoint and worker cannot diverge in matching behavior.

### Localized titles

Catalog retrieval also resolves provider-maintained alternative game names.
This lets a PSN title written in Russian, Japanese, Korean, Chinese, or another
locale locate the same IGDB game whose primary `name` is in English. The IGDB
integration returns a game's alternative-name values as part of its normalized
catalog result, and the matcher treats an exact normalized equality with one of
those values as explicit catalog evidence. It does not transliterate or call a
generative translation provider during automatic enrichment.

An alternative-name result must still pass every existing PlayStation platform,
game-type, edition, score, and ambiguity guard. Multiple eligible games remain
`review`; an absent alternative name remains `no_match`. Thus localization
increases retrieval recall but never permits a guessed cross-language link.

For a raw review/no-match entry, the manual catalog picker retains its editable
search field and gains a clearly labelled option to request English-title
suggestions. Suggestions are query text only, never a catalog id or an automatic
link; the user chooses an IGDB result before any state changes. The suggestion
endpoint returns a bounded list, uses existing OpenAI configuration only when
available, and degrades to a clear unavailable message without blocking manual
search.

If IGDB is temporarily unavailable for a batch, the worker rolls back that
batch, returns the durable job to `queued`, clears its lease, and ends the
current invocation. The recovery cron will redeliver it; affected
games retain their previous pending state and are never incorrectly marked
`no_match`. A permanent unexpected error is recorded as the existing safe
generic `failed` job error. A new import can create a subsequent job after a
terminal failure.

### API and UI state

`PsnImportResult` gains an optional `catalog_job` field. The frontend stores its
id after a successful import and polls `GET /background-jobs/{jobId}` while its
status is `queued` or `running`. The import result screen communicates queued,
matching, success, and retryable failure states without exposing IGDB errors or
job payloads.

When the job reaches `succeeded`, the frontend invalidates
`["library-overview-page"]` (all variants), `["psn-library-repair"]`, and the
onboarding/profile summaries that display PSN counts. Existing manual linking,
repair actions, and import confirmation use the same exact paginated library
key. The library page removes its client-owned enrichment loop; it only renders
the persisted state. Raw rows continue to display the catalog picker for
`review` or `no_match` outcomes.

The worker records aggregate result fields only: attempted, linked, review,
quarantined, remaining. This is enough for progress UI and does not place PSN
titles or provider responses in `background_jobs.result`.

## Boundaries and Safety

- No fuzzy matching is introduced. Existing exact/normalized aliases,
  platform, edition, type, and ambiguity thresholds remain authoritative.
- A generated or transliterated title is never enough to auto-link a PSN game;
  only an exact provider primary or alternative name can be automatic evidence.
- All database queries remain constrained by the job owner. A user may poll
  only their own job through the existing endpoint.
- No migration is needed: `BackgroundJob.operation`, JSON `payload`, and JSON
  `result` already support the operation and aggregate progress. PSN game state
  already persists link and lookup fields.
- Worker processing is bounded by the existing PSN enrichment batch size. It
  commits after each batch so a restart repeats at most an unresolved batch.
- Manual repair remains available for legitimate ambiguous and absent catalog
  records; background processing never overwrites `linked`, `quarantined`, or
  user-skipped rows.

## Testing

Backend tests cover job creation/reuse and nonfatal Redis dispatch failure from
import confirmation; worker success across multiple batches; persisted aggregate
progress; temporary IGDB unavailability returning the job to queued without
advancing lookup state; and owner-safe result polling. Matcher tests cover a
localized exact alternative name, rejected ambiguous localized records, and an
absent alternative name. Existing matcher tests remain the authority for match
safety.

Frontend Vitest tests cover receiving a job from import confirmation, polling
until terminal state, progress copy, exact query-key invalidation, rendering an
unlinked row with its manual catalog picker after completion, and using an
English-title suggestion only as an editable manual search query. Tests mock
polling, IGDB, and translation calls; they do not require Redis or a worker.

## Acceptance Criteria

1. Confirmed PSN imports enqueue durable catalog enrichment without requiring a
   visit to the library.
2. Enrichment completes every pending batch under the importing user's scope.
3. Redis or IGDB transients do not lose imported games, create false mappings,
   or permanently classify unresolved games as no-match.
4. The library refreshes automatically on successful enrichment and no longer
   displays a stale RAW card for a row that the worker linked.
5. Ambiguous and absent matches remain manually linkable.
6. A localized PSN title is automatically linked only when IGDB returns an
   exact provider-maintained alternative name and all existing safety rules pass.
