import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Set, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


def _json_default(obj):
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


class ConnectionManager:
    """Manages WebSocket connections. Supports broadcast and per-team messaging."""

    def __init__(self):
        # All authenticated connections
        self._connections: Set[WebSocket] = set()
        # Team-specific connections: team_id -> set of WebSocket
        self._team_connections: Dict[uuid.UUID, Set[WebSocket]] = {}
        # Connection metadata: ws -> {"team_id": uuid, "role": str}
        self._metadata: Dict[WebSocket, dict] = {}

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    def add(self, ws: WebSocket, team_id: Optional[uuid.UUID], role: str):
        self._connections.add(ws)
        self._metadata[ws] = {"team_id": team_id, "role": role}
        if team_id:
            if team_id not in self._team_connections:
                self._team_connections[team_id] = set()
            self._team_connections[team_id].add(ws)
        logger.info(
            "WS connected: role=%s, team=%s, total=%d",
            role, team_id, self.connection_count,
        )

    def remove(self, ws: WebSocket):
        meta = self._metadata.pop(ws, {})
        self._connections.discard(ws)
        team_id = meta.get("team_id")
        if team_id and team_id in self._team_connections:
            self._team_connections[team_id].discard(ws)
            if not self._team_connections[team_id]:
                del self._team_connections[team_id]
        logger.info(
            "WS disconnected: role=%s, total=%d",
            meta.get("role"), self.connection_count,
        )

    async def broadcast(self, message: dict):
        """Send message to ALL connected clients."""
        data = json.dumps(message, default=_json_default)
        await self._send_to_set(self._connections, data)

    async def send_to_team(self, team_id: uuid.UUID, message: dict):
        """Send message to all connections for a specific team."""
        connections = self._team_connections.get(team_id, set())
        if connections:
            data = json.dumps(message, default=_json_default)
            await self._send_to_set(connections, data)

    async def _send_to_set(self, connections: Set[WebSocket], data: str):
        """Send data to a set of connections, removing dead ones."""
        dead: list[WebSocket] = []
        tasks = []
        for ws in connections:
            tasks.append(self._safe_send(ws, data, dead))
        if tasks:
            await asyncio.gather(*tasks)
        for ws in dead:
            self.remove(ws)

    async def _safe_send(self, ws: WebSocket, data: str, dead: list):
        try:
            await ws.send_text(data)
        except Exception:
            dead.append(ws)


# Module-level singleton -- used by the API process only
manager = ConnectionManager()
