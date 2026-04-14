import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from itertools import count
from typing import Dict, Set

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select, and_

from app.database import AsyncSessionLocal
from app.models import (
    Directive,
    GameState,
    MarketNews,
    PriceHistory,
    StockHolding,
    Team,
    TeamStatus,
)

logger = logging.getLogger(__name__)


def _json_default(obj):
    """Handle UUID, Decimal, datetime serialization."""
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _serialize(msg: dict) -> str:
    return json.dumps(msg, default=_json_default)


# ---------------------------------------------------------------------------
# Burst-sync builders
# ---------------------------------------------------------------------------


async def _build_market_burst(db) -> dict:
    """Build market burst_sync payload from database."""
    now = datetime.utcnow()

    # --- news (last 20) ---
    news_stmt = select(MarketNews).order_by(MarketNews.created_at.desc()).limit(20)
    news_result = await db.execute(news_stmt)
    news_items = news_result.scalars().all()

    # Build a map of team_id -> ticker for resolving source_ticker
    team_ids_needed = {n.source_team_id for n in news_items if n.source_team_id}
    ticker_map: Dict[uuid.UUID, str] = {}
    if team_ids_needed:
        ticker_stmt = select(Team.id, Team.ticker).where(Team.id.in_(team_ids_needed))
        ticker_result = await db.execute(ticker_stmt)
        for row in ticker_result:
            ticker_map[row[0]] = row[1]

    news_list = []
    for item in news_items:
        age_minutes = (
            (now - item.created_at).total_seconds() / 60.0 if item.created_at else 0
        )
        source_ticker = (
            ticker_map.get(item.source_team_id) if item.source_team_id else None
        )
        news_list.append(
            {
                "id": str(item.id),
                "headline": item.headline,
                "content": item.content,
                "source_type": item.source_type or "SYSTEM",
                "source_ticker": source_ticker,
                "sentiment_score": float(item.sentiment_score)
                if item.sentiment_score
                else None,
                "affected_sectors": json.loads(item.affected_sectors)
                if item.affected_sectors
                else None,
                "affected_tickers": json.loads(item.affected_tickers)
                if item.affected_tickers
                else None,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "relevance_decay": round(max(0.0, 1.0 - (age_minutes / 20.0)), 4),
            }
        )

    # --- tickers (all active/cooldown/bankrupt teams) ---
    teams_stmt = select(Team).where(
        Team.status.in_([TeamStatus.ACTIVE, TeamStatus.COOLDOWN, TeamStatus.BANKRUPT])
    )
    teams_result = await db.execute(teams_stmt)
    teams = teams_result.scalars().all()

    tickers_list = []
    teams_remaining_count = 0
    for team in teams:
        if team.status in (TeamStatus.ACTIVE, TeamStatus.COOLDOWN):
            teams_remaining_count += 1

        # Compute change from last 2 price history entries
        ph_stmt = (
            select(PriceHistory)
            .where(PriceHistory.team_id == team.id)
            .order_by(PriceHistory.calculated_at.desc())
            .limit(2)
        )
        ph_result = await db.execute(ph_stmt)
        ph_rows = ph_result.scalars().all()

        change_pct = 0.0
        change_abs = 0.0
        if len(ph_rows) >= 2:
            current_price = float(ph_rows[0].price)
            prev_price = float(ph_rows[1].price)
            change_abs = current_price - prev_price
            if prev_price != 0:
                change_pct = (change_abs / prev_price) * 100.0

        tickers_list.append(
            {
                "ticker": team.ticker,
                "price": float(team.stock_price),
                "change_24h": round(change_pct, 4),
                "change_absolute": round(change_abs, 4),
                "volume_24h": team.public_float,
                "market_cap": float(team.shares_outstanding) * float(team.stock_price),
                "status": team.status.value,
            }
        )

    # --- game_state ---
    gs = await db.get(GameState, 1)
    game_state = {}
    if gs:
        game_state = {
            "status": gs.status.value,
            "server_time": datetime.utcnow().isoformat(),
            "started_at": gs.started_at.isoformat() if gs.started_at else None,
            "elapsed_seconds": int((now - gs.started_at).total_seconds())
            if gs.started_at
            else None,
            "next_purge_at": gs.next_purge_at.isoformat() if gs.next_purge_at else None,
            "current_round": gs.current_round,
            "teams_remaining": teams_remaining_count,
            "total_llm_cost_usd": float(gs.total_llm_cost or 0),
            "llm_queue_depth": gs.llm_queue_depth or 0,
        }

    return {
        "news": news_list,
        "tickers": tickers_list,
        "game_state": game_state,
    }


