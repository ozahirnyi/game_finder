import json
import os
from dotenv import load_dotenv
from fastapi import HTTPException
from openai import OpenAI
from openai import (APIConnectionError,RateLimitError)
from app.schemas import RecommendationResponse

load_dotenv()


def get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    return OpenAI(api_key=api_key)


def parse_ai_response(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise ValueError("AI returned invalid JSON")


def build_prompt(prompt: str, liked_game_ids: list[str]) -> str:
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


def get_recommendation(prompt: str, liked_game_ids: list[str]) -> dict:
    client = get_client()
    if not prompt or not prompt.strip():
        raise ValueError("Prompt cannot be empty")
    prompt_text = build_prompt(prompt, liked_game_ids)
    try:
        response = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt_text,
            timeout=15,)
        raw = response.output_text
        data = parse_ai_response(raw)
        validated = RecommendationResponse(**data)
        return validated.model_dump()
    except RateLimitError:
        raise HTTPException(status_code=503,detail="AI service busy")
    except APIConnectionError:
        raise HTTPException(status_code=503,detail="Service Unavailable")
    except Exception:
        raise HTTPException(status_code=502,detail="Bad Gateway")
