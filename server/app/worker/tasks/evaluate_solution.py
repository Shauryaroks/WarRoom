"""Celery task for async LLM evaluation of solutions.

Per EVAL-01: Dispatches async LLM evaluation with structured output.
Per T-05-03: time_limit=120 (overrides global 60s) to allow for LLM latency.
Follows game_tick.py pattern: asyncio.run + deferred imports for worker context.
"""

import asyncio
import logging
import uuid

from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="solution.evaluate",
    time_limit=120,  # LLM calls can take 30-60s (override global 60s)
    soft_time_limit=100,
    max_retries=2,
    default_retry_delay=10,
)
def evaluate_solution(solution_id: str):
    """Evaluate a solution via OpenRouter LLM. Per EVAL-01."""
    asyncio.run(_evaluate(solution_id))


async def _evaluate(solution_id: str):
    """Execute LLM evaluation: build prompt -> call OpenRouter -> save result.

    On success: saves evaluation as PENDING_APPROVAL, broadcasts to admin.
    On failure: creates FAILED evaluation record, notifies team, re-raises for retry.
    Per RESEARCH anti-patterns: publish Redis AFTER db.commit().
    """
    from app.database import get_worker_session
    from app.models import Evaluation, EvaluationStatus, Solution
    from app.redis_pubsub import publish_broadcast_sync, publish_to_team_sync
    from app.services.evaluation_service import build_prompt, save_evaluation
    from app.services.llm_service import call_openrouter

    sid = uuid.UUID(solution_id)

    async with get_worker_session() as db:
        try:
            prompt = await build_prompt(db, sid)
            llm_output, metadata = await call_openrouter(prompt)
            evaluation = await save_evaluation(db, sid, llm_output, metadata)
            await db.commit()

            # Notify admin after commit (per RESEARCH anti-patterns)
            publish_broadcast_sync(
                {
                    "type": "evaluation_pending",
                    "payload": {
                        "evaluation_id": str(evaluation.id),
                        "team_id": str(evaluation.team_id),
                    },
                }
            )
            logger.info(
                "Evaluation created for solution %s (eval %s)",
                solution_id,
                evaluation.id,
            )

        except Exception as e:
            logger.error("Evaluation failed for solution %s: %s", solution_id, e)
            await db.rollback()

            # Mark evaluation as FAILED if solution exists
            try:
                async with get_worker_session() as fail_db:
                    from sqlalchemy import select

                    result = await fail_db.execute(
                        select(Solution).where(Solution.id == sid)
                    )
                    solution = result.scalar_one_or_none()
                    if solution:
                        eval_obj = Evaluation(
                            solution_id=solution.id,
                            team_id=solution.team_id,
                            status=EvaluationStatus.FAILED,
                            raw_response=str(e)[:5000],  # Truncate for safety
                        )
                        fail_db.add(eval_obj)
                        await fail_db.commit()

                        publish_to_team_sync(
                            solution.team_id,
                            {
                                "type": "evaluation_failed",
                                "payload": {"solution_id": solution_id},
                            },
                        )
            except Exception as inner_e:
                logger.error(
                    "Failed to record FAILED evaluation for solution %s: %s",
                    solution_id,
                    inner_e,
                )

            raise  # Let Celery retry
