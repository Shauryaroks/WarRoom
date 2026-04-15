---
phase: 01-foundation-auth-and-base-ui
plan: 05
subsystem: websocket-infrastructure
tags: [websocket, redis, pubsub, real-time, connection-manager]
dependency_graph:
  requires: [01-01, 01-03]
  provides: [websocket-endpoint, redis-pubsub-relay, connection-manager]
  affects: [server/app/main.py, server/app/websocket.py, server/app/redis_pubsub.py]
tech_stack:
  added: [redis.asyncio]
  patterns: [redis-pubsub-relay, connection-manager-singleton, jwt-websocket-auth, ping-pong-heartbeat]
key_files:
  created:
    - server/app/redis_pubsub.py
  modified:
    - server/app/websocket.py
    - server/app/main.py
    - server/pyproject.toml
decisions:
  - "Rewrote ConnectionManager from scratch, removing old api_key-based auth and burst_sync logic (Phase 2/3 concern)"
  - "Used asyncio.gather for concurrent WebSocket sends instead of sequential loop"
  - "Fixed redis dependency constraint to >=5.2.0,<6.5 for kombu/celery compatibility"
  - "Constrained requires-python to >=3.11,<3.14 to avoid dependency resolution failures on Python 3.14"
metrics:
  duration: 197s
  completed: 2026-04-15T23:22:18Z
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 1 Plan 5: WebSocket Infrastructure Summary

**WebSocket ConnectionManager with Redis pub/sub relay for Celery-to-client real-time messaging**

## What Was Built

### Task 1: ConnectionManager and Redis pub/sub relay (8d5daa6)
- Rewrote `server/app/websocket.py` with a clean ConnectionManager supporting broadcast and per-team messaging via `uuid.UUID` team IDs
- Concurrent sends via `asyncio.gather` with dead connection cleanup
- Created `server/app/redis_pubsub.py` with:
  - `start_redis_relay()` -- async background task subscribing to `ws:broadcast` and `ws:team:*` channels, forwarding to ConnectionManager
  - `publish_broadcast` / `publish_to_team` -- async Redis publish helpers
  - `publish_broadcast_sync` / `publish_to_team_sync` -- sync helpers for Celery workers (fixes Anti-Pattern 1: workers no longer import the ConnectionManager singleton)

### Task 2: WebSocket endpoint and lifespan wiring (8122293)
- Mounted `/ws` endpoint with JWT authentication handshake (first message must be `{"type": "auth", "token": "..."}` within 10 seconds)
- Close codes: 4001 (auth timeout), 4002 (bad message format), 4003 (invalid token)
- Ping/pong heartbeat every 30 seconds to survive Caddy proxy timeouts
- Redis relay started as `asyncio.create_task` in FastAPI lifespan, cancelled on shutdown
- Health endpoint now includes `ws_connections` count

## End-to-End Pipeline

```
Celery worker -> publish_broadcast_sync() -> Redis "ws:broadcast" channel
                                                    |
FastAPI process <- start_redis_relay() subscribes <-+
                                                    |
                         manager.broadcast() -------+-> All WebSocket clients
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed redis dependency constraint**
- **Found during:** Task 1 (dependency installation)
- **Issue:** `redis>=7.1.1` in pyproject.toml is incompatible with `kombu[redis]` which requires `redis<6.5`. This prevented `uv sync` from resolving.
- **Fix:** Changed constraint to `redis>=5.2.0,<6.5` and added `requires-python = ">=3.11,<3.14"` to avoid Python 3.14 marker resolution failures.
- **Files modified:** server/pyproject.toml
- **Commit:** 8d5daa6

## Self-Check: PASSED
