import asyncio
import json
import logging
import uuid

import redis.asyncio as aioredis

from app.database import settings
from app.websocket import manager

logger = logging.getLogger(__name__)

# Channel names
CHANNEL_BROADCAST = "ws:broadcast"
CHANNEL_TEAM_PREFIX = "ws:team:"


async def publish_broadcast(message: dict):
    """Publish a message to all WebSocket clients via Redis.
    Call this from Celery workers instead of importing the ConnectionManager."""
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        await r.publish(CHANNEL_BROADCAST, json.dumps(message))
    finally:
        await r.aclose()


async def publish_to_team(team_id: uuid.UUID, message: dict):
    """Publish a message to a specific team's WebSocket clients via Redis."""
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        await r.publish(f"{CHANNEL_TEAM_PREFIX}{team_id}", json.dumps(message))
    finally:
        await r.aclose()


def publish_broadcast_sync(message: dict):
    """Synchronous version for use in Celery tasks (sync context)."""
    import redis

    r = redis.from_url(settings.REDIS_URL)
    try:
        r.publish(CHANNEL_BROADCAST, json.dumps(message))
    finally:
        r.close()


def publish_to_team_sync(team_id: uuid.UUID, message: dict):
    """Synchronous version for use in Celery tasks (sync context)."""
    import redis

    r = redis.from_url(settings.REDIS_URL)
    try:
        r.publish(f"{CHANNEL_TEAM_PREFIX}{team_id}", json.dumps(message))
    finally:
        r.close()


async def start_redis_relay():
    """Subscribe to Redis channels and relay messages to WebSocket clients.
    Run this as a background task in the FastAPI lifespan."""
    r = aioredis.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()

    await pubsub.subscribe(CHANNEL_BROADCAST)
    await pubsub.psubscribe(f"{CHANNEL_TEAM_PREFIX}*")

    logger.info("Redis pub/sub relay started")

    try:
        async for message in pubsub.listen():
            try:
                if message["type"] == "message":
                    channel = message["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode()
                    data = json.loads(message["data"])

                    if channel == CHANNEL_BROADCAST:
                        await manager.broadcast(data)

                elif message["type"] == "pmessage":
                    channel = message["channel"]
                    if isinstance(channel, bytes):
                        channel = channel.decode()
                    data = json.loads(message["data"])

                    if channel.startswith(CHANNEL_TEAM_PREFIX):
                        team_id_str = channel[len(CHANNEL_TEAM_PREFIX) :]
                        try:
                            team_id = uuid.UUID(team_id_str)
                            await manager.send_to_team(team_id, data)
                        except ValueError:
                            logger.warning(f"Invalid team_id in channel: {team_id_str}")

            except Exception as e:
                logger.error(f"Error processing Redis message: {e}")
    except asyncio.CancelledError:
        logger.info("Redis pub/sub relay shutting down")
    finally:
        await pubsub.unsubscribe()
        await pubsub.punsubscribe()
        await r.aclose()
