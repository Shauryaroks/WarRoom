---
phase: 01-foundation-auth-and-base-ui
plan: 02
subsystem: ui
tags: [nextjs, tailwind, shadcn, zustand, zod, bloomberg-theme, fonts]

# Dependency graph
requires: []
provides:
  - "Next.js 16 frontend scaffold with Turbopack"
  - "Bloomberg Terminal dark theme CSS tokens"
  - "shadcn/ui component library (button, input, label, card, badge, separator, sonner)"
  - "Inter + JetBrains Mono font loading via next/font"
  - "Zustand, Zod, lucide-react installed"
  - "font-data utility class for tabular numeric display"
affects: [01-03, 01-04, 01-05, 01-06, ui, game, admin]

# Tech tracking
tech-stack:
  added: [next@16.2.3, react@19.2.4, zustand@5.0.12, zod, lucide-react, sonner, shadcn, tailwind@4, class-variance-authority, clsx, tailwind-merge, tw-animate-css, next-themes]
  patterns: [tailwind-v4-postcss, shadcn-v4-base-nova, dark-only-theme, next-font-google-variables]

key-files:
  created:
    - client/package.json
    - client/components.json
    - client/src/components/ui/button.tsx
    - client/src/components/ui/input.tsx
    - client/src/components/ui/label.tsx
    - client/src/components/ui/card.tsx
    - client/src/components/ui/badge.tsx
    - client/src/components/ui/separator.tsx
    - client/src/components/ui/sonner.tsx
    - client/src/lib/utils.ts
  modified:
    - client/src/app/globals.css
    - client/src/app/layout.tsx
    - client/src/app/page.tsx

key-decisions:
  - "Used shadcn v4 base-nova style with @base-ui/react primitives (shadcn default for Next.js 16)"
  - "Dark-only theme -- no light mode, :root contains Bloomberg dark colors directly"
  - "HSL color values in CSS variables for consistency with UI-SPEC"
  - "font-mono CSS variable maps to JetBrains Mono via next/font/google variable property"

patterns-established:
  - "Color tokens: Bloomberg amber (hsl 36 100% 50%) as primary/accent/ring"
  - "Font loading: Inter as --font-sans, JetBrains Mono as --font-mono via next/font/google"
  - "Component imports: shadcn components at @/components/ui/*"
  - "Utility function: cn() from @/lib/utils for className merging"
  - "Dark theme: className='dark' on html element, no theme switching"

requirements-completed: [UI-01, INFRA-02]

# Metrics
duration: 6min
completed: 2026-04-16
---

# Phase 1 Plan 2: Frontend Scaffold Summary

**Next.js 16 scaffold with Bloomberg Terminal dark theme, shadcn/ui components, Inter + JetBrains Mono fonts, and Zustand/Zod/lucide-react dependencies**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-15T23:01:13Z
- **Completed:** 2026-04-15T23:07:28Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Next.js 16.2.3 project scaffolded with Turbopack, App Router, TypeScript, and Tailwind v4
- Bloomberg Terminal dark theme with amber primary, custom color tokens matching UI-SPEC
- shadcn/ui initialized with 7 Phase 1 components (button, input, label, card, badge, separator, sonner)
- Inter and JetBrains Mono fonts loaded via next/font/google with CSS variable assignment
- Sonner toast provider configured with dark theme styling

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js project and install dependencies** - `e749825` (feat)
2. **Task 2: Configure Bloomberg dark theme, fonts, and root layout** - `d1b5868` (feat)

## Files Created/Modified
- `client/package.json` - Next.js 16 project with all Phase 1 dependencies
- `client/components.json` - shadcn/ui configuration (base-nova style, neutral base color)
- `client/src/app/globals.css` - Bloomberg dark theme CSS tokens, font-data utility, scrollbar styles
- `client/src/app/layout.tsx` - Root layout with Inter + JetBrains Mono fonts, dark class, Toaster
- `client/src/app/page.tsx` - Minimal dark-themed COMPLEX placeholder
- `client/src/lib/utils.ts` - cn() utility for className merging (clsx + tailwind-merge)
- `client/src/components/ui/*.tsx` - 7 shadcn components (button, input, label, card, badge, separator, sonner)

## Decisions Made
- Used shadcn v4 with base-nova style (shadcn's current default for Next.js 16), which uses @base-ui/react primitives instead of Radix
- Dark-only theme with :root containing Bloomberg colors directly (no .dark/.light toggle needed)
- HSL function format for CSS variables (e.g., `hsl(36 100% 50%)`) rather than bare HSL or oklch -- works with Tailwind v4's direct color resolution
- Kept font-mono CSS variable name as `--font-mono` to align with Tailwind v4 theme integration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend foundation complete with all design tokens, fonts, and component library
- Auth pages (01-03) can build on this scaffold immediately
- All shadcn components available for form construction
- Build passes cleanly with `npm run build`

## Self-Check: PASSED

All created files verified present. Both task commits (e749825, d1b5868) verified in git log.

---
*Phase: 01-foundation-auth-and-base-ui*
*Completed: 2026-04-16*
