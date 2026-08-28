# PSN Reversible Mapping Implementation Plan

**Goal:** Make every parsed PSN title reversible: exact catalog matches import
automatically, unresolved titles can be catalog-linked or imported as RAW, and
explicit clutter is suggested for skipping without being blocked.

**Architecture:** Aggregate transaction evidence by normalized title before
classification. Resolve unique titles in IGDB multiquery batches of ten; use
title equality as the automatic-match rule and metadata only to rank duplicate
matches. Sign each preview candidate instead of retaining server memory, then
validate each confirmation decision independently.

## Steps

1. Add parser/classifier tests for aggregated evidence and reversible clutter;
   write the aggregation and classification contract.
2. Add batch-resolution and signed-confirmation API tests; replace the legacy
   preview authorization and ID-list confirmation flow.
3. Update the API client and PSN import screen tests; implement grouped UI,
   restore, catalog search, RAW confirmation, and decision payloads.
4. Run focused tests, full backend/frontend suites, inspect the diff, commit,
   push `codex/psn-reversible-mapping`, and open a PR with sanitized counts.
