# Google and Steam sign-in on Railway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Google OIDC and Steam OpenID registration/sign-in reliable on Railway, with safe account creation, reuse, linking, and deployment guidance.

**Architecture:** Keep FastAPI as the OAuth/OpenID relying party. Extract the repeated short-lived result-code logic and provider-account resolution into focused helpers, while retaining the existing browser redirect plus frontend one-time exchange. The frontend preserves its two provider buttons and displays a useful callback error; Railway configuration remains environment-driven.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, httpx, python-jose, pytest, React 19, TypeScript, Vitest, Railway.

## Global Constraints

- Preserve password registration and login behavior.
- A Google user may be matched to an existing account only by a verified, normalized Google email.
- A first-time Steam OpenID user must not be merged with an existing account automatically; use `steam-<steam-id>@steam.invalid` for its internal email.
- Keep Steam linking restricted to an authenticated profile flow.
- Do not commit Google, Steam, Railway, or JWT secrets.
- Do not modify generated `web/.output` artifacts or unrelated existing working-tree changes.

---

## File structure

| File | Responsibility |
| --- | --- |
| `app/social_auth.py` | Provider-independent authorization transaction consumption, one-time JWT exchange result creation, Google account resolution, and Steam account resolution. |
| `app/main.py` | Thin HTTP routes: start provider flow, receive provider callback, redirect to frontend, and exchange the one-time code. |
| `tests/test_social_auth.py` | SQLite-backed unit tests for account resolution and single-use transaction helpers. |
| `tests/test_google_auth.py` | Google OIDC URL and token-validation boundary tests. |
| `tests/test_steam_auth.py` | Steam OpenID URL, callback URL, and assertion boundary tests. |
| `web/src/app/auth/callback/page.tsx` | Provider callback status and error/retry UI. |
| `web/src/features/auth/auth.test.tsx` | Provider button and callback error UX tests. |
| `.env.example` and `README.md` | Exact Google/Steam/Railway configuration and manual validation checklist. |

### Task 1: Provider-independent transaction and account helpers

**Files:**
- Create: `app/social_auth.py`
- Modify: `app/main.py:137-145, 369-462, 465-514`
- Test: `tests/test_social_auth.py`

**Interfaces:**
- Consumes: `Session`, `User`, `OAuthIdentity`, `OAuthAuthorizationTransaction`, `normalize_email()`, `random_token()`, and `utcnow()`.
- Produces: `consume_authorization_transaction(db, state, expected_mode) -> OAuthAuthorizationTransaction | None`, `create_exchange_result(db, user_id) -> str`, `consume_exchange_result(db, exchange_code) -> uuid.UUID | None`, `resolve_google_user(db, subject, email) -> User`, and `resolve_steam_user(db, steam_id, profile) -> User`.

- [ ] **Step 1: Write failing helper tests**

```python
def test_resolve_google_user_reuses_email_account_and_links_identity(db):
    existing = User(email="player@example.com", password_hash="hash")
    db.add(existing); db.commit()

    user = resolve_google_user(db, "google-subject", " Player@Example.COM ")

    assert user.id == existing.id
    assert db.query(OAuthIdentity).filter_by(
        provider="google", provider_subject="google-subject", user_id=existing.id,
    ).count() == 1


def test_exchange_result_is_single_use(db):
    user = User(email="player@example.com", password_hash=None)
    db.add(user); db.commit()
    code = create_exchange_result(db, user.id)

    assert consume_exchange_result(db, code) == user.id
    assert consume_exchange_result(db, code) is None
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `rtk pytest -q tests/test_social_auth.py`

Expected: FAIL because `app.social_auth` does not exist.

- [ ] **Step 3: Implement the focused helpers**

```python
def create_exchange_result(db: Session, user_id: uuid.UUID) -> str:
    exchange_code = random_token()
    db.add(OAuthAuthorizationTransaction(
        state=random_token(), code_verifier="consumed", nonce="consumed", mode="result",
        exchange_code=exchange_code, result_user_id=user_id,
        expires_at=utcnow() + timedelta(seconds=60),
    ))
    db.commit()
    return exchange_code


