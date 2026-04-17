"""Celery task modules. Imported here so autodiscover picks them up on worker boot."""

from app.worker.tasks import evaluate_solution, game_tick, generate_news

__all__ = ["evaluate_solution", "game_tick", "generate_news"]
