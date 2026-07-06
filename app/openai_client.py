import json
import os
from dotenv import load_dotenv
from fastapi import HTTPException
from openai import OpenAI
from openai import APIConnectionError, APIStatusError, APITimeoutError, AuthenticationError, PermissionDeniedError, RateLimitError
from app.cache import logger
from app.schemas import RecommendationResponse

load_dotenv()


def fallback_enabled() -> bool:
    return os.getenv("AI_FALLBACK_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}


def fallback_or_raise(prompt: str, reason: str) -> dict:
    if fallback_enabled():
        logger.warning("%s; using fallback recommendations", reason)
        return fallback_recommendations(prompt)
    raise HTTPException(status_code=503, detail=reason)


def openai_config_error(reason: str) -> HTTPException:
    return HTTPException(status_code=503, detail=reason)


def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    return OpenAI(api_key=api_key, max_retries=0)


def parse_ai_response(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise ValueError("AI returned invalid JSON")


def build_prompt(prompt: str, liked_game_ids: list[int]) -> str:
    liked = ", ".join(map(str, liked_game_ids)) if liked_game_ids else "none"
    return f"""
    You are a game recommendation system.
    OUTPUT RULES:
    - Return ONLY valid JSON
    - No markdown
    - No comments
    - No extra text
    - Must be machine-parseable
    SCHEMA:
    {{
      "recommendations": [
        {{
          "title": "string",
          "reason": "string",
          "tags": ["string"]
        }}
      ]
    }}
    CONSTRAINTS:
    - Exactly 3 recommendations
    - Use liked games as preference signal
    - If no liked games, rely only on request
    LIKED GAMES:
    {liked}
    USER REQUEST:
    {prompt}
    """.strip()


def fallback_recommendations(prompt: str) -> dict:
    normalized = prompt.lower()
    catalog = [
        {
            "title": "Disco Elysium",
            "reason": "A dialogue-heavy RPG with meaningful choices, a bleak mood, and strong writing.",
            "tags": ["rpg", "choices", "story"],
        },
        {
            "title": "Hades",
            "reason": "A fast roguelike with polished combat, memorable characters, and short repeatable runs.",
            "tags": ["roguelike", "action", "mythology"],
        },
        {
            "title": "Stardew Valley",
            "reason": "A relaxed farming game with cozy routines, light progression, and a warm community feel.",
            "tags": ["cozy", "farming", "relaxing"],
        },
        {
            "title": "Cyberpunk 2077",
            "reason": "A large neon RPG for players who want futuristic cities, quests, and character builds.",
            "tags": ["cyberpunk", "open world", "rpg"],
        },
        {
            "title": "Outer Wilds",
            "reason": "A smart exploration mystery built around curiosity, discovery, and atmosphere.",
            "tags": ["mystery", "exploration", "space"],
        },
        {
            "title": "XCOM 2",
            "reason": "A tense tactical strategy game with squad decisions and high-stakes missions.",
            "tags": ["strategy", "tactics", "sci-fi"],
        },
    ]
    keywords = {
        "cozy": ["Stardew Valley", "Outer Wilds", "Hades"],
        "farm": ["Stardew Valley", "Outer Wilds", "Disco Elysium"],
        "dark": ["Disco Elysium", "Cyberpunk 2077", "Hades"],
        "choice": ["Disco Elysium", "Cyberpunk 2077", "Outer Wilds"],
        "rpg": ["Disco Elysium", "Cyberpunk 2077", "Hades"],
        "strategy": ["XCOM 2", "Outer Wilds", "Disco Elysium"],
        "mystery": ["Outer Wilds", "Disco Elysium", "Cyberpunk 2077"],
        "space": ["Outer Wilds", "XCOM 2", "Cyberpunk 2077"],
        "action": ["Hades", "Cyberpunk 2077", "XCOM 2"],
    }
    selected_titles: list[str] = []
    for keyword, titles in keywords.items():
        if keyword in normalized:
            selected_titles.extend(titles)
    if not selected_titles:
        selected_titles = ["Hades", "Disco Elysium", "Outer Wilds"]

    seen = set()
    selected = []
    for title in selected_titles:
        if title in seen:
            continue
        match = next(item for item in catalog if item["title"] == title)
        selected.append(match)
        seen.add(title)
        if len(selected) == 3:
            break
    return {"recommendations": selected}


def get_recommendation(prompt: str, liked_game_ids: list[int]) -> dict:
    if not prompt or not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")
    try:
        client = get_client()
    except Exception as e:
        logger.exception(e)
        raise openai_config_error("OpenAI client is not configured")
    prompt_text = build_prompt(prompt, liked_game_ids)
    try:
        timeout = float(os.getenv("OPENAI_TIMEOUT_SECONDS") or "8")
    except ValueError as e:
        raise openai_config_error("OPENAI_TIMEOUT_SECONDS must be a number") from e
    try:
        response = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt_text,
            timeout=timeout,)
        raw = response.output_text
        data = parse_ai_response(raw)
        validated = RecommendationResponse(**data)
        return validated.model_dump()
    except RateLimitError:
        return fallback_or_raise(prompt, "OpenAI rate limit reached")
    except (APIConnectionError, APITimeoutError):
        return fallback_or_raise(prompt, "OpenAI connection failed")
    except (AuthenticationError, PermissionDeniedError) as e:
        logger.exception(e)
        raise HTTPException(status_code=503, detail="OpenAI authentication or permission failed")
    except APIStatusError as e:
        logger.exception(e)
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {e.status_code}")
    except (ValueError, KeyError):
        return fallback_or_raise(prompt, "OpenAI response was invalid")
    except Exception as e:
        logger.exception(e)
        raise HTTPException(status_code=500, detail="OpenAI recommendations failed")