def consume_exchange_result(db: Session, exchange_code: str) -> uuid.UUID | None:
    transaction = db.query(OAuthAuthorizationTransaction).filter_by(
        exchange_code=exchange_code, mode="result",
    ).first()
    if not transaction or transaction.expires_at <= utcnow() or not transaction.result_user_id:
        return None
    user_id = transaction.result_user_id
    db.delete(transaction)
    db.commit()
    return user_id
```

Implement `consume_authorization_transaction` with an expected mode and delete/commit before a provider network call. Implement Google resolution with identity-first, then normalized email lookup, then passwordless user creation. Implement Steam resolution by `steam_id` and create a passwordless `steam_sign_in_email(steam_id)` account only when absent.

- [ ] **Step 4: Make `app/main.py` call those helpers**

```python
transaction = consume_authorization_transaction(db, state, "google_login")
if transaction is None:
    return oauth_frontend_redirect(provider="google", error="invalid_state")

claims = await verify_google_id_token(token_data["id_token"], transaction.nonce)
user = resolve_google_user(db, claims["sub"], claims["email"])
return oauth_frontend_redirect(provider="google", exchange_code=create_exchange_result(db, user.id))
```

Use distinct modes (`google_login`, `google_link`, `steam_login`, `result`); retain `user_id` for Google linking and reject another user's already-linked Google identity. Replace the misleading `google_frontend_redirect` name with `oauth_frontend_redirect` because it is shared by both providers. The exchange endpoint must return HTTP 401 if `consume_exchange_result` returns `None`.

- [ ] **Step 5: Run focused backend tests**

Run: `rtk pytest -q tests/test_social_auth.py tests/test_google_auth.py`

Expected: PASS.

- [ ] **Step 6: Commit the backend helper change**

```bash
git add app/social_auth.py app/main.py tests/test_social_auth.py tests/test_google_auth.py
git commit -m "feat: harden social sign-in transactions"
```

### Task 2: Steam OpenID sign-in and linking boundary

**Files:**
- Modify: `app/main.py:465-514`
- Test: `tests/test_steam_auth.py`

**Interfaces:**
- Consumes: `consume_authorization_transaction(db, state, "steam_login")`, `resolve_steam_user(db, steam_id, profile)`, `create_exchange_result(db, user_id)`, and `get_backend_public_url(request)`.
- Produces: reliable `/auth/steam/login-url`, `/auth/steam/callback`, and `/auth/steam/exchange` behavior without changing `/steam/login-url` and `/steam/callback` profile linking.

- [ ] **Step 1: Write failing Steam flow tests**

```python
@pytest.mark.anyio
async def test_steam_callback_creates_then_reuses_the_same_user(db, monkeypatch):
    monkeypatch.setattr(main, "verify_steam_openid", async_return("76561198000000000"))
    monkeypatch.setattr(main, "fetch_steam_profile", async_return(STEAM_PROFILE))
    state = create_steam_login_transaction(db)

    first = await main.steam_sign_in_callback(fake_request(), state, db)
    second = await main.steam_sign_in_callback(fake_request(), create_steam_login_transaction(db), db)

    assert first.status_code == second.status_code == 303
    assert db.query(User).filter_by(steam_id="76561198000000000").count() == 1


def test_steam_login_url_uses_railway_public_api_url(client, monkeypatch):
    monkeypatch.setenv("BACKEND_PUBLIC_URL", "https://api.example.railway.app")
    response = client.get("/auth/steam/login-url")
    assert "openid.realm=https%3A%2F%2Fapi.example.railway.app%2F" in response.json()["url"]
