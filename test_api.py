#!/usr/bin/env python3
"""Test script for WarRoom API against OpenAPI spec"""

import requests
import json
import sys
from decimal import Decimal

BASE_URL = "http://localhost:8000/api/v1"
ADMIN_KEY = "admin-secret-key"


def check_response(name, resp, expected_status=None):
    status = "✓" if resp.status_code == expected_status else "✗"
    print(f"{status} {name}: {resp.status_code}", end="")
    if resp.status_code != expected_status:
        print(f" (expected {expected_status})")
        print(f"   Response: {resp.text[:200]}")
        return False
    print()
    return True


print("=" * 60)
print("WarRoom API Test Suite")
print("=" * 60)

# Test 1: Health check
print("\n1. Health Check")
resp = requests.get(f"{BASE_URL}/../health")
check_response("GET /health", resp, 200)

# Test 2: Game State (no auth)
print("\n2. Game State")
resp = requests.get(f"{BASE_URL}/game/state")
check_response("GET /game/state", resp, 200)
if resp.status_code == 200:
    print(f"   Response: {resp.json()}")

# Test 3: Register a team
print("\n3. Registration")
team_data = {
    "name": "TestTeamAlpha",
    "ticker": "TMPA",
    "email": "alpha@test.com",
    "password": "password123",
}
resp = requests.post(f"{BASE_URL}/auth/register", json=team_data)
check_response("POST /auth/register", resp, 202)
if resp.status_code == 202:
    print(f"   Response: {resp.json()}")

# Test 4: Login
print("\n4. Login")
login_data = {"email": "alpha@test.com", "password": "password123"}
resp = requests.post(f"{BASE_URL}/auth/login", json=login_data)
check_response("POST /auth/login", resp, 200)
if resp.status_code == 200:
    login_resp = resp.json()
    print(f"   API Key: {login_resp.get('api_key', 'N/A')}")
    API_KEY = login_resp.get("api_key")
else:
    # Try to find existing team
    API_KEY = None

# If no team, register another
if not API_KEY:
    team_data2 = {
        "name": "TestTeamBeta",
        "ticker": "TMPB",
        "email": "beta@test.com",
        "password": "password123",
    }
    resp = requests.post(f"{BASE_URL}/auth/register", json=team_data2)
    if resp.status_code == 202:
        login_data2 = {"email": "beta@test.com", "password": "password123"}
        resp = requests.post(f"{BASE_URL}/auth/login", json=login_data2)
        if resp.status_code == 200:
            API_KEY = resp.json().get("api_key")

if not API_KEY:
    print("   ERROR: Could not obtain API key")
    sys.exit(1)

headers = {"X-API-Key": API_KEY}

# Test 5: Get current team (teams/me)
print("\n5. Team Management")
resp = requests.get(f"{BASE_URL}/teams/me", headers=headers)
check_response("GET /teams/me", resp, 200)
if resp.status_code == 200:
    print(f"   Response: {json.dumps(resp.json(), indent=2)[:500]}...")

# Test 6: Get team holdings
resp = requests.get(f"{BASE_URL}/teams/me/holdings", headers=headers)
check_response("GET /teams/me/holdings", resp, 200)
if resp.status_code == 200:
    print(f"   Holdings: {resp.json()}")

# Test 7: Get team directives
resp = requests.get(f"{BASE_URL}/teams/me/directives", headers=headers)
check_response("GET /teams/me/directives", resp, 200)
if resp.status_code == 200:
    print(f"   Directives: {resp.json()}")

# Test 8: Submit directive
print("\n6. Directives")
directive_data = {
    "directive_markdown": "# Q3 Strategy\nWe will cut prices by 15% to gain market share.",
    "player_confidence_rating": 0.8,
}
resp = requests.post(f"{BASE_URL}/directives", json=directive_data, headers=headers)
check_response("POST /directives", resp, 202)
if resp.status_code == 202:
    print(f"   Response: {resp.json()}")

