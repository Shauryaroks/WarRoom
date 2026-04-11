import asyncio
import json
from typing import Dict, Set
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis


class ConnectionManager:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis: aioredis.Redis = None
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "market": set(),
        }
        self.team_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, team_id: str = None):
        await websocket.accept()

        async with self._lock:
            if team_id:
                if team_id not in self.team_connections:
                    self.team_connections[team_id] = set()
                self.team_connections[team_id].add(websocket)
            else:
                self.active_connections["market"].add(websocket)

    async def disconnect(self, websocket: WebSocket, team_id: str = None):
        async with self._lock:
            if team_id and team_id in self.team_connections:
                self.team_connections[team_id].discard(websocket)
                if not self.team_connections[team_id]:
                    del self.team_connections[team_id]
            else:
                self.active_connections["market"].discard(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception:
            pass

    async def send_to_team(self, team_id: str, message: dict):
        async with self._lock:
            if team_id in self.team_connections:
                disconnected = set()
                for connection in self.team_connections[team_id]:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        disconnected.add(connection)
                for ws in disconnected:
                    self.team_connections[team_id].discard(ws)

    async def broadcast_to_market(self, message: dict):
        async with self._lock:
            disconnected = set()
            for connection in self.active_connections["market"]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            for ws in disconnected:
                self.active_connections["market"].discard(ws)

    async def broadcast_price_update(
        self, ticker: str, price: float, change_percent: float = None
    ):
        message = {
            "type": "price_update",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "ticker": ticker,
                "price": price,
                "change_percent": change_percent,
            },
        }
        await self.broadcast_to_market(message)

    async def broadcast_news(
        self, headline: str, ticker: str = None, is_global: bool = False
    ):
        message = {
            "type": "news",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "headline": headline,
                "ticker": ticker,
                "is_global": is_global,
            },
        }
        await self.broadcast_to_market(message)

    async def broadcast_purge(self, eliminated_tickers: list, remaining_count: int):
        message = {
            "type": "purge_complete",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "eliminated_tickers": eliminated_tickers,
                "remaining_count": remaining_count,
                "message": f"Market Purge Complete. {remaining_count} teams remain.",
            },
        }
        await self.broadcast_to_market(message)

    async def broadcast_bankruptcy(self, ticker: str, message: str):
        ws_message = {
            "type": "bankruptcy_alert",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "ticker": ticker,
                "message": message,
                "severity": "CRITICAL",
            },
        }

        async with self._lock:
            if ticker in self.team_connections:
                for connection in self.team_connections[ticker]:
                    try:
                        await connection.send_json(ws_message)
                    except Exception:
                        pass

        market_message = {
            "type": "system_event",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "event_type": "BANKRUPTCY_DECLARATION",
                "message": message,
                "affected_ticker": ticker,
            },
        }
        await self.broadcast_to_market(market_message)


manager = ConnectionManager()


async def handle_websocket(websocket: WebSocket, team_id: str = None):
    await manager.connect(websocket, team_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await manager.send_personal_message(
                    {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    websocket,
                )
            elif message.get("type") == "subscribe":
                channel = message.get("channel")
                if channel:
                    await manager.connect(websocket, channel.replace("team:", ""))

    except WebSocketDisconnect:
        await manager.disconnect(websocket, team_id)
    except Exception:
        await manager.disconnect(websocket, team_id)