```

`async_return(value)` is a local test helper that returns an `async def` function yielding `value`; `fake_request()` supplies callback query parameters and a HTTPS base URL.

- [ ] **Step 2: Run the Steam tests to verify they fail**

Run: `rtk pytest -q tests/test_steam_auth.py`

Expected: FAIL until the callback delegates to the extracted helper and the test fixtures are present.

- [ ] **Step 3: Implement Steam callback delegation**

```python
steam_id = await verify_steam_openid(dict(request.query_params))
profile = await fetch_steam_profile(steam_id)
user = resolve_steam_user(db, steam_id, profile)
return oauth_frontend_redirect(
    provider="steam", exchange_code=create_exchange_result(db, user.id),
)
```

Keep `verify_steam_openid` as the only authority for Steam assertion verification. On provider failure, rollback the session and redirect with `error="authentication_failed"`; never emit tokens in redirect query parameters. Preserve the existing authenticated `/steam/callback` path and its account-conflict response unchanged.

- [ ] **Step 4: Run focused Steam tests**

Run: `rtk pytest -q tests/test_steam_auth.py`

Expected: PASS.

- [ ] **Step 5: Commit the Steam flow**

```bash
git add app/main.py tests/test_steam_auth.py
git commit -m "feat: finalize Steam sign-in flow"
```

### Task 3: Frontend provider callback resilience

**Files:**
- Modify: `web/src/app/auth/callback/page.tsx`
- Modify: `web/src/features/auth/auth.test.tsx`
- Create: `web/src/app/auth/callback/page.test.tsx`

**Interfaces:**
- Consumes: `provider`, `exchange_code`, and `error` URL parameters; `exchangeGoogleCode`, `exchangeSteamCode`, and `setToken` from `web/src/lib/api.ts`.
- Produces: provider-specific success/cancellation/expiry display, one exchange attempt for a valid code, and a safe `/login` retry route.

- [ ] **Step 1: Write failing browser callback tests**

```tsx
it("does not exchange a provider cancellation and offers a retry", () => {
  mockSearchParams({ provider: "google", error: "access_denied" });
  render(<OAuthCallback />);

  expect(exchangeGoogleCode).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Back to sign in" })).toBeVisible();
});

it("exchanges a Steam code and redirects to the profile", async () => {
  mockSearchParams({ provider: "steam", exchange_code: "x".repeat(32) });
  exchangeSteamCode.mockResolvedValue({ access_token: "jwt", token_type: "bearer" });
  render(<OAuthCallback />);

  await waitFor(() => expect(setToken).toHaveBeenCalledWith("jwt"));
  expect(replace).toHaveBeenCalledWith("/profile");
});
```

- [ ] **Step 2: Run the callback tests to verify they fail**

Run: `rtk proxy npm.cmd --prefix web test -- --run web/src/app/auth/callback/page.test.tsx`

Expected: FAIL until the callback distinguishes the `error` parameter.

- [ ] **Step 3: Implement explicit callback states**

```tsx
const error = params.get("error");
const validProvider = provider === "google" || provider === "steam";
const canExchange = validProvider && Boolean(code) && !error;
const displayMessage = error
  ? "Sign-in was cancelled or could not be completed. Please try again."
  : !canExchange
    ? "Sign-in was cancelled or expired."
    : message;
