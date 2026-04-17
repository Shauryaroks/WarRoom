---
phase: 07-archetypes-and-sample-portfolios
plan: 01
subsystem: archetype-data-model
tags: [backend, models, api, seed-data, archetypes]
dependency_graph:
  requires: []
  provides: [archetype-model, archetype-crud-api, archetype-seed-endpoint, caseline-archetype-integration]
  affects: [admin-api, caseline-api, team-model]
tech_stack:
  added: []
  patterns: [archetype-model-pattern, benchmark-bands-json-validation]
key_files:
  created:
    - server/alembic/versions/003_add_archetype.py
  modified:
    - server/app/models.py
    - server/app/api/admin.py
    - server/app/api/solutions.py
decisions:
  - Benchmark bands stored as JSON text with strict 4-key validation (market_share, margin, growth, ops_efficiency)
  - Starting cash values from D-04 used directly (e.g., 4000000000 for 400 Cr)
  - Preset archetypes protected from deletion via is_preset flag
metrics:
  duration: 285s
  completed: 2026-04-16T17:27:11Z
  tasks: 2
  files: 4
---

# Phase 7 Plan 01: Archetype Data Model & Admin API Summary

Archetype table with benchmark bands, 4 pre-built Bharat Bites dossiers, full CRUD + assign + seed admin endpoints, and caseline integration returning archetype info.

## What Was Built

### Task 1: Archetype Model, Team FK, and Migration
- Added `Archetype` model to `server/app/models.py` with all D-01 fields: name, slug, description, sector, dossier_content, benchmark_bands (JSON), starting financials, SWOT fields, real_world_inspiration, is_preset flag
- Added `archetype_id` FK (nullable UUID) to `Team` model with bidirectional relationship
- Created Alembic migration `003_add_archetype` creating archetypes table and adding teams.archetype_id

### Task 2: Admin Archetype API Endpoints and Seed Data
- **7 new admin endpoints:**
  - `GET /api/v1/admin/archetypes` -- List all archetypes
  - `POST /api/v1/admin/archetypes` -- Create custom archetype with benchmark_bands validation
  - `GET /api/v1/admin/archetypes/{id}` -- Get single archetype
  - `PUT /api/v1/admin/archetypes/{id}` -- Update archetype
  - `DELETE /api/v1/admin/archetypes/{id}` -- Delete (blocks preset and assigned)
  - `POST /api/v1/admin/teams/{id}/assign-archetype` -- Assign archetype to team (SETUP-only)
  - `POST /api/v1/admin/archetypes/seed` -- Seed 4 preset archetypes (idempotent)
- **4 pre-built dossiers** with full Markdown content (200-400 words each):
  1. Legacy Giant (Parle/Britannia) -- Rs 400 Cr cash, 20-25% market share
  2. D2C Challenger (Open Secret/Yoga Bar) -- Rs 25 Cr cash, 60-100% growth
  3. Regional Leader (Balaji Wafers/Haldiram's) -- Rs 150 Cr cash, 14-18% margin
  4. Premium Niche (Too Yumm/Raw Pressery) -- Rs 80 Cr cash, 22-30% margin
- **Caseline endpoint** updated to return archetype_name, archetype_slug, sector, benchmark_bands
- **Admin team list** updated to include archetype_id and archetype_name fields

## Security Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-07-01 | All archetype endpoints use `require_admin` dependency |
| T-07-02 | SETUP-only guard via `get_game_state_readonly` check on assign endpoint |
| T-07-03 | Caseline endpoint uses `require_team` -- teams only see own archetype data |
| T-07-04 | `_validate_benchmark_bands()` validates JSON structure with exactly 4 keys, each a 2-element numeric array |
| T-07-05 | Seed endpoint is idempotent -- checks slug existence before creating |
| T-07-06 | Delete endpoint rejects `is_preset=True` archetypes and archetypes with assigned teams |

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | ed001da | Archetype model, Team FK, and Alembic migration |
| 2 | 9af0009 | Archetype CRUD endpoints, seed data, and caseline integration |

## Self-Check: PASSED
