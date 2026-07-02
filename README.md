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

Until the repo contains app code, **Phase 1** can live as `scripts/rawg_cli.py`; then add `app/` and Compose.

---

## API security notes

Protected `/games` endpoints require a Bearer JWT token.

Access to another user's game returns `404 Not Found`
instead of `403 Forbidden` to avoid leaking resource existence.

---

## License

Add a `LICENSE` before publishing to GitHub if you want this to be clearly open source.
