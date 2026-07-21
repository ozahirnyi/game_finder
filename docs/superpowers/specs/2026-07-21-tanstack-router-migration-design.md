# TanStack Router migration design

## Goal

Remove every runtime dependency on `next/link` and `next/navigation` without adding Next.js, so the Vite and TanStack Start application builds and tests consistently.

## Scope

- Update all remaining imports under `web/src`, including legacy `app/*` pages, shared components, feature components, and `components/lovable/*`.
- Preserve each current URL, navigation target, query parameter, dynamic path parameter, and UI copy.
- Keep existing files in place; this migration does not delete screens or redesign the interface.

## Mapping

| Next API | TanStack Router replacement |
| --- | --- |
| `next/link` | `Link` from `@tanstack/react-router` using `to` |
| `useRouter().push(path)` | `useNavigate()` then `navigate({ to: path })` |
| `useRouter().replace(path)` | `useNavigate()` then `navigate({ to: path, replace: true })` |
| `usePathname()` | `useRouterState({ select: state => state.location.pathname })` |
| `useSearchParams()` | Route-specific `useSearch()` where a TanStack route exists; otherwise parse `useRouterState(...location.searchStr)` |
| `useParams()` | Route-specific `useParams()` from the matching generated route |

## Error handling and testing

- Navigation uses only valid internal routes; no new external redirects are introduced.
- Tests stop mocking nonexistent `next/*` modules and instead test TanStack Router behavior or use the project router harness.
- CI verification consists of the frontend Vitest suite, ESLint, and production Vite build. A zero-match search for `next/link` and `next/navigation` confirms the dependency has been fully removed.

## Constraints

- Do not add the `next` package.
- Do not modify generated `web/.output` files.
- Do not change backend OAuth behavior as part of this task.
