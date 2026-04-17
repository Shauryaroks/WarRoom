"""Endpoint audit script — tests all REST endpoints in phases 1-8.

Runs against live Docker stack via Caddy on localhost:8080.
Categorizes findings as BLOCKER, WARNING, or NIT.

Usage:
    cd server && uv run python scripts/audit_endpoints.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx

BASE = os.environ.get("AUDIT_BASE", "http://localhost:8080")
ADMIN_EMAIL = os.environ.get("AUDIT_ADMIN_EMAIL", "admin@complex.com")
ADMIN_PASSWORD = os.environ.get("AUDIT_ADMIN_PASSWORD", "admin123")

# Severity levels
BLOCKER = "BLOCKER"
WARNING = "WARNING"
NIT = "NIT"


@dataclass
class Finding:
    severity: str
    endpoint: str
    detail: str
    status_got: int | None = None
    status_expected: str = ""
    response_snippet: str = ""


@dataclass
class AuditState:
    findings: list[Finding] = field(default_factory=list)
    tests_run: int = 0
    tests_passed: int = 0

    admin_token: str = ""
    strategist_token: str = ""
    trader_token: str = ""
    other_strategist_token: str = ""
    other_trader_token: str = ""

    team_id: str = ""
    other_team_id: str = ""
    team_email: str = ""
    other_team_email: str = ""

    def record(self, passed: bool, finding: Finding | None = None) -> None:
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
        elif finding:
            self.findings.append(finding)


def snippet(text: str, limit: int = 200) -> str:
    text = text.replace("\n", " ")
    if len(text) > limit:
        return text[:limit] + "..."
    return text


async def expect(
    state: AuditState,
    label: str,
    response: httpx.Response,
    expected: int | set[int],
    severity: str = WARNING,
) -> bool:
    expected_set = {expected} if isinstance(expected, int) else set(expected)
    if response.status_code in expected_set:
        state.record(True)
        return True
    state.record(
        False,
        Finding(
            severity=severity,
            endpoint=label,
            detail=f"Expected {sorted(expected_set)}, got {response.status_code}",
            status_got=response.status_code,
            status_expected=str(sorted(expected_set)),
            response_snippet=snippet(response.text),
        ),
    )
    return False


async def setup_tokens(client: httpx.AsyncClient, state: AuditState) -> None:
    # Admin login
    r = await client.post(
        f"{BASE}/api/v1/admin/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if r.status_code != 200:
        print(f"FATAL: Admin login failed: {r.status_code} {r.text}")
        sys.exit(1)
    state.admin_token = r.json()["token"]
    print(f"[OK] Admin token: {state.admin_token[:20]}...")

    # Register two test teams (unique each run)
    # Ticker must be 3-5 UPPERCASE LETTERS only (per validator regex).
    def letter_suffix(n: int = 3) -> str:
        import random
        import string
        return "".join(random.choices(string.ascii_uppercase, k=n))

    ls = letter_suffix(5)
    other_ls = letter_suffix(5)
    # Ensure uniqueness across the two
    while other_ls == ls:
        other_ls = letter_suffix(5)

    suffix = uuid.uuid4().hex[:6].upper()
    state.team_email = f"audit{suffix}@example.com"
    other_email = f"audit{suffix}b@example.com"
    state.other_team_email = other_email
    team_name = f"Audit Team {suffix}"
    other_name = f"Audit Team {suffix}B"
    ticker = ls
    other_ticker = other_ls

    r1 = await client.post(
        f"{BASE}/api/v1/auth/register",
        json={
            "team_name": team_name,
            "ticker": ticker,
            "email": state.team_email,
            "password": "testpass123",
        },
    )
    if r1.status_code != 202:
        print(f"FATAL: Register team1 failed: {r1.status_code} {r1.text}")
        sys.exit(1)
    state.team_id = r1.json()["team_id"]
    print(f"[OK] Registered team1: {state.team_id} ({ticker})")

    r2 = await client.post(
        f"{BASE}/api/v1/auth/register",
        json={
            "team_name": other_name,
            "ticker": other_ticker,
            "email": other_email,
            "password": "testpass123",
        },
    )
    if r2.status_code != 202:
        print(f"FATAL: Register team2 failed: {r2.status_code} {r2.text}")
        sys.exit(1)
    state.other_team_id = r2.json()["team_id"]
    print(f"[OK] Registered team2: {state.other_team_id} ({other_ticker})")

    # Approve both teams
    ah = {"Authorization": f"Bearer {state.admin_token}"}
    for tid in (state.team_id, state.other_team_id):
        ra = await client.post(
            f"{BASE}/api/v1/admin/teams/{tid}/approve", headers=ah
        )
        if ra.status_code != 200:
            print(f"FATAL: Approve team {tid} failed: {ra.status_code} {ra.text}")
            sys.exit(1)
    print("[OK] Approved both teams")

    # Login strategist + trader for both
    for role in ("strategist", "trader"):
        r = await client.post(
            f"{BASE}/api/v1/auth/login",
            json={
                "email": state.team_email,
                "password": "testpass123",
                "role": role,
            },
        )
        if r.status_code != 200:
            print(f"FATAL: {role} login failed: {r.status_code} {r.text}")
            sys.exit(1)
        if role == "strategist":
            state.strategist_token = r.json()["token"]
        else:
            state.trader_token = r.json()["token"]

    for role in ("strategist", "trader"):
        r = await client.post(
            f"{BASE}/api/v1/auth/login",
            json={
                "email": state.other_team_email,
                "password": "testpass123",
                "role": role,
            },
        )
        if r.status_code != 200:
            print(f"FATAL: other {role} login failed: {r.status_code} {r.text}")
            sys.exit(1)
        if role == "strategist":
            state.other_strategist_token = r.json()["token"]
        else:
            state.other_trader_token = r.json()["token"]
    print("[OK] Obtained strategist and trader tokens")


def auth_hdr(tok: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {tok}"}


async def test_auth_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    # /api/v1/auth/register — already tested implicitly during setup; test edge cases
    r = await client.post(
        f"{BASE}/api/v1/auth/register",
        json={"team_name": "x", "ticker": "ABC", "email": "bad@x.com", "password": "shortp"},
    )
    await expect(state, "POST /auth/register (short password + short name)", r, 422)

    r = await client.post(f"{BASE}/api/v1/auth/register", json={})
    await expect(state, "POST /auth/register (empty body)", r, 422)

    # /api/v1/auth/login — wrong password
    r = await client.post(
        f"{BASE}/api/v1/auth/login",
        json={"email": state.team_email, "password": "wrongpw!!", "role": "strategist"},
    )
    await expect(state, "POST /auth/login (wrong pw)", r, 401)

    # /api/v1/auth/login — unknown email
    r = await client.post(
        f"{BASE}/api/v1/auth/login",
        json={"email": "nobody@nope.com", "password": "testpass123", "role": "strategist"},
    )
    await expect(state, "POST /auth/login (unknown email)", r, 401)

    # /api/v1/auth/me — no auth (HTTPBearer returns 403 by default; 401 if token invalid)
    r = await client.get(f"{BASE}/api/v1/auth/me")
    await expect(state, "GET /auth/me (no auth)", r, {401, 403}, severity=WARNING)

    # /api/v1/auth/me — valid
    r = await client.get(f"{BASE}/api/v1/auth/me", headers=auth_hdr(state.strategist_token))
    await expect(state, "GET /auth/me (strategist)", r, 200)

    r = await client.get(f"{BASE}/api/v1/auth/me", headers=auth_hdr(state.admin_token))
    await expect(state, "GET /auth/me (admin)", r, 200)


async def test_teams_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    # /api/v1/teams/approved — requires auth
    r = await client.get(f"{BASE}/api/v1/teams/approved")
    await expect(state, "GET /teams/approved (no auth)", r, {401, 403})

    r = await client.get(f"{BASE}/api/v1/teams/approved", headers=auth_hdr(state.strategist_token))
    await expect(state, "GET /teams/approved (team)", r, 200)

    # /api/v1/teams/game-state
    r = await client.get(f"{BASE}/api/v1/teams/game-state")
    await expect(state, "GET /teams/game-state (no auth)", r, {401, 403})

    r = await client.get(
        f"{BASE}/api/v1/teams/game-state", headers=auth_hdr(state.strategist_token)
    )
    await expect(state, "GET /teams/game-state (team)", r, 200)


async def test_game_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    # /api/v1/game/phase — team only
    r = await client.get(f"{BASE}/api/v1/game/phase")
    await expect(state, "GET /game/phase (no auth)", r, {401, 403})

    r = await client.get(f"{BASE}/api/v1/game/phase", headers=auth_hdr(state.admin_token))
    await expect(state, "GET /game/phase (admin token → 403)", r, 403)

    r = await client.get(
        f"{BASE}/api/v1/game/phase", headers=auth_hdr(state.strategist_token)
    )
    await expect(state, "GET /game/phase (team)", r, 200)

    # /api/v1/game/budget
    r = await client.get(f"{BASE}/api/v1/game/budget", headers=auth_hdr(state.strategist_token))
    # budget may return 400 if game not active — accept 200 or 400
    await expect(state, "GET /game/budget (team)", r, {200, 400})


async def test_market_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    r = await client.get(f"{BASE}/api/v1/market/companies")
    await expect(state, "GET /market/companies (no auth)", r, {401, 403})

    r = await client.get(
        f"{BASE}/api/v1/market/companies", headers=auth_hdr(state.strategist_token)
    )
    await expect(state, "GET /market/companies (team)", r, 200)

    # /market/prices/{team_id}
    r = await client.get(
        f"{BASE}/api/v1/market/prices/{state.team_id}",
        headers=auth_hdr(state.strategist_token),
    )
    await expect(state, "GET /market/prices/{team_id} (team)", r, 200)

    r = await client.get(
        f"{BASE}/api/v1/market/prices/not-a-uuid",
        headers=auth_hdr(state.strategist_token),
    )
    await expect(state, "GET /market/prices/{bad-uuid}", r, 400)

    # /market/leaderboard — public
    r = await client.get(f"{BASE}/api/v1/market/leaderboard")
    await expect(state, "GET /market/leaderboard (public)", r, 200)


async def test_solutions_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    # /solutions/my-solutions
    r = await client.get(f"{BASE}/api/v1/solutions/my-solutions")
    await expect(state, "GET /solutions/my-solutions (no auth)", r, {401, 403})

    r = await client.get(
        f"{BASE}/api/v1/solutions/my-solutions", headers=auth_hdr(state.strategist_token)
    )
    await expect(state, "GET /solutions/my-solutions (team)", r, 200)

    # /solutions/cooldown
    r = await client.get(
        f"{BASE}/api/v1/solutions/cooldown", headers=auth_hdr(state.strategist_token)
    )
    await expect(state, "GET /solutions/cooldown (team)", r, 200)

    # /solutions/caseline
    r = await client.get(
        f"{BASE}/api/v1/solutions/caseline", headers=auth_hdr(state.strategist_token)
    )
    await expect(state, "GET /solutions/caseline (team)", r, 200)

    # /solutions/submit — trader forbidden
    r = await client.post(
        f"{BASE}/api/v1/solutions/submit",
        headers=auth_hdr(state.trader_token),
        json={"content": "x" * 100, "solution_type": "INITIAL"},
    )
    await expect(state, "POST /solutions/submit (trader → 403)", r, 403)

    # /solutions/submit — validation short content
    r = await client.post(
        f"{BASE}/api/v1/solutions/submit",
        headers=auth_hdr(state.strategist_token),
        json={"content": "short", "solution_type": "INITIAL"},
    )
    await expect(state, "POST /solutions/submit (content too short)", r, 422)

    # /solutions/submit — invalid type
    r = await client.post(
        f"{BASE}/api/v1/solutions/submit",
        headers=auth_hdr(state.strategist_token),
        json={"content": "x" * 100, "solution_type": "BOGUS"},
    )
    await expect(state, "POST /solutions/submit (bad type)", r, 422)


async def test_trading_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    # /trading/preview — no auth
    r = await client.post(f"{BASE}/api/v1/trading/preview", json={})
    await expect(state, "POST /trading/preview (no auth)", r, {401, 403})

    # /trading/preview — valid, team
    r = await client.post(
        f"{BASE}/api/v1/trading/preview",
        headers=auth_hdr(state.trader_token),
        json={"target_team_id": state.other_team_id, "shares": 10, "trade_type": "BUY"},
    )
    # may be 400 if game not active; 200 if active
    await expect(state, "POST /trading/preview (trader)", r, {200, 400})

    # /trading/preview — bad shares
    r = await client.post(
        f"{BASE}/api/v1/trading/preview",
        headers=auth_hdr(state.trader_token),
        json={"target_team_id": state.other_team_id, "shares": 0, "trade_type": "BUY"},
    )
    await expect(state, "POST /trading/preview (shares=0)", r, 422)

    # /trading/preview — strategist allowed
    r = await client.post(
        f"{BASE}/api/v1/trading/preview",
        headers=auth_hdr(state.strategist_token),
        json={"target_team_id": state.other_team_id, "shares": 10, "trade_type": "BUY"},
    )
    await expect(state, "POST /trading/preview (strategist)", r, {200, 400})

    # /trading/buy — strategist forbidden
    r = await client.post(
        f"{BASE}/api/v1/trading/buy",
        headers=auth_hdr(state.strategist_token),
        json={"target_team_id": state.other_team_id, "shares": 10},
    )
    await expect(state, "POST /trading/buy (strategist → 403)", r, 403)

    # /trading/buy — trader (game may not be active; expect 200/400/409)
    r = await client.post(
        f"{BASE}/api/v1/trading/buy",
        headers=auth_hdr(state.trader_token),
        json={"target_team_id": state.other_team_id, "shares": 10},
    )
    await expect(state, "POST /trading/buy (trader)", r, {200, 400, 409})

    # /trading/sell — strategist forbidden
    r = await client.post(
        f"{BASE}/api/v1/trading/sell",
        headers=auth_hdr(state.strategist_token),
        json={"target_team_id": state.other_team_id, "shares": 10},
    )
    await expect(state, "POST /trading/sell (strategist → 403)", r, 403)

    # /trading/sell — trader (holdings state depends on prior buy test; accept 200/400/409)
    r = await client.post(
        f"{BASE}/api/v1/trading/sell",
        headers=auth_hdr(state.trader_token),
        json={"target_team_id": state.other_team_id, "shares": 1},
    )
    await expect(state, "POST /trading/sell (trader)", r, {200, 400, 409})

    # /trading/sell — insufficient shares (sell way more than owned)
    r = await client.post(
        f"{BASE}/api/v1/trading/sell",
        headers=auth_hdr(state.trader_token),
        json={"target_team_id": state.other_team_id, "shares": 999_999_999},
    )
    await expect(state, "POST /trading/sell (way too many shares)", r, {400, 409})

    # /trading/buy — bogus target uuid
    bogus = "00000000-0000-0000-0000-000000000000"
    r = await client.post(
        f"{BASE}/api/v1/trading/buy",
        headers=auth_hdr(state.trader_token),
        json={"target_team_id": bogus, "shares": 1},
    )
    await expect(state, "POST /trading/buy (bogus target)", r, {400, 404, 409})

    # /trading/preview — bogus target uuid
    r = await client.post(
        f"{BASE}/api/v1/trading/preview",
        headers=auth_hdr(state.trader_token),
        json={"target_team_id": bogus, "shares": 1, "trade_type": "BUY"},
    )
    await expect(state, "POST /trading/preview (bogus target)", r, {400, 404})

    # /trading/buy — malformed uuid
    r = await client.post(
        f"{BASE}/api/v1/trading/buy",
        headers=auth_hdr(state.trader_token),
        json={"target_team_id": "not-a-uuid", "shares": 1},
    )
    await expect(state, "POST /trading/buy (malformed uuid)", r, {400, 422})

    # /trading/portfolio
    r = await client.get(f"{BASE}/api/v1/trading/portfolio")
    await expect(state, "GET /trading/portfolio (no auth)", r, {401, 403})

    r = await client.get(
        f"{BASE}/api/v1/trading/portfolio", headers=auth_hdr(state.trader_token)
    )
    await expect(state, "GET /trading/portfolio (trader)", r, 200)


async def test_decisions_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    # /decisions/submit — trader forbidden
    r = await client.post(
        f"{BASE}/api/v1/decisions/submit",
        headers=auth_hdr(state.trader_token),
        json={"decisions": []},
    )
    await expect(state, "POST /decisions/submit (trader → 403)", r, 403)

    # /decisions/submit — strategist, empty (will likely 409 because game not in live_floor or succeed)
    r = await client.post(
        f"{BASE}/api/v1/decisions/submit",
        headers=auth_hdr(state.strategist_token),
        json={"decisions": []},
    )
    await expect(state, "POST /decisions/submit (strategist empty)", r, {200, 409})

    # /decisions/submit — bad body
    r = await client.post(
        f"{BASE}/api/v1/decisions/submit",
        headers=auth_hdr(state.strategist_token),
        json={},
    )
    await expect(state, "POST /decisions/submit (bad body)", r, 422)

    # /decisions/current
    r = await client.get(
        f"{BASE}/api/v1/decisions/current", headers=auth_hdr(state.strategist_token)
    )
    await expect(state, "GET /decisions/current (team)", r, 200)

    # /decisions/operating-plan POST
    r = await client.post(
        f"{BASE}/api/v1/decisions/operating-plan",
        headers=auth_hdr(state.trader_token),
        json={"content": "plan"},
    )
    await expect(state, "POST /decisions/operating-plan (trader → 403)", r, 403)

    r = await client.post(
        f"{BASE}/api/v1/decisions/operating-plan",
        headers=auth_hdr(state.strategist_token),
        json={"content": "plan"},
    )
    await expect(state, "POST /decisions/operating-plan (strategist)", r, {200, 409})

    # /decisions/operating-plan GET
    r = await client.get(
        f"{BASE}/api/v1/decisions/operating-plan",
        headers=auth_hdr(state.strategist_token),
    )
    await expect(state, "GET /decisions/operating-plan (team)", r, {200, 404})

    # /decisions/submit with one real decision body — must not 500 even if game phase
    # forbids it. Uses MARKETING lever (Phase 8 polish removed PRICING).
    r = await client.post(
        f"{BASE}/api/v1/decisions/submit",
        headers=auth_hdr(state.strategist_token),
        json={
            "decisions": [
                {
                    "lever_category": "MARKETING",
                    "decisions_json": {
                        "atl_pct": 25,
                        "digital_pct": 25,
                        "influencer_pct": 25,
                        "btl_pct": 25,
                        "campaign_theme": "VALUE",
                    },
                    "budget_spent": 0,
                }
            ]
        },
    )
    # Must never 500; 200 if game is ACTIVE + live_floor + archetype; else 400/409.
    await expect(state, "POST /decisions/submit (real marketing lever)", r, {200, 400, 409})


async def test_admin_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    ah = auth_hdr(state.admin_token)
    th = auth_hdr(state.strategist_token)
    bogus_uuid = "00000000-0000-0000-0000-000000000000"

    # admin/login: wrong password
    r = await client.post(
        f"{BASE}/api/v1/admin/login",
        json={"email": ADMIN_EMAIL, "password": "wrongpw"},
    )
    await expect(state, "POST /admin/login (wrong pw)", r, 401)

    # admin/seed — already seeded, 409
    r = await client.post(
        f"{BASE}/api/v1/admin/seed",
        json={"email": "x@complex.com", "password": "x" * 10},
    )
    await expect(state, "POST /admin/seed (already seeded)", r, 409)

    # GET /admin/teams — team token → 403
    r = await client.get(f"{BASE}/api/v1/admin/teams", headers=th)
    await expect(state, "GET /admin/teams (team → 403)", r, 403)

    r = await client.get(f"{BASE}/api/v1/admin/teams", headers=ah)
    await expect(state, "GET /admin/teams (admin)", r, 200)

    # invalid status filter
    r = await client.get(f"{BASE}/api/v1/admin/teams?status=BOGUS", headers=ah)
    await expect(state, "GET /admin/teams?status=BOGUS", r, 400)

    # approve nonexistent
    r = await client.post(f"{BASE}/api/v1/admin/teams/{bogus_uuid}/approve", headers=ah)
    await expect(state, "POST /admin/teams/{bogus}/approve", r, 404)

    # approve our already-approved
    r = await client.post(
        f"{BASE}/api/v1/admin/teams/{state.team_id}/approve", headers=ah
    )
    await expect(state, "POST /admin/teams/{approved}/approve", r, 409)

    # reject nonexistent
    r = await client.post(f"{BASE}/api/v1/admin/teams/{bogus_uuid}/reject", headers=ah)
    await expect(state, "POST /admin/teams/{bogus}/reject", r, 404)

    # /admin/teams/{id}/set-score — DEPRECATED (Phase 9 D-28). Always 410 Gone.
    r = await client.post(
        f"{BASE}/api/v1/admin/teams/{state.team_id}/set-score",
        headers=ah,
        json={"quality_score": 0.5},
    )
    await expect(state, "POST /admin/teams/{id}/set-score (deprecated)", r, 410)

    # Bad score payload — still 410, since endpoint early-returns before Pydantic validation
    # (FastAPI validates body first, so 422 would be returned only if the endpoint was live).
    r = await client.post(
        f"{BASE}/api/v1/admin/teams/{state.team_id}/set-score",
        headers=ah,
        json={"quality_score": 2.0},
    )
    await expect(state, "POST /admin/teams/{id}/set-score (bad score, still 410)", r, {410, 422})

    # /admin/news/inject
    r = await client.post(
        f"{BASE}/api/v1/admin/news/inject",
        headers=ah,
        json={"headline": "Test", "body": "body", "news_type": "GLOBAL", "affected_tickers": []},
    )
    await expect(state, "POST /admin/news/inject", r, 200)

    # /admin/broadcast
    r = await client.post(
        f"{BASE}/api/v1/admin/broadcast",
        headers=ah,
        json={"message": "Hello all"},
    )
    await expect(state, "POST /admin/broadcast", r, 200)

    # /admin/game/state
    r = await client.get(f"{BASE}/api/v1/admin/game/state", headers=ah)
    await expect(state, "GET /admin/game/state", r, 200)

    # /admin/game/phase
    r = await client.get(f"{BASE}/api/v1/admin/game/phase", headers=ah)
    await expect(state, "GET /admin/game/phase", r, 200)

    # /admin/activity
    r = await client.get(f"{BASE}/api/v1/admin/activity", headers=ah)
    await expect(state, "GET /admin/activity", r, 200)

    # /admin/news/history
    r = await client.get(f"{BASE}/api/v1/admin/news/history", headers=ah)
    await expect(state, "GET /admin/news/history", r, 200)

    # /admin/evaluations
    r = await client.get(f"{BASE}/api/v1/admin/evaluations", headers=ah)
    await expect(state, "GET /admin/evaluations", r, 200)

    r = await client.get(f"{BASE}/api/v1/admin/evaluations?status=BOGUS", headers=ah)
    await expect(state, "GET /admin/evaluations?status=BOGUS", r, 400)

    r = await client.get(f"{BASE}/api/v1/admin/evaluations/{bogus_uuid}", headers=ah)
    await expect(state, "GET /admin/evaluations/{bogus}", r, 404)

    r = await client.put(
        f"{BASE}/api/v1/admin/evaluations/{bogus_uuid}",
        headers=ah,
        json={"overall_score": 0.5},
    )
    await expect(state, "PUT /admin/evaluations/{bogus}", r, 404)

    r = await client.post(
        f"{BASE}/api/v1/admin/evaluations/{bogus_uuid}/approve", headers=ah
    )
    await expect(state, "POST /admin/evaluations/{bogus}/approve", r, {404, 409})

    r = await client.post(
        f"{BASE}/api/v1/admin/evaluations/{bogus_uuid}/reject",
        headers=ah,
        json={"admin_notes": "no"},
    )
    await expect(state, "POST /admin/evaluations/{bogus}/reject", r, {404, 409})

    # /admin/teams/{id}/caseline — may be locked if game is active
    r = await client.put(
        f"{BASE}/api/v1/admin/teams/{state.team_id}/caseline",
        headers=ah,
        json={"caseline_document": "x" * 100},
    )
    await expect(state, "PUT /admin/teams/{id}/caseline", r, {200, 409})

    # /admin/crisis/inject — may conflict if one is already active or game state
    r = await client.post(
        f"{BASE}/api/v1/admin/crisis/inject",
        headers=ah,
        json={"scenario": "x" * 50, "timer_seconds": 600},
    )
    await expect(state, "POST /admin/crisis/inject", r, {200, 409})

    # /admin/teams/{id}/eliminate — our test team may be in READY so 409
    r = await client.post(
        f"{BASE}/api/v1/admin/teams/{state.team_id}/eliminate", headers=ah
    )
    await expect(state, "POST /admin/teams/{id}/eliminate (ready team)", r, 409)

    # Archetypes
    r = await client.get(f"{BASE}/api/v1/admin/archetypes", headers=ah)
    await expect(state, "GET /admin/archetypes", r, 200)

    r = await client.get(
        f"{BASE}/api/v1/admin/archetypes/{bogus_uuid}", headers=ah
    )
    await expect(state, "GET /admin/archetypes/{bogus}", r, 404)

    r = await client.post(
        f"{BASE}/api/v1/admin/archetypes",
        headers=ah,
        json={
            "name": f"AuditArchetype-{uuid.uuid4().hex[:6]}",
            "slug": f"audit-{uuid.uuid4().hex[:8]}",
            "description": "test",
            "sector": "FOODS",
            "dossier_content": "# test\nbody",
            "benchmark_bands": json.dumps(
                {
                    "market_share": [1, 5],
                    "margin": [10, 15],
                    "growth": [5, 10],
                    "ops_efficiency": [60, 80],
                }
            ),
            "starting_cash": 1000000,
            "starting_stock_price": 100,
            "starting_shares": 1000000,
        },
    )
    await expect(state, "POST /admin/archetypes (create)", r, 201)
    new_arch_id = ""
    if r.status_code == 201:
        new_arch_id = r.json()["id"]

    # bad benchmark_bands
    r = await client.post(
        f"{BASE}/api/v1/admin/archetypes",
        headers=ah,
        json={
            "name": "Bad",
            "slug": f"bad-{uuid.uuid4().hex[:8]}",
            "sector": "FOODS",
            "dossier_content": "x",
            "benchmark_bands": "{not json",
            "starting_cash": 1,
            "starting_stock_price": 1,
        },
    )
    await expect(state, "POST /admin/archetypes (bad json bands)", r, 422)

    if new_arch_id:
        # PUT
        r = await client.put(
            f"{BASE}/api/v1/admin/archetypes/{new_arch_id}",
            headers=ah,
            json={"description": "updated"},
        )
        await expect(state, "PUT /admin/archetypes/{id}", r, 200)

        # DELETE
        r = await client.delete(
            f"{BASE}/api/v1/admin/archetypes/{new_arch_id}", headers=ah
        )
        await expect(state, "DELETE /admin/archetypes/{id}", r, 204)

    # preset delete prevented — seed first
    r = await client.post(f"{BASE}/api/v1/admin/archetypes/seed", headers=ah)
    await expect(state, "POST /admin/archetypes/seed", r, 200)

    # grab one preset, try to delete
    r = await client.get(f"{BASE}/api/v1/admin/archetypes", headers=ah)
    if r.status_code == 200:
        for a in r.json():
            if a.get("is_preset"):
                rr = await client.delete(
                    f"{BASE}/api/v1/admin/archetypes/{a['id']}", headers=ah
                )
                await expect(state, "DELETE /admin/archetypes/{preset} (forbidden)", rr, 409)
                break

    # Assign archetype — requires SETUP; may 409
    r = await client.get(f"{BASE}/api/v1/admin/archetypes", headers=ah)
    if r.status_code == 200 and r.json():
        arch_id = r.json()[0]["id"]
        rr = await client.post(
            f"{BASE}/api/v1/admin/teams/{state.team_id}/assign-archetype",
            headers=ah,
            json={"archetype_id": arch_id},
        )
        await expect(state, "POST /admin/teams/{id}/assign-archetype", rr, {200, 409})

    # Advance round — may 200 always
    r = await client.post(f"{BASE}/api/v1/admin/game/advance-round", headers=ah)
    await expect(state, "POST /admin/game/advance-round", r, 200)


async def test_no_auth_on_admin_endpoints(client: httpx.AsyncClient, state: AuditState) -> None:
    """Quickly verify each admin endpoint rejects missing / team tokens (sample)."""
    th = auth_hdr(state.strategist_token)
    sample_paths = [
        ("GET", "/api/v1/admin/teams"),
        ("GET", "/api/v1/admin/archetypes"),
        ("GET", "/api/v1/admin/activity"),
        ("GET", "/api/v1/admin/evaluations"),
        ("GET", "/api/v1/admin/news/history"),
        ("GET", "/api/v1/admin/game/state"),
        ("GET", "/api/v1/admin/game/phase"),
    ]
    for method, path in sample_paths:
        r = await client.request(method, f"{BASE}{path}")
        await expect(state, f"{method} {path} (no auth)", r, {401, 403})
        r = await client.request(method, f"{BASE}{path}", headers=th)
        await expect(state, f"{method} {path} (team → 403)", r, 403)


async def main() -> None:
    timeout = httpx.Timeout(30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        state = AuditState()
        await setup_tokens(client, state)
        print()

        await test_auth_endpoints(client, state)
        await test_teams_endpoints(client, state)
        await test_game_endpoints(client, state)
        await test_market_endpoints(client, state)
        await test_solutions_endpoints(client, state)
        await test_trading_endpoints(client, state)
        await test_decisions_endpoints(client, state)
        await test_admin_endpoints(client, state)
        await test_no_auth_on_admin_endpoints(client, state)

        # Summary
        print()
        print(f"=== RESULTS ===")
        print(f"Tests run: {state.tests_run}")
        print(f"Passed:    {state.tests_passed}")
        print(f"Failed:    {len(state.findings)}")
        print()
        if state.findings:
            blockers = [f for f in state.findings if f.severity == BLOCKER]
            warnings = [f for f in state.findings if f.severity == WARNING]
            nits = [f for f in state.findings if f.severity == NIT]
            for sev, items in [(BLOCKER, blockers), (WARNING, warnings), (NIT, nits)]:
                if not items:
                    continue
                print(f"--- {sev} ({len(items)}) ---")
                for f in items:
                    print(f"  {f.endpoint}")
                    print(f"    {f.detail}")
                    if f.response_snippet:
                        print(f"    body: {f.response_snippet}")
        sys.exit(0 if not state.findings else 1)


if __name__ == "__main__":
    asyncio.run(main())