# Test 9: Get directive history
resp = requests.get(f"{BASE_URL}/directives/history", headers=headers)
check_response("GET /directives/history", resp, 200)

# Test 10: List teams
print("\n7. Market Data")
resp = requests.get(f"{BASE_URL}/teams")
check_response("GET /teams", resp, 200)
if resp.status_code == 200:
    print(f"   Teams: {len(resp.json().get('teams', []))}")

# Test 11: Market overview
resp = requests.get(f"{BASE_URL}/market/overview")
check_response("GET /market/overview", resp, 200)
if resp.status_code == 200:
    print(f"   Response: {resp.json()}")

# Test 12: Market news
resp = requests.get(f"{BASE_URL}/market/news")
check_response("GET /market/news", resp, 200)
if resp.status_code == 200:
    print(f"   News count: {len(resp.json().get('items', []))}")

# Test 13: Submit order (buy)
print("\n8. Trading")
order_data = {"action": "buy", "target_ticker": "$TMPB", "shares": 10}
resp = requests.post(f"{BASE_URL}/orders", json=order_data, headers=headers)
# This might fail if no one else is available to buy from
print(f"POST /orders (buy): {resp.status_code}")
if resp.status_code != 200 and resp.status_code != 201 and resp.status_code != 202:
    print(f"   Response: {resp.text[:200]}")

# Test 14: List orders
resp = requests.get(f"{BASE_URL}/orders", headers=headers)
check_response("GET /orders", resp, 200)

# Test 15: Admin - Game start (need admin key)
print("\n9. Admin - Game Control")
admin_headers = {"X-Admin-Key": ADMIN_KEY}

resp = requests.post(f"{BASE_URL}/game/start", headers=admin_headers)
print(f"POST /game/start: {resp.status_code}")
if resp.status_code != 200 and resp.status_code != 201:
    print(f"   Response: {resp.text[:200]}")
else:
    print(f"   Response: {resp.json()}")

# Test 16: Game state after start
resp = requests.get(f"{BASE_URL}/game/state")
check_response("GET /game/state after start", resp, 200)
if resp.status_code == 200:
    print(f"   Game Status: {resp.json().get('status')}")

# Test 17: Admin - Approve team
print("\n10. Admin - Team Approval")
# First get pending teams
resp = requests.get(f"{BASE_URL}/admin/teams/pending", headers=admin_headers)
check_response("GET /admin/teams/pending", resp, 200)
if resp.status_code == 200:
    pending = resp.json().get("teams", [])
    print(f"   Pending teams: {len(pending)}")
    if pending:
        team_id = pending[0].get("team_id")
        if team_id:
            # Approve the team
            approve_data = {"portfolio_id": "PORT_TECH_01"}
            resp = requests.post(
                f"{BASE_URL}/teams/{team_id}/approve",
                json=approve_data,
                headers=admin_headers,
            )
            print(f"POST /teams/{{id}}/approve: {resp.status_code}")
            if resp.status_code == 200:
                print(f"   Response: {resp.json()}")

# Test 18: Admin - Get metrics
resp = requests.get(f"{BASE_URL}/admin/metrics", headers=admin_headers)
check_response("GET /admin/metrics", resp, 200)
if resp.status_code == 200:
    print(f"   Metrics: {resp.json()}")

# Test 19: Admin - Settings
resp = requests.get(f"{BASE_URL}/admin/settings", headers=admin_headers)
check_response("GET /admin/settings", resp, 200)

# Test 20: WebSocket endpoint (just check if it exists)
print("\n11. WebSocket")
resp = requests.get(f"http://localhost:8000/ws/market")
# WebSocket upgrade will fail with HTTP request, but that's expected
print(f"GET /ws/market: {resp.status_code} (expected to fail - WS upgrade)")

print("\n" + "=" * 60)
print("Test Suite Complete")
print("=" * 60)
