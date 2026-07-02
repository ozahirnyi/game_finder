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
docker compose up --build
```
This starts:

- FastAPI app
- PostgreSQL
- Redis

---

## Running API + Web

Start the API stack first:

```bash
docker compose up --build
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
DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/gamefinder
REDIS_URL=redis://redis:6379/0
RAWG_API_KEY=your-rawg-key
RAWG_TIMEOUT_SECONDS=12
OPENAI_API_KEY=your-openai-key
OPENAI_TIMEOUT_SECONDS=8
SECRET_KEY=your-secret-key
```

On Railway, set `FRONTEND_ORIGINS` to the comma-separated list of frontend URLs that should be allowed by CORS. For example:

```bash
FRONTEND_ORIGINS=http://localhost:3000,https://your-gamefinder-frontend.railway.app
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
| RAWG_API_KEY | Game API key |
| OPENAI_API_KEY | AI provider key |
| SECRET_KEY | JWT signing key |

---

## Deployment

The backend is deployed and accessible at:

https://game-finder.up.railway.app

### API Docs:
https://game-finder.up.railway.app/docs

---

## Smoke Tests

- GET `/health`
- GET `/docs`
- GET `/search/games?q=witcher`
- POST `/recommendations`

---

## API security notes

Protected `/games` endpoints require a Bearer JWT token.

Access to another user's game returns `404 Not Found`
instead of `403 Forbidden` to avoid leaking resource existence.

---

## License

Add a `LICENSE` before publishing to GitHub if you want this to be clearly open source.
