# FastAPI Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace web/ with the supplied Playfinder frontend and make it use the existing FastAPI service as its sole backend.

**Architecture:** The archive supplies the TanStack Start presentation layer. A frontend API client translates FastAPI DTOs into existing UI types and owns JWT lifecycle. FastAPI retains current integrations and adds profile, wishlist, and friendship resources through Alembic-managed PostgreSQL tables.

**Tech Stack:** TanStack Start, React 19, React Query, Vite, TypeScript, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, pytest.

## Global Constraints

- Preserve archive UI and do not edit web/src/routeTree.gen.ts.
- Use VITE_API_URL; do not put backend URLs or secrets in browser code.
- Keep existing FastAPI JWT, RAWG, Steam, PSN, prices, Google, Telegram, and AI integrations.
- Enforce authorization on every protected resource; friend DTOs exclude email, preferences, and tokens.
- Every changed data surface must have loading, empty, and retryable error states.

---

### Task 1: Replace the frontend and establish a test baseline

**Files:**

- Replace: web/ from C:\Users\zagir\Downloads\lovable-project-cf1fe460.zip
- Create: web/.env.local.example, web/vitest.config.ts, web/src/test/setup.ts
- Modify: web/package.json

**Interfaces:**

- Consumes: the supplied archive and VITE_API_URL.
- Produces: buildable TanStack Start frontend and a npm test command.

- [ ] **Step 1: Validate the archive before replacing the target**

~~~powershell
$archive = 'C:\Users\zagir\Downloads\lovable-project-cf1fe460.zip'
$staging = 'C:\Users\zagir\PycharmProjects\game_finder\.tmp-playfinder-frontend'
Expand-Archive -LiteralPath $archive -DestinationPath $staging -Force
Test-Path "$staging\package.json"
Test-Path "$staging\src\routes\__root.tsx"
~~~

- [ ] **Step 2: Replace only verified web/ files and add the API environment template**

~~~dotenv
VITE_API_URL=http://localhost:8000
~~~

- [ ] **Step 3: Add a failing test command and jsdom setup**

~~~ts
// web/src/test/setup.ts
import '@testing-library/jest-dom/vitest'
~~~

~~~ts
// web/vitest.config.ts
export default defineConfig({ test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] } })
~~~

- [ ] **Step 4: Install and verify baseline**

Run: npm install && npm run lint && npm run build && npm test

Expected: lint, production build, and the empty test suite succeed.

- [ ] **Step 5: Commit**

~~~bash
git add web
git commit -m "feat: replace frontend with Playfinder UI"
~~~

### Task 2: Add FastAPI client, JWT lifecycle, and public route mappings

**Files:**

- Create: web/src/lib/api.ts, web/src/lib/api.test.ts, web/src/lib/types.ts
- Modify: web/src/routes/sign-in.tsx, web/src/routes/sign-up.tsx, web/src/components/AppShell.tsx
- Modify: web/src/routes/index.tsx, web/src/routes/search.tsx, web/src/routes/deals.tsx, web/src/routes/games.$gameId.tsx

**Interfaces:**

