---
phase: quick
plan: 02
subsystem: frontend-auth
tags: [ui, auth, restyle, stitch-terminal-blue]
dependency_graph:
  requires: [quick-01]
  provides: [restyled-auth-pages]
  affects: [client/src/app/auth, client/src/app/admin/login]
tech_stack:
  added: []
  patterns:
    [
      terminal-field-labels,
      milled-metal-gradient,
      split-layout,
      red-admin-accent,
    ]
key_files:
  created: []
  modified:
    - client/src/app/auth/register/page.tsx
    - client/src/app/auth/login/page.tsx
    - client/src/app/admin/login/page.tsx
decisions:
  - Used native HTML elements instead of shadcn components for direct Tailwind control
  - Admin login uses red accent (#FF1744) to differentiate from team blue (#2196f3)
metrics:
  duration: 313s
  completed: 2026-04-16T05:20:56Z
  tasks_completed: 3
  tasks_total: 3
---

# Quick Plan 02: Auth Pages Stitch Terminal Blue Restyle Summary

Restyled three auth pages (register, login, admin login) to match Stitch Complex Terminal Blue design with terminal mono labels, sharp corners, and precision brutalism aesthetic.

## Task Results

| Task | Name                                                      | Commit  | Files                                 |
| ---- | --------------------------------------------------------- | ------- | ------------------------------------- |
| 1    | Restyle register page to Stitch terminal design           | a8eb544 | client/src/app/auth/register/page.tsx |
| 2    | Restyle login page to Stitch split-layout terminal design | 156a3dd | client/src/app/auth/login/page.tsx    |
| 3    | Restyle admin login page to Stitch terminal design        | 4e25ba5 | client/src/app/admin/login/page.tsx   |

## What Was Done

### Register Page (Task 1)

- Removed shadcn Card, CardContent, Button, Input, Label imports
- Added fixed header bar with COMPLEX branding and SYSTEM_STABLE status
- Card with blue top strip, NEW_ENTITY_REGISTRATION heading
- Four fields with terminal labels: FIELD_01 // TEAM_NAME, FIELD_02 // TICKER_SYMBOL, FIELD_03 // AUTH_EMAIL, FIELD_04 // ACCESS_KEY
- Ticker field has green mono text with [3-5_CHARS] hint
- Milled-metal gradient CTA button
- Execute_Login link and ENCRYPTION_LAYER_AES256 footer decoration
- All form validation (registerSchema, validateField, handleChange, handleBlur, getFieldError) preserved exactly

### Login Page (Task 2)

- Removed shadcn Card, CardContent, Button, Input, Label imports
- Split layout: left branding panel (lg:col-span-5) with COMPLEX ARCHITECTURE heading, system status (OPERATIONAL, 99.98% UPTIME), latency/nodes metrics
- Right login form panel (lg:col-span-7) with Initialize Session heading
- Strategist/Trader segmented toggle in blue (#2196f3)
- Terminal-styled inputs with border-left-2 focus indicator
- Register New Agent link
- All auth logic (loginSchema, storeLogin, useEffect redirect, role state) preserved exactly

### Admin Login Page (Task 3)

- Removed shadcn Card, CardContent, Button, Input, Label imports
- Red top strip (#FF1744) for admin visual differentiation
- ADMIN_ACCESS heading with ELEVATED_PRIVILEGES // ROOT_GATE subtitle
- Red field labels (AUTH_EMAIL, ACCESS_KEY) and red focus border
- Red submit button with "Access Control Panel" text
- Red-tinted footer decoration dots
- Header shows ADMIN_ACCESS_PORTAL status
- All validation (adminLoginSchema, validateField, handleSubmit, Zustand adminLogin) preserved exactly

## Deviations from Plan

None - plan executed exactly as written.

## Notes

- Pre-existing TypeScript error in client/src/app/admin/market/page.tsx (`api.injectNews` not in ApiClient type) prevents full `next build` from passing. This is unrelated to auth page changes -- our three files compile without errors.
- No shadcn component imports remain in any of the three auth pages.
