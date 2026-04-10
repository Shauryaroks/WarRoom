# 11. Operations & Admin Guide

## 11.1. Admin Panel

### 11.1.1. Manual Approval Dashboard

**Pending Registrations Queue**:
Admin reviews Team Name and Ticker for appropriateness. Assigns a pre-made **Portfolio Profile** (SWOT + Starting Financials) from a curated pool (e.g., `PORT_TECH_01`).
System tracks distribution counts to ensure no single portfolio type dominates.

### 11.1.2. Game Control Center

**Elimination Trigger Button**:

- Big Red Button labeled **"INITIATE MARKET PURGE"**.
- **Two-Step Confirmation**: Modal warning → Type "PURGE" to confirm.
- **Pre-Purge Checklist**: Requires minimum 30 minutes since last purge, >10 teams remain, and 0 pending directives/trades. Can be force-overridden.

**Emergency Pause/Resume**:

- Halts all trading and directive submissions (`503 Service Unavailable`).
- Freezes cooldown timers exactly.

**Manual News Injection**:

- Inject global or targeted headlines to steer narrative (e.g., "Regulatory investigation").
- Admin selects urgency, impact type, and affected sectors.

## 11.2. Event Logistics

### 11.2.1. Physical Setup

- **WiFi**: 50 teams × 3 devices = 150 concurrent connections. Dedicated router with separate VLAN recommended. 4G/5G failover modems for admin.
- **Displays**: Large projector for Market Wire/Ticker. Admin laptop mirrored to small monitor for purge ceremonies. Final leaderboard hidden until end.

### 11.2.2. Pre-Event Checklist

- **Portfolio Curation**: Create 8-10 diverse SWOT profiles ensuring balance (e.g., High Cash/Low Growth vs. Low Cash/High Growth).
- **News Seeding**: Pre-load 10 initial global news items.
- **LLM API Validation**: Verify OpenRouter quota > $50 and valid API keys 2 hours before the event. Have backup keys ready.

### 11.2.3. Event Flow Timeline

- **T-60**: Doors open, registration.
- **T-0**: Game Start.
- **Hours 1-5**: Continuous play with 3-4 manual purges.
- **Hour 6**: Final IRL Presentation for top 4 teams.

## 11.3. Contingency Plans

- **LLM API Failure**: Pause game, switch to backup API key (Claude Haiku or GPT-3.5), resume with "Board is distracted" narrative announcement.
- **Server Overload**: Pause, restart with reduced LLM concurrency. Restore from Postgres backup if needed (RTO 10 mins).
- **Cheating Detection**: Monitor for collusion (pump-and-dump). Admin issues private warnings or immediate disqualification.

## 11.4. Security & Fair Play

- **API Keys**: UUIDv4 passed via `X-API-Key` header over TLS 1.3.
- **Admin Auth**: OAuth2 or password + TOTP with IP whitelisting.
- **Rate Limiting**: 10 REST req/min per team. Repeated violations trigger 10-minute IP ban.
- **WebSocket Validation**: Handshake requires key; malformed JSON messages disconnect client automatically.

## 11.5. Performance & Budget

- **LLM Budget**: ~$6.00 total for 50 teams over 6 hours using Claude 3.5 Sonnet. Budget $10.00 max.
- **Hardware**: VPS with 4 vCPU, 8GB RAM (AWS t3.xlarge or Hetzner CPX31).
- **Bandwidth**: ~7.5 MB/s peak sustained for 50 teams. 100 Mbps symmetric fiber recommended for hall.