async def _build_team_dossier(db, team: "Team") -> dict:
    """Build team dossier dict (mirrors GET /teams/me logic)."""
    now = datetime.utcnow()
    market_cap = float(team.stock_price * team.shares_outstanding)

    # Holdings
    portfolio_stmt = select(StockHolding).where(
        and_(
            StockHolding.owner_team_id == team.id,
            StockHolding.shares_owned > 0,
        )
    )
    portfolio_result = await db.execute(portfolio_stmt)
    holdings = portfolio_result.scalars().all()

    holdings_list = []
    total_portfolio_value = 0.0
    total_cost_basis = 0.0

    for h in holdings:
        target = await db.get(Team, h.target_team_id)
        if not target:
            continue
        current_value = float(h.shares_owned * target.stock_price)
        ownership_pct = (
            (h.shares_owned / target.shares_outstanding) * 100
            if target.shares_outstanding
            else 0
        )
        cost_basis = float(h.total_cost_basis or 0)

        holdings_list.append(
            {
                "ticker": target.ticker,
                "shares": h.shares_owned,
                "current_price": float(target.stock_price),
                "current_value": current_value,
                "cost_basis": cost_basis,
                "unrealized_pnl": current_value - cost_basis,
                "ownership_percentage": float(ownership_pct),
            }
        )
        total_portfolio_value += current_value
        total_cost_basis += cost_basis

    liquidity = float(team.cash) + (total_portfolio_value * 0.5)
    treasury_limit = team.dilution_cap_percent

    profile = {
        "team_id": str(team.id),
        "name": team.name,
        "ticker": team.ticker,
        "status": team.status.value,
        "swot": {
            "strengths": team.swot_strengths or "",
            "weaknesses": team.swot_weaknesses or "",
            "opportunities": team.swot_opportunities or "",
            "threats": team.swot_threats or "",
        },
        "portfolio_id": team.portfolio_type,
    }

    financials = {
        "cash": float(team.cash),
        "stock_price": float(team.stock_price),
        "market_cap": market_cap,
        "liquidity": liquidity,
        "treasury_sale_limit_remaining": float(treasury_limit),
    }

    portfolio = {
        "holdings": holdings_list,
        "total_portfolio_value": total_portfolio_value,
        "total_unrealized_pnl": total_portfolio_value - total_cost_basis,
    }

    # Last directive
    last_directive_stmt = (
        select(Directive)
        .where(Directive.team_id == team.id)
        .order_by(Directive.created_at.desc())
        .limit(1)
    )
    last_result = await db.execute(last_directive_stmt)
    last_dir = last_result.scalar_one_or_none()

    last_directive = None
    if last_dir:
        last_directive = {
            "id": str(last_dir.id),
            "headline": last_dir.news_headline
            or (last_dir.content[:100] if last_dir.content else ""),
            "feedback": last_dir.board_feedback or "",
            "submitted_at": last_dir.created_at.isoformat()
            if last_dir.created_at
            else "",
            "status": last_dir.status.value
            if hasattr(last_dir.status, "value")
            else str(last_dir.status),
        }

    # Cooldown
    cooldown_active = False
    cooldown_seconds = 0
    cooldown_ends = None

    if team.cooldown_until:
        if team.cooldown_until > now:
            cooldown_active = True
            cooldown_seconds = int((team.cooldown_until - now).total_seconds())
            cooldown_ends = team.cooldown_until.isoformat()

    cooldown_status = {
        "active": cooldown_active,
        "started_at": team.cooldown_until.isoformat() if cooldown_active else None,
        "ends_at": cooldown_ends,
        "seconds_remaining": cooldown_seconds if cooldown_active else None,
    }

    return {
        "profile": profile,
        "financials": financials,
        "portfolio": portfolio,
        "last_directive": last_directive,
        "cooldown_status": cooldown_status,
    }


# ---------------------------------------------------------------------------
# Connection Manager
# ---------------------------------------------------------------------------


