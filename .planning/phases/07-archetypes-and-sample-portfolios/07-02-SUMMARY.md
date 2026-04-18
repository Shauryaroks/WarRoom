---
phase: 07-archetypes-and-sample-portfolios
plan: 02
subsystem: frontend-archetypes
tags: [archetypes, admin-ui, game-view, bloomberg-theme]
dependency_graph:
  requires: [07-01]
  provides: [archetype-dropdown, archetype-creation-form, archetype-badge]
  affects: [admin-teams, admin-settings, game-caseline]
tech_stack:
  added: []
  patterns:
    [
      archetype-dropdown-auto-fill,
      benchmark-bands-display,
      create-form-with-slug-generation,
    ]
key_files:
  created: []
  modified:
    - client/src/lib/types.ts
    - client/src/lib/api.ts
    - client/src/app/admin/teams/page.tsx
    - client/src/app/admin/settings/page.tsx
    - client/src/components/game/CaselinePanel.tsx
    - client/src/components/admin/team-table.tsx
decisions:
  - "Extended CaselineResponse with SWOT fields for direct display in game view"
  - "Auto-generate slug from name in create form with manual override capability"
  - "Archetype dropdown only renders during SETUP game phase per D-08"
metrics:
  duration: 400s
  completed: 2026-04-16T17:36:12Z
  tasks_completed: 2
  tasks_total: 3
  files_modified: 6
---

# Phase 7 Plan 02: Frontend Archetype System Summary

Frontend types, API client, admin archetype dropdown with auto-fill, creation form in Settings, and CaselinePanel archetype badge with benchmark bands display.

## Completed Tasks

| Task | Name                                                                          | Commit  | Key Files                                          |
| ---- | ----------------------------------------------------------------------------- | ------- | -------------------------------------------------- |
| 1    | TypeScript types, API client methods, and admin Teams archetype dropdown      | 945d36f | types.ts, api.ts, teams/page.tsx, team-table.tsx   |
| 2    | Admin Settings archetype creation form and game CaselinePanel archetype badge | 74e9191 | settings/page.tsx, CaselinePanel.tsx               |
| 3    | Verify archetype system end-to-end                                            | --      | Deferred to orchestrator (checkpoint:human-verify) |

## What Was Built

### Task 1: Types + API + Teams Dropdown

- Added `ArchetypeResponse`, `ArchetypeAssignResponse`, `ArchetypeSeedResponse`, `BenchmarkBands` types
- Extended `AdminTeam` with `archetype_id` and `archetype_name` fields
- Extended `CaselineResponse` with `archetype_name`, `archetype_slug`, `sector`, `benchmark_bands`, and 4 SWOT fields
- Added 5 API methods: `getArchetypes`, `createArchetype`, `deleteArchetype`, `assignArchetype`, `seedArchetypes`
- Admin Teams page loads archetypes on mount and shows dropdown in caseline panel during SETUP phase
- Dropdown selection calls assign API, auto-fills caseline doc, company name, cash, and stock price from archetype
- TeamTable shows archetype name badge inline with team name

### Task 2: Settings Form + CaselinePanel Badge

- Added ARCHETYPE_MANAGEMENT section in Settings between GAME_CONFIGURATION and DANGER_ZONE
- Seed presets button calls seed API and shows created/skipped counts
- Archetype list table with name, sector, starting cash, and preset badge or delete button
- Collapsible NEW_ARCHETYPE form with all fields: name, slug (auto-generated), sector, description, dossier (markdown textarea), 4 benchmark band min/max pairs, financial fields (cash, stock price, shares), 4 SWOT textareas, and real-world inspiration
- CaselinePanel shows ARCHETYPE IDENTITY section with blue name badge + sector tag when archetype assigned
- Benchmark bands displayed in 2x2 grid showing market share, margin, growth, ops efficiency ranges
- SWOT section now displays actual data from caseline response instead of "--" placeholders

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added try/catch around JSON.parse for benchmark_bands**

- **Found during:** Task 2
- **Issue:** benchmark_bands is a JSON string that could be malformed, causing runtime crash
- **Fix:** Wrapped JSON.parse in try/catch, return null on error
- **Files modified:** CaselinePanel.tsx

## Deferred Tasks

- **Task 3 (checkpoint:human-verify):** End-to-end verification of archetype system deferred to orchestrator. Requires running backend, seeding archetypes, and visual verification of dropdown assignment, auto-fill, game view badge, and custom creation.

## Known Stubs

None. All components wire to real API endpoints and display actual data from backend responses.

## Self-Check: PASSED
