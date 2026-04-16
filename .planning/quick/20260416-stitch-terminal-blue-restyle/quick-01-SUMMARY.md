---
phase: quick
plan: 01
subsystem: frontend/design-system
tags: [css, design-tokens, layout, stitch]
dependency_graph:
  requires: []
  provides: [stitch-palette, surface-tokens, status-bar-layout]
  affects: [all-pages]
tech_stack:
  added: []
  patterns: [css-custom-properties-hex, precision-brutalism-zero-radius, fixed-status-bar]
key_files:
  created: []
  modified:
    - client/src/app/globals.css
    - client/src/app/layout.tsx
decisions:
  - Hex values used instead of HSL for all CSS custom properties (Stitch spec requirement)
  - Pre-existing TypeScript error in use-websocket.ts left unfixed (out of scope)
metrics:
  duration_seconds: 114
  completed: 2026-04-16
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Quick Plan 01: Stitch Terminal Blue Design System Restyle Summary

Replace amber Bloomberg palette with Stitch "Complex Terminal Blue" blue palette and add persistent bottom status bar to root layout.

**One-liner:** Full design token replacement from amber HSL to blue hex (#2196F3) with zero-radius brutalism and terminal status bar.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Replace CSS custom properties with Stitch Terminal Blue palette | 12856e6 | Done |
| 2 | Add bottom status bar to root layout | eb47d64 | Done |

## What Changed

### Task 1: CSS Design Tokens (12856e6)
- Replaced all `:root` CSS custom properties from HSL amber values to hex Stitch blue values
- Primary color changed from `hsl(36 100% 50%)` (amber) to `#2196f3` (blue)
- Border radius set to `0px` for Precision Brutalism aesthetic
- Added 14 new surface tier tokens (`--surface-lowest` through `--on-surface-variant`)
- Added corresponding `--color-*` mappings in `@theme inline` block
- Added `input:focus` / `textarea:focus` style with 2px blue left-border
- Added `.milled-metal-btn` utility class with blue gradient
- Updated scrollbar color to match new palette

### Task 2: Root Layout Status Bar (eb47d64)
- Added fixed `h-6` bottom status bar with `SYSTEM_STABLE // LATENCY: 14MS` green indicator
- Added `API_DOCS`, `RULES`, `HELP_DESK` footer links with hover transitions
- Updated Toaster background to `#201f1f` and border to `#404752` (Stitch palette)
- Added `pb-6` body padding for status bar clearance

## Deviations from Plan

None - plan executed exactly as written.

## Known Issues (Pre-existing, Out of Scope)

- `client/src/hooks/use-websocket.ts:27` - TypeScript error: `useRef` called without initial argument (React 19 requires it). CSS compilation succeeds; this is a pre-existing TS issue unrelated to this plan.

## Known Stubs

None.

## Verification

- `grep -c "FF9500\|hsl(36\|amber" client/src/app/globals.css` returns 0 (no amber)
- `grep -c "#2196f3" client/src/app/globals.css` returns 9 (blue primary throughout)
- `grep "0px" client/src/app/globals.css` confirms `--radius: 0px`
- `grep -c "SYSTEM_STABLE" client/src/app/layout.tsx` returns 1 (status bar present)
- CSS compilation succeeds (Turbopack compiled in 5.1s)

## Self-Check: PASSED