class ConnectionManager:
    def __init__(self):
        self._market_connections: Set[WebSocket] = set()
        self._team_connections: Dict[str, Set[WebSocket]] = {}  # keyed by api_key (str)
        self._api_key_to_team_id: Dict[str, str] = {}  # api_key -> team_id (both str)
        self._lock = asyncio.Lock()
        self._seq = count(1)

    def _next_seq(self) -> int:
        return next(self._seq)

    # ---- helpers ----

    async def _send(self, ws: WebSocket, msg: dict):
        """Send a message to a single websocket, adding sequence_id."""
        msg["sequence_id"] = self._next_seq()
        try:
            await ws.send_text(_serialize(msg))
        except Exception:
            pass

    async def _send_to_set(
        self, connections: Set[WebSocket], msg: dict
    ) -> Set[WebSocket]:
        """Send to a set of connections, return set of dead ones."""
        dead: Set[WebSocket] = set()
        msg["sequence_id"] = self._next_seq()
        text = _serialize(msg)
        for ws in connections:
            try:
                await ws.send_text(text)
            except Exception:
                dead.add(ws)
        return dead

    # ---- market connections ----

    async def connect_market(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self._market_connections.add(websocket)

        # Send burst_sync
        try:
            async with AsyncSessionLocal() as db:
                burst = await _build_market_burst(db)
            msg = {
                "type": "connection_established",
                "sequence_id": self._next_seq(),
                "payload": {"burst_sync": burst},
            }
            await websocket.send_text(_serialize(msg))
        except Exception:
            logger.exception("Failed to send market burst_sync")

    async def disconnect_market(self, websocket: WebSocket):
        async with self._lock:
            self._market_connections.discard(websocket)

    # ---- team connections ----

    async def connect_team(self, websocket: WebSocket, api_key: str) -> bool:
        """Connect a team websocket. Returns True if valid, False if rejected."""
        await websocket.accept()

        # Validate api_key against DB
        try:
            api_key_uuid = uuid.UUID(api_key)
        except ValueError:
            await websocket.close(code=4001, reason="Invalid API key format")
            return False

        async with AsyncSessionLocal() as db:
            stmt = select(Team).where(Team.api_key == api_key_uuid)
            result = await db.execute(stmt)
            team = result.scalar_one_or_none()

        if not team:
            await websocket.close(code=4001, reason="Unknown API key")
            return False

        team_id_str = str(team.id)
        async with self._lock:
            self._api_key_to_team_id[api_key] = team_id_str
            if api_key not in self._team_connections:
                self._team_connections[api_key] = set()
            self._team_connections[api_key].add(websocket)

        # Send burst_sync with dossier
        try:
            async with AsyncSessionLocal() as db:
                # Re-fetch team inside fresh session
                stmt = select(Team).where(Team.api_key == api_key_uuid)
                result = await db.execute(stmt)
                team = result.scalar_one_or_none()
                if team:
                    dossier = await _build_team_dossier(db, team)
                else:
                    dossier = {}
            msg = {
                "type": "connection_established",
                "sequence_id": self._next_seq(),
                "payload": {"burst_sync": {"dossier": dossier}},
            }
            await websocket.send_text(_serialize(msg))
        except Exception:
            logger.exception("Failed to send team burst_sync")

        return True

    async def disconnect_team(self, websocket: WebSocket, api_key: str):
        async with self._lock:
            if api_key in self._team_connections:
                self._team_connections[api_key].discard(websocket)
                if not self._team_connections[api_key]:
                    del self._team_connections[api_key]
                    self._api_key_to_team_id.pop(api_key, None)

    # ---- broadcast / send methods ----

    async def broadcast_to_market(self, message: dict):
        async with self._lock:
            dead = await self._send_to_set(self._market_connections, message)
            self._market_connections -= dead

    async def send_to_team(self, team_id_or_api_key: str, message: dict):
        """Send to a team's connections by api_key or team_id."""
        async with self._lock:
            # Try as api_key first
            if team_id_or_api_key in self._team_connections:
                dead = await self._send_to_set(
                    self._team_connections[team_id_or_api_key], message
                )
                self._team_connections[team_id_or_api_key] -= dead
                return

            # Try matching by team_id
            for ak, tid in self._api_key_to_team_id.items():
                if tid == team_id_or_api_key and ak in self._team_connections:
                    dead = await self._send_to_set(self._team_connections[ak], message)
                    self._team_connections[ak] -= dead
                    return

    async def broadcast_price_update(
        self,
        ticker: str,
        price: float,
        change_pct: float,
        change_abs: float,
        volume: int,
        market_cap: float,
        status: str,
    ):
        msg = {
            "type": "price_update",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "ticker": ticker,
                "price": price,
                "change_24h": change_pct,
                "change_absolute": change_abs,
                "volume_24h": volume,
                "market_cap": market_cap,
                "status": status,
            },
        }
        await self.broadcast_to_market(msg)

    async def broadcast_news(self, news_item_dict: dict):
        msg = {
            "type": "news",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": news_item_dict,
        }
        await self.broadcast_to_market(msg)

    async def broadcast_system_event(self, event_type: str, payload: dict):
        msg = {
            "type": "system_event",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "event_type": event_type,
                **payload,
            },
        }
        await self.broadcast_to_market(msg)

    async def send_cooldown_sync(self, api_key: str, seconds_remaining: int):
        msg = {
            "type": "cooldown_sync",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {"seconds_remaining": seconds_remaining},
        }
        await self.send_to_team(api_key, msg)

    async def send_directive_complete(
        self, api_key: str, directive_id: str, status: str, headline: str, feedback: str
    ):
        msg = {
            "type": "directive_complete",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "directive_id": directive_id,
                "status": status,
                "headline": headline,
                "feedback": feedback,
            },
        }
        await self.send_to_team(api_key, msg)

    async def send_trade_confirmation(self, api_key: str, order_data: dict):
        msg = {
            "type": "trade_confirmation",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": order_data,
        }
        await self.send_to_team(api_key, msg)

    async def send_portfolio_update(
        self, api_key: str, financials: dict, portfolio: dict
    ):
        msg = {
            "type": "portfolio_update",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "financials": financials,
                "portfolio": portfolio,
            },
        }
        await self.send_to_team(api_key, msg)

    async def send_cash_update(self, api_key: str, financials: dict):
        msg = {
            "type": "cash_update",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": {
                "financials": financials,
            },
        }
        await self.send_to_team(api_key, msg)

    # ---- sync_request handler ----

    async def _handle_sync_request(
        self, websocket: WebSocket, feed: str, api_key: str = None
    ):
        """Re-send the current burst_sync."""
        try:
            async with AsyncSessionLocal() as db:
                if feed == "market":
                    burst = await _build_market_burst(db)
                    msg = {
                        "type": "connection_established",
                        "sequence_id": self._next_seq(),
                        "payload": {"burst_sync": burst},
                    }
                elif feed == "team" and api_key:
                    api_key_uuid = uuid.UUID(api_key)
                    stmt = select(Team).where(Team.api_key == api_key_uuid)
                    result = await db.execute(stmt)
                    team = result.scalar_one_or_none()
                    if team:
                        dossier = await _build_team_dossier(db, team)
                    else:
                        dossier = {}
                    msg = {
                        "type": "connection_established",
                        "sequence_id": self._next_seq(),
                        "payload": {"burst_sync": {"dossier": dossier}},
                    }
                else:
                    return
            await websocket.send_text(_serialize(msg))
        except Exception:
            logger.exception("Failed to handle sync_request")


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

manager = ConnectionManager()


# ---------------------------------------------------------------------------
# WebSocket message loop handlers
# ---------------------------------------------------------------------------


async def handle_market_ws(websocket: WebSocket):
    """Main loop for /ws/market connections."""
    await manager.connect_market(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type")
            if msg_type == "ping":
                await manager._send(
                    websocket,
                    {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )
            elif msg_type == "sync_request":
                await manager._handle_sync_request(websocket, "market")
    except WebSocketDisconnect:
        await manager.disconnect_market(websocket)
    except Exception:
        await manager.disconnect_market(websocket)


async def handle_team_ws(websocket: WebSocket, api_key: str):
    """Main loop for /ws/team/{api_key} connections."""
    connected = await manager.connect_team(websocket, api_key)
    if not connected:
        return
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = message.get("type")
            if msg_type == "ping":
                await manager._send(
                    websocket,
                    {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )
            elif msg_type == "sync_request":
                await manager._handle_sync_request(websocket, "team", api_key)
    except WebSocketDisconnect:
        await manager.disconnect_team(websocket, api_key)
    except Exception:
        await manager.disconnect_team(websocket, api_key)