- Consumes: FastAPI /auth/*, /search/games, /catalog/*, and /prices/*.
- Produces: apiRequest, JWT helpers, and UI-shaped Game and Deal queries.

- [ ] **Step 1: Write a failing JWT-expiry test**

~~~ts
it('clears a JWT after an authenticated 401', async () => {
  localStorage.setItem('game_finder_token', 'token')
  global.fetch = vi.fn().mockResolvedValue(new Response('{"detail":"expired"}', { status: 401 }))
  await expect(apiRequest('/games', { auth: true })).rejects.toMatchObject({ status: 401 })
  expect(localStorage.getItem('game_finder_token')).toBeNull()
})
~~~

- [ ] **Step 2: Verify RED**

Run: npm test -- src/lib/api.test.ts

Expected: FAIL because apiRequest is absent.

- [ ] **Step 3: Implement the smallest client contract**

~~~ts
export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const response = await fetch(apiUrl(path), requestInit(options))
  if (!response.ok) throw await toApiError(response, options.auth === true)
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
~~~

- [ ] **Step 4: Map public DTOs in route query options**

~~~ts
export const searchGamesQuery = (query: string) =>
  queryOptions({ queryKey: ['games', 'search', query], queryFn: () => searchGames(query) })
~~~

- [ ] **Step 5: Verify and commit**

Run: npm test -- src/lib/api.test.ts && npm run lint && npm run build

~~~bash
git add web/src web/package.json web/package-lock.json
git commit -m "feat: connect public Playfinder routes to FastAPI"
~~~

### Task 3: Add persistent profiles, wishlists, and friendships

**Files:**

- Modify: app/database.py, app/schemas.py, app/main.py
- Create: alembic/versions/<revision>_add_social_profile_resources.py, tests/test_social_api.py

**Interfaces:**

- Consumes: User from get_current_user.
- Produces: /profile/me, /wishlist, /friendships, and /friends/{friend_id}.

- [ ] **Step 1: Write failing authorization tests**

~~~python
def test_friend_profile_is_hidden_until_accepted(client, auth_headers, second_user):
    response = client.get(f"/friends/{second_user.id}", headers=auth_headers)
    assert response.status_code == 404

def test_cannot_read_another_users_wishlist(client, auth_headers, second_user):
    response = client.get(f"/wishlist?user_id={second_user.id}", headers=auth_headers)
    assert response.status_code == 403
~~~

- [ ] **Step 2: Verify RED**

Run: pytest tests/test_social_api.py -q

Expected: FAIL with 404 because the resource endpoints are absent.

- [ ] **Step 3: Add migration and models**

~~~python
class Profile(Base):
    __tablename__ = 'profiles'
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    handle: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    region: Mapped[str] = mapped_column(String(8), nullable=False, server_default='US')
~~~

~~~python
class WishlistEntry(Base):
    __tablename__ = 'wishlist_entries'
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    game_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    target_price: Mapped[Optional[float]] = mapped_column(Float)
~~~

- [ ] **Step 4: Add safe endpoint behavior**

~~~python
@app.get('/friends/{friend_id}', response_model=FriendProfileRead)
def get_friend_profile(friend_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if accepted_friendship(db, current_user.id, friend_id) is None:
        raise HTTPException(status_code=404, detail='Friend not found')
    return friend_profile_response(db, friend_id)
~~~

- [ ] **Step 5: Verify and commit**

Run: pytest tests/test_social_api.py -q && pytest -q

~~~bash
git add app alembic/versions tests/test_social_api.py
git commit -m "feat: add profiles wishlist and friendships"
~~~

### Task 4: Wire protected routes and retain all UI states

**Files:**

- Create: web/src/lib/social.ts, web/src/lib/social.test.ts
- Modify: web/src/routes/library.tsx, web/src/routes/wishlist.tsx
- Modify: web/src/routes/friends.index.tsx, web/src/routes/friends.$friendId.tsx, web/src/routes/account.tsx
- Modify: web/src/components/ProfileView.tsx, web/src/components/AppShell.tsx

**Interfaces:**

- Consumes: Task 2 API client and Task 3 authenticated endpoints.
- Produces: protected redirects, wishlist mutations, friendship actions, and safe profile rendering.

- [ ] **Step 1: Write failing UI-state tests**

~~~tsx
it('shows sign in from an unauthenticated wishlist', () => {
  render(<WishlistRoute />)
  expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', expect.stringContaining('/sign-in?returnTo='))
})
~~~

~~~tsx
it('renders retry after a friend query fails', async () => {
  render(<FriendsRoute />)
  expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
})
~~~

- [ ] **Step 2: Verify RED**

Run: npm test -- src/lib/social.test.ts

Expected: FAIL because protected queries and state components are absent.

- [ ] **Step 3: Implement the three query branches**

~~~tsx
if (query.isPending) return <LibrarySkeleton />
if (query.isError) return <InlineError onRetry={() => query.refetch()} />
if (query.data.length === 0) return <EmptyLibrary actionLabel="Add your first game" />
return <LibraryGrid games={query.data} />
~~~

- [ ] **Step 4: Retain one profile view**

~~~tsx
<ProfileView profile={profile} isOwnProfile={false} recentActivity={activity} />
~~~

- [ ] **Step 5: Verify and commit**

Run: npm test && npm run lint && npm run build

~~~bash
git add web/src
git commit -m "feat: connect protected Playfinder routes"
~~~

### Task 5: Document, verify, and publish

**Files:**

- Modify: README.md, web/.env.local.example

**Interfaces:**

- Consumes: all implemented API and routes.
- Produces: local-start documentation, verified build, pushed branch, and draft pull request.

- [ ] **Step 1: Document local integration**

~~~markdown
1. Set VITE_API_URL=http://localhost:8000 in web/.env.local.
2. Start FastAPI with docker compose up --build app.
3. In web/, run npm install then npm run dev.
~~~

- [ ] **Step 2: Run complete verification**

Run: pytest -q && npm test && npm run lint && npm run build

Expected: all backend tests and frontend checks pass.

- [ ] **Step 3: Browser acceptance pass**

~~~text
Guest home → search → game detail → sign up → sign in → library empty state → add game → wishlist → profile → friend profile → sign out.
~~~

- [ ] **Step 4: Commit, push, and open a draft PR**

~~~bash
git add README.md web/.env.local.example
git commit -m "docs: document Playfinder FastAPI integration"
git push -u origin codex/fastapi-frontend-integration
gh pr create --draft --fill
~~~

