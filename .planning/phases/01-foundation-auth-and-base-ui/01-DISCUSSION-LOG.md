# Phase 1: Foundation, Auth, and Base UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 01-foundation-auth-and-base-ui
**Areas discussed:** Sub-account model, Session & auth flow, Schema approach, Bloomberg scaffold

---

## Sub-account Model

| Option | Description | Selected |
|--------|-------------|----------|
| Separate User table | Team has two User rows (one per role). Each User has their own email/password. | |
| Team + role field | Single Team table with two sets of credentials. Simpler schema, fewer joins. | ✓ |
| You decide | Claude picks the best approach | |

**User's choice:** Team + role field
**Notes:** Simpler schema preferred. Single table with dual credential fields.

| Option | Description | Selected |
|--------|-------------|----------|
| Register once, get both | Team registers with one form. System generates both logins. | ✓ |
| Register team, then invite | Team admin registers, then creates/invites the second sub-account. | |
| Two separate signups | Each sub-account registers independently and gets linked. | |

**User's choice:** Register once, get both
**Notes:** Simpler UX — one registration creates both sub-accounts.

---

## Session & Auth Flow

| Option | Description | Selected |
|--------|-------------|----------|
| httpOnly cookies | Secure against XSS, needs CSRF for cross-origin. | |
| localStorage + header | Simpler cross-origin, acceptable for competition app. | |
| You decide | Claude picks based on Vercel + Docker architecture | ✓ |

**User's choice:** You decide (Claude's discretion)
**Notes:** Claude should consider CORS implications of Vercel frontend + Docker backend.

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated admin login | Admin has their own email/password, separate login page. | ✓ |
| Keep API key | Admin uses secret key in header. | |
| Environment flag | Admin is a special team with is_admin flag. | |

**User's choice:** Dedicated admin login
**Notes:** Separate from teams entirely.

---

## Schema Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh schema | Design from scratch. Clean slate. | |
| Evolve existing | Keep existing models, add sub-account fields, fix issues. | ✓ |
| You decide | Claude evaluates quality and decides. | |

**User's choice:** Evolve existing
**Notes:** Build on existing Team, Transaction, Directive models.

| Option | Description | Selected |
|--------|-------------|----------|
| Single initial migration | One clean migration for full v2 schema. Old migrations discarded. | ✓ |
| Keep migration history | Build on top of existing migrations. | |

**User's choice:** Single initial migration
**Notes:** Clean break for the revamp.

---

## Bloomberg Scaffold

| Option | Description | Selected |
|--------|-------------|----------|
| Design system only | Colors, fonts, tokens. Auth/lobby styled. Game layout in Phase 3+. | |
| Full skeleton | Design system + empty game page shell with panel layout. | |
| Stitch-first | Wait for Stitch MCP designs, implement what Stitch produces. | ✓ (modified) |

**User's choice:** Use Stitch MCP designs as reference. Follow Stitch theme for anything Stitch doesn't cover.
**Notes:** Stitch has been connected. User set up Stitch MCP before this discussion.

| Option | Description | Selected |
|--------|-------------|----------|
| Pure Tailwind | Custom components, full control. More work. | |
| shadcn/ui + Tailwind | shadcn for base, customized with Bloomberg theme. | |
| You decide | Claude picks based on density requirements. | ✓ |

**User's choice:** You decide (Claude's discretion)
**Notes:** Claude should consider Bloomberg terminal density requirements.

---

## Claude's Discretion

- Token storage strategy (httpOnly cookies vs localStorage)
- Component library choice (pure Tailwind vs shadcn/ui)

## Deferred Ideas

None — discussion stayed within phase scope.
