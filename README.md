# Game Finder

A learning **full-stack** project: **game search**, user collections, external API integration, authentication, caching, and (later) AI-powered recommendations. The backend is written **by hand in FastAPI**; the frontend can be scaffolded with AI assistance (e.g. Next.js).

It is conceptually similar to **movie_finder** (Django + PostgreSQL + external APIs), but this stack is **FastAPI + PostgreSQL + Redis** and the domain is **video games** (e.g. [RAWG API](https://rawg.io/apidocs)).

---

## Why this repository

This is the natural next step after **progression_bot** (Telegram bot, JSON storage, clean layering): here you add a **web API**, **database**, **users**, **caching**, and **third-party services** — the kind of work expected from a junior backend developer.

The project grows **incrementally** in a single repo (not a chain of throwaway exercises).

---

## What we want to build (target product)

| Area | Deliverable |
|------|-------------|
| **API** | REST with FastAPI, Pydantic validation, OpenAPI `/docs` |
| **Data** | PostgreSQL, SQLAlchemy, Alembic migrations |
| **Users** | Register / login, password hashing, JWT, protected mutations |
| **Search** | Calls to RAWG (or similar), normalized JSON for clients |
| **Cache** | Redis with TTL for repeated searches |
| **Product** | Catalog / collections (favorites, wishlist) — API shape is yours |
| **AI (later)** | Recommendation endpoint via OpenAI (or compatible API) |
| **Infra** | Docker Compose (app + postgres + redis), deploy to PaaS/VPS |
| **Frontend** | Next.js (AI-assisted): search, game detail, auth, collections |

---

## Development phases (overview)

1. **Standalone CLI script** — `httpx` + RAWG, key in `.env`, error handling.
2. **FastAPI + in-memory** — CRUD for placeholder games, no DB yet.
3. **PostgreSQL** — replace in-memory store + Alembic.
4. **Authentication** — users, JWT, resource ownership.
5. **RAWG + Redis** — external search + cache.
6. **Production-style backend** — AI endpoint, rate limiting, Docker, deploy.
7. **Frontend** — UI on top of your API.
8. **Interview prep** — algorithms, SQL, architecture narrative (track hours in progression_bot if you like).

Detailed specs and checklists live in **ClickUp** (Game Finder Phase 1–7 tasks) or in `progression_bot/scripts/clickup_create_gamefinder_roadmap.py` (phase description text).

---

## AI Endpoint

### POST `/recommendations`

Generates game recommendations using an LLM based on user prompt and preferences.

### Request

```json
{
  "prompt": "I like dark RPG games",
  "liked_game_ids": [1, 2, 3]
}
```

### Response
```json
{
  "recommendations": [
    {
      "title": "Game name",
      "reason": "Why it matches user preferences",
      "tags": ["rpg", "dark", "story"]
    }
  ]
}
```

---

## Rate Limiting

- `/search/games`: 30 requests/min per IP
- `/recommendations`: 5 requests/min per IP

If limit is exceeded → `429 Too Many Requests`

---

## Stack (expected)

- Python 3.11+, FastAPI, Uvicorn  
- PostgreSQL, SQLAlchemy 2, Alembic  
- Redis  
- httpx (async)  
- JWT, passlib/bcrypt  
- Docker / Docker Compose  
- Next.js + TypeScript (frontend)  

---

## Getting started (once you add code here)

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt   # appears after you bootstrap FastAPI
cp .env.example .env
# Fill in: RAWG, DATABASE_URL, REDIS_URL, SECRET_KEY, …
```

---

## Running with Docker

```bash
docker compose up -d db redis
docker compose run --rm app alembic upgrade head
docker compose up --build app
```
This starts:

- FastAPI app
- PostgreSQL
- Redis

To refresh cached Steam contacts locally, run the dedicated worker in another terminal. It is intentionally
separate from the API process:

```bash
docker compose up --build steam-social-refresh-worker
```

---

## Running API + Web

Start the database/cache, run migrations, then start the API:

```bash
docker compose up -d db redis
docker compose run --rm app alembic upgrade head
docker compose up --build app
```

In a second terminal, start the Next.js frontend:

```bash
cd web
npm.cmd install
npm.cmd run dev
```

The web app runs at `http://localhost:3000` and calls the API URL from `web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For a deployed frontend, point it at the Railway backend after the latest API deploy:

```bash
NEXT_PUBLIC_API_URL=https://game-finder.up.railway.app
```

For the API, keep these values in `.env`:

```bash
FRONTEND_ORIGIN=http://localhost:3000
FRONTEND_ORIGINS=http://localhost:3000,https://your-frontend-domain.example
FRONTEND_PUBLIC_URL=http://localhost:3000
BACKEND_PUBLIC_URL=http://localhost:8000
DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/gamefinder
REDIS_URL=redis://redis:6379/0
RAWG_API_KEY=your-rawg-key
RAWG_TIMEOUT_SECONDS=12
STEAM_API_KEY=your-steam-web-api-key
ITAD_API_KEY=your-isthereanydeal-api-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_WEBHOOK_SECRET=random-webhook-secret
PRICE_ALERT_WATCHER_ENABLED=false
PRICE_ALERT_INTERVAL_SECONDS=86400
PRICE_ALERT_INITIAL_DELAY_SECONDS=60
PRICE_ALERT_MIN_CUT=1
STEAM_SOCIAL_REFRESH_STALE_MINUTES=60
STEAM_SOCIAL_REFRESH_BATCH_SIZE=25
STEAM_SOCIAL_REFRESH_INTERVAL_SECONDS=300
OPENAI_API_KEY=your-openai-key
OPENAI_TIMEOUT_SECONDS=8
AI_FALLBACK_ENABLED=true
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

On Railway, set `FRONTEND_ORIGINS` to the comma-separated list of frontend URLs that should be allowed by CORS. For example:

```bash
FRONTEND_ORIGINS=http://localhost:3000,https://your-gamefinder-frontend.railway.app
FRONTEND_PUBLIC_URL=https://your-gamefinder-frontend.railway.app
BACKEND_PUBLIC_URL=https://your-gamefinder-api.railway.app
```

Set `AI_FALLBACK_ENABLED=false` in production if you want `/recommendations` to fail visibly with `503` when OpenAI is unavailable instead of returning local fallback recommendations.

### Steam social refresh worker

Deploy Steam contact refresh as a second Railway service from the same repository and Dockerfile. Set its
start command to:

```bash
sh -c 'while true; do python -m scripts.run_steam_social_refresh; sleep "${STEAM_SOCIAL_REFRESH_INTERVAL_SECONDS:-300}"; done'
```

Configure exactly one replica for this worker, give it the same `DATABASE_URL` and `STEAM_API_KEY` as the API,
and set `STEAM_SOCIAL_REFRESH_STALE_MINUTES`, `STEAM_SOCIAL_REFRESH_BATCH_SIZE`, and
`STEAM_SOCIAL_REFRESH_INTERVAL_SECONDS`. Do not add this command to the API service: the API serves requests
only, while the worker polls stale or missing snapshots independently.

Steam linking uses Steam OpenID for account linking and `STEAM_API_KEY` for library import. A linked Steam account only exposes owned games when the user's Steam game details are public.

Price history uses the IsThereAnyDeal API. Create an app at `https://isthereanydeal.com/dev/app/` and set `ITAD_API_KEY` on the backend service.

Telegram alerts MVP uses a Telegram bot. Create a bot with BotFather, set `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, and `TELEGRAM_WEBHOOK_SECRET`, then point Telegram at:

```bash
https://your-gamefinder-api.railway.app/telegram/webhook/your-webhook-secret
```

The profile page can then open `https://t.me/<bot>?start=<link-token>`. After the user presses Start,
the backend stores the Telegram chat and can send test alerts plus saved-game confirmation messages.

Daily price alerts use the saved games table, Telegram, and IsThereAnyDeal. Set
`PRICE_ALERT_WATCHER_ENABLED=true` on the backend service to run the watcher inside the API process.
It checks linked Telegram users every `PRICE_ALERT_INTERVAL_SECONDS` seconds, uses the user's Steam
country code when available, and sends a Telegram message only when the current discount is different
from the last alert stored for that saved game.

You can also run one manual pass:

```bash
python -m scripts.run_price_alerts
```

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by the execution policy. If you prefer pnpm later, enable it with Corepack and run the equivalent install/dev commands inside `web/`.

---

## Services

| Service | Description |
|---------|-------------|
| app | FastAPI backend |
| db | PostgreSQL |
| redis | cache layer |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| REDIS_URL | Redis connection |
| FRONTEND_PUBLIC_URL | Public frontend URL used after Steam OpenID callback |
| BACKEND_PUBLIC_URL | Public API URL used to build Steam OpenID callback URLs |
| GOOGLE_CLIENT_ID | Google OAuth web-client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth web-client secret |
| GOOGLE_REDIRECT_URI | Exact Google OAuth callback URL, usually `<BACKEND_PUBLIC_URL>/auth/google/callback` |
| RAWG_API_KEY | Game API key |
| STEAM_API_KEY | Steam Web API key for owned-game library import |
| ITAD_API_KEY | IsThereAnyDeal API key for current prices and historical lows |
| TELEGRAM_BOT_TOKEN | Telegram bot token from BotFather |
| TELEGRAM_BOT_USERNAME | Telegram bot username without `@` |
| TELEGRAM_WEBHOOK_SECRET | Secret path segment used by the Telegram webhook URL |
| PRICE_ALERT_WATCHER_ENABLED | Enables the daily Telegram price watcher when `true` |
| PRICE_ALERT_INTERVAL_SECONDS | Seconds between watcher runs, defaults to `86400` |
| PRICE_ALERT_INITIAL_DELAY_SECONDS | Delay before the first watcher run after backend startup |
| PRICE_ALERT_MIN_CUT | Minimum discount percentage required before sending a Telegram alert |
| STEAM_SOCIAL_REFRESH_STALE_MINUTES | Age in minutes after which a Steam contact snapshot is refreshed |
| STEAM_SOCIAL_REFRESH_BATCH_SIZE | Maximum stale or missing Steam snapshots refreshed per worker pass |
| STEAM_SOCIAL_REFRESH_INTERVAL_SECONDS | Seconds the dedicated worker waits between refresh passes |
| OPENAI_API_KEY | AI provider key |
| SECRET_KEY | JWT signing key |
| ACCESS_TOKEN_EXPIRE_MINUTES | JWT lifetime in minutes, defaults to 10080 (7 days) |

---

## Railway deployment

This repository is prepared for Railway but is not deployed by this repository or these instructions.

Create two public services (Backend and Frontend) and one private worker service, plus Railway PostgreSQL and Redis.

### 1. Backend service

Create a service from the repository root using the root `Dockerfile`.
In **Settings → Deploy**, set **Pre-Deploy Command** to exactly:

```bash
python -m alembic upgrade head
```

Set **Healthcheck Path** to `/health`. Keep the Dockerfile start command unchanged; it listens on Railway's `PORT`.
The pre-deploy command belongs **only** to Backend. Do not copy it to Frontend or the worker.

Give Backend the secrets and configuration from `.env.example`, with Railway service connection values for
`DATABASE_URL` and `REDIS_URL`. Set these production URLs after generating domains:

```bash
FRONTEND_ORIGIN=https://your-gamefinder-frontend.up.railway.app
FRONTEND_ORIGINS=https://your-gamefinder-frontend.up.railway.app
FRONTEND_PUBLIC_URL=https://your-gamefinder-frontend.up.railway.app
BACKEND_PUBLIC_URL=https://your-gamefinder-backend.up.railway.app
GOOGLE_REDIRECT_URI=https://your-gamefinder-backend.up.railway.app/auth/google/callback
AI_FALLBACK_ENABLED=false
```

`RAILWAY_PUBLIC_DOMAIN` is injected by Railway; do not set it manually. Keep secrets private service variables.

### 2. Frontend service

Create another service from the same repository. Set `RAILWAY_DOCKERFILE_PATH=web/Dockerfile` and:

```bash
NEXT_PUBLIC_API_URL=https://your-gamefinder-backend.up.railway.app
```

The frontend Dockerfile declares this value with `ARG` before `npm run build`, so Next.js embeds the backend URL.
Redeploy Frontend whenever the API URL changes. Set its healthcheck path to `/`; configure no pre-deploy command.

### 3. Steam social refresh worker

Create a third service from the repository root using the root `Dockerfile`. Set its **Start Command** to exactly:

```bash
sh -c 'while true; do python -m scripts.run_steam_social_refresh; sleep "${STEAM_SOCIAL_REFRESH_INTERVAL_SECONDS:-300}"; done'
```

Set this worker to **one replica**. It needs the same SECRET_KEY as the Backend because the
Steam integration imports the JWT configuration, plus `DATABASE_URL`, `STEAM_API_KEY`,
`STEAM_SOCIAL_REFRESH_STALE_MINUTES`, `STEAM_SOCIAL_REFRESH_BATCH_SIZE`, and
`STEAM_SOCIAL_REFRESH_INTERVAL_SECONDS`. It needs no public domain or healthcheck. Do not configure a pre-deploy
command on the worker.

### Release verification

After the Backend deployment reports a successful pre-deploy phase, verify the migration revision:

```bash
railway run --service Backend python -m alembic current
railway run --service Backend python -m alembic heads
```

The current revision must match the sole head revision. Then confirm `/health` returns HTTP 200, the frontend loads
the Friends hub, and worker logs show refresh passes from exactly one replica.

---

## Smoke Tests

- GET `/health`
- GET `/docs`
- GET `/search/games?q=witcher`
- GET `/catalog/upcoming-games`
- POST `/recommendations`

---

## API security notes

Protected `/games` endpoints require a Bearer JWT token.

Access to another user's game returns `404 Not Found`
instead of `403 Forbidden` to avoid leaking resource existence.

---

## License

Add a `LICENSE` before publishing to GitHub if you want this to be clearly open source.
