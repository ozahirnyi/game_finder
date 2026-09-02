# AI integration CI regression repair

## Goal

Restore the protected CI baseline after AI recommendation hardening was merged.

## Scope

Keep the recommendation endpoint authenticated. Update legacy integration tests
to authenticate successful recommendation requests, while retaining explicit
coverage for unauthenticated rejection. Rebase the AI quota Alembic revision on
the current catalog revision so the migration graph has one upgrade head.

Add focused test coverage for the authenticated recommendation API and its
quota response. This restores the project's 94% coverage requirement without
weakening its threshold.

## Validation

Run the migration-graph test, affected recommendation API integration tests,
the complete backend test suite with coverage, and the frontend clean install,
tests, lint, and build. No dependency manifests or unrelated application
behavior changes are in scope.
