---
phase: 03-admin-portal
plan: 04
subsystem: admin-portal
tags: [news, broadcast, evaluations, admin-ui]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [news-injection-ui, broadcast-ui, evaluation-queue-ui]
  affects: [client/src/app/admin/news, client/src/app/admin/evaluations]
tech_stack:
  added: []
  patterns: [sonner-toast, websocket-subscription, zustand-store-integration]
key_files:
  created:
    - client/src/components/admin/news-form.tsx
  modified:
    - client/src/app/admin/news/page.tsx
    - client/src/app/admin/evaluations/page.tsx
decisions:
  - "D-05 implemented: broadcasts sent as news items on same channel"
  - "D-06 implemented: news form with headline, body, GLOBAL/LOCAL toggle, company multi-select"
  - "D-07 implemented: evaluations empty state with template preview card at 40% opacity"
  - "D-08 applied: scaled up text sizes (text-base body, text-sm labels), p-5 padding, py-3.5 buttons"
metrics:
  duration_seconds: 168
  completed: 2026-04-16T06:09:34Z
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 3 Plan 4: News & Evaluations Tabs Summary

News injection form with headline/body/type(GLOBAL/LOCAL)/company selector, broadcast channel on same feed (D-05), real-time news history via WebSocket, and evaluations empty state with disabled approve/edit/reject template card for Phase 5.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | News injection form and News tab page | 56542ec | news-form.tsx, news/page.tsx |
| 2 | Evaluations tab empty state UI | 5b73bdb | evaluations/page.tsx |

## Implementation Details

### Task 1: News Tab
- Created `NewsForm` component with 4 fields: headline input, body textarea, GLOBAL/LOCAL toggle buttons, and company ticker multi-select (only shown for LOCAL type)
- News page has side-by-side grid layout: injection form (col-span-7) and broadcast textarea (col-span-5)
- Broadcast section uses green button styling (bg-[#02c953]) to differentiate from news injection (bg-[#2196f3])
- NEWS_HISTORY section loads on mount via `api.getNewsHistory()` and updates via WebSocket `news_injected` events
- Each news item shows headline, source type chip (color-coded: blue for ADMIN_INJECTED, green for ADMIN_BROADCAST, gray for SYSTEM), timestamp, content, and affected ticker chips
- Form clears on successful submission, toast notifications for success/error

### Task 2: Evaluations Tab
- EVALUATION_QUEUE header with QUEUE_EMPTY status indicator
- Filter bar with ALL/PENDING/APPROVED/REJECTED toggle buttons (ALL active by default, non-functional filters)
- Empty state center content: ClipboardCheck icon, "NO PENDING EVALUATIONS" heading, descriptive subtext, dashed placeholder border
- Template preview card at 40% opacity with TEMPLATE_PREVIEW label showing the exact layout Phase 5 will use
- APPROVE (green), EDIT (blue), REJECT (red) buttons all rendered disabled with cursor-not-allowed

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all UI elements are intentionally non-functional where noted (evaluations buttons are explicitly for Phase 5 backend integration, documented in plan). News injection and broadcast are fully wired to API endpoints.

## Self-Check: PASSED
