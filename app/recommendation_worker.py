"""OpenAI-backed work kept outside the PSN background-job path."""

from app.openai_client import get_recommendation


def execute_recommendation(prompt: str, liked_game_ids: list[int]) -> dict:
    return get_recommendation(prompt, liked_game_ids)