```

Use `canExchange` in the effect guard and expose the retry link whenever an error/invalid state is displayed. Keep the existing token storage and `/profile` redirect after successful exchange.

- [ ] **Step 4: Extend provider-button coverage**

```tsx
it("starts Google and Steam from registration", async () => {
  api.getGoogleLoginUrl.mockResolvedValue({ url: "https://google.example/auth" });
  api.getSteamSignInUrl.mockResolvedValue({ url: "https://steam.example/openid" });
  render(<AuthPanel mode="register" />);

  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(api.getGoogleLoginUrl).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Continue with Steam" }));
  await waitFor(() => expect(api.getSteamSignInUrl).toHaveBeenCalledOnce());
});
```

Mock `window.location.assign` and assert it receives each returned URL.

- [ ] **Step 5: Run web tests and lint**

Run: `rtk proxy npm.cmd --prefix web test -- --run web/src/features/auth/auth.test.tsx web/src/app/auth/callback/page.test.tsx`

Expected: PASS.

Run: `rtk proxy npm.cmd --prefix web run lint`

Expected: exit code 0.

- [ ] **Step 6: Commit the frontend UX**

```bash
git add web/src/app/auth/callback/page.tsx web/src/app/auth/callback/page.test.tsx web/src/features/auth/auth.test.tsx
git commit -m "fix: clarify social sign-in callback states"
```

### Task 4: Railway configuration and end-to-end verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md:155-250`
- Test: `tests/test_google_auth.py`
- Test: `tests/test_steam_auth.py`

**Interfaces:**
- Consumes: `FRONTEND_PUBLIC_URL`, `FRONTEND_ORIGIN`, `FRONTEND_ORIGINS`, `BACKEND_PUBLIC_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `STEAM_API_KEY`.
- Produces: a copyable production configuration section and tests proving provider URL construction uses the configured HTTPS public API URL.

- [ ] **Step 1: Write failing Railway URL construction tests**

```python
def test_google_redirect_uri_is_exact_railway_callback(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://api.example.railway.app/auth/google/callback")

    query = parse_qs(urlparse(build_google_authorization_url("state", "verifier", "nonce")).query)

    assert query["redirect_uri"] == ["https://api.example.railway.app/auth/google/callback"]
```

- [ ] **Step 2: Run documentation-boundary tests to verify current behavior**

Run: `rtk pytest -q tests/test_google_auth.py tests/test_steam_auth.py`

Expected: PASS after Tasks 1 and 2; this establishes the exact URL contract documented below.

- [ ] **Step 3: Document exact production settings and manual checklist**

Add a Railway section containing this template, without real hostnames or credentials:

```dotenv
FRONTEND_ORIGINS=https://<frontend-domain>
FRONTEND_PUBLIC_URL=https://<frontend-domain>
BACKEND_PUBLIC_URL=https://<api-domain>
GOOGLE_CLIENT_ID=<Google OAuth web client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth web client secret>
GOOGLE_REDIRECT_URI=https://<api-domain>/auth/google/callback
STEAM_API_KEY=<Steam Web API key>
```

Document Google Cloud Console's exact authorized redirect URI and Steam's required public HTTPS realm/return URL. Add a manual production checklist: Google first sign-in; Google email reuse; Google repeat sign-in; Steam first and repeat sign-in; profile Steam link; provider cancellation; exchange-code replay rejection. State that a browser/real provider check needs the deployer's credentials and cannot be executed in CI.

- [ ] **Step 4: Run complete verification**

Run: `rtk pytest -q`

Expected: all backend tests PASS.

Run: `rtk proxy npm.cmd --prefix web test`

Expected: all frontend tests PASS.

Run: `rtk proxy npm.cmd --prefix web run build`

Expected: production frontend build exits with code 0.

- [ ] **Step 5: Commit deployment documentation**

```bash
git add .env.example README.md tests/test_google_auth.py tests/test_steam_auth.py
git commit -m "docs: add Railway social sign-in setup"
```

## Final acceptance checklist

- [ ] Google first sign-in creates a passwordless user and returns a JWT.
- [ ] Google sign-in with a matching verified email reuses that user and records one Google identity.
- [ ] Google and Steam `state` values and exchange codes cannot be replayed.
- [ ] Steam first sign-in creates only one Steam-only account; later Steam sign-ins return it.
- [ ] Existing users can attach Steam only while authenticated; duplicate Steam linkage remains rejected.
- [ ] Failed/cancelled callback states expose a retry path and never store a token.
- [ ] Railway/Google/Steam configuration is documented with exact callback URLs and no secrets.

