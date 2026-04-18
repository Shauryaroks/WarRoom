# Phase 7: Archetypes & Sample Portfolios - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the archetype system: data model for archetypes with benchmark bands, admin CRUD for creating/editing/assigning archetypes to teams, 4 pre-built dossiers based on the Bharat Bites spec, and game view display of archetype identity.

</domain>

<decisions>
## Implementation Decisions

### Archetype Data Model

- **D-01:** Separate `Archetype` table in PostgreSQL (not JSON config). Fields: id, name, slug, description, sector (FOODS/BEVERAGES), dossier_content (Markdown text — the full archetype dossier), benchmark_bands (JSON with {market_share_min, market_share_max, margin_min, margin_max, growth_min, growth_max, ops_min, ops_max}), starting_cash (Decimal), starting_stock_price (Decimal), starting_shares (Integer), swot_strengths (Text), swot_weaknesses (Text), swot_opportunities (Text), swot_threats (Text), real_world_inspiration (String), created_at, updated_at.
- **D-02:** Team model gets a `archetype_id` FK to `Archetype`. When admin assigns an archetype, it populates team's starting financials (cash, stock_price, shares) from the archetype defaults. The caseline_document is auto-filled from the archetype's dossier_content.
- **D-03:** Benchmark bands stored as JSON on the Archetype: `{"market_share": [min, max], "margin": [min, max], "growth": [min, max], "ops_efficiency": [min, max]}`. The simulation engine (Phase 9) will score teams relative to these bands.

### 4 Pre-Built Dossiers (based on Bharat Bites spec)

- **D-04:** Create 4 archetypes matching the caseline spec:
  1. **Legacy Giant** (inspired by Swaad Foods / Parle / Britannia): High share (20-25%), low margin (10-14%), cash-rich, slow growth (4-8%), best-in-class distribution reach. Starting cash: ₹400 Cr, stock: ₹100, shares: 1M.
  2. **D2C Challenger** (inspired by NibbleBox / Open Secret): Low share (1-3%), negative-to-low margin (-5 to 10%), burning cash, explosive growth (60-100%), unit economics trending up. Starting cash: ₹25 Cr, stock: ₹100, shares: 1M.
  3. **Regional Leader** (inspired by Chatpata / Balaji Wafers): Medium regional share (12-16%), healthy margin (14-18%), lean ops, moderate growth (10-15%). Starting cash: ₹150 Cr, stock: ₹100, shares: 1M.
  4. **Premium Niche** (inspired by Himalaya Crunch / Too Yumm): Low share (2-5%), high margin (22-30%), urban-only, high growth (20-35%), selective distribution depth. Starting cash: ₹80 Cr, stock: ₹100, shares: 1M.
- **D-05:** Each dossier includes: company name, archetype description, balance sheet summary, cost structure, SWOT analysis, benchmark bands, real-world inspiration note, and a strategic context paragraph. Written as Markdown.

### Admin UX

- **D-06:** New "Archetypes" section in the admin Teams tab. When assigning a caseline to a team:
  - Dropdown selector showing available archetypes (Legacy Giant, D2C Challenger, etc.)
  - On selection: auto-fills the team's caseline document, starting cash, stock price, company display name from the archetype
  - Admin can still edit the caseline after assignment (archetype is the starting template, not locked)
- **D-07:** Admin can also create custom archetypes via a "Create Archetype" form in Settings tab — for competitions beyond the 4 pre-built ones.
- **D-08:** Archetype assignment only works in SETUP phase (before game starts). During active game, archetype is locked.

### Game View Display

- **D-09:** Team's Caseline Panel shows archetype identity at the top: archetype name badge + sector tag + "Your benchmark: [market share range], [margin range]" summary. Below that: the full dossier content rendered as Markdown.

</decisions>

<canonical_refs>

## Canonical References

### Project Context

- `.planning/PROJECT.md` — v2.0 milestone goals
- `.planning/REQUIREMENTS.md` — ARCH-01, ARCH-02, PORT-01
- `.planning/CASELINE_SPEC.md` — Full Bharat Bites & Brews competition model

### Existing Code

- `server/app/models.py` — Team model (caseline_document, company_display_name, cash, stock_price)
- `server/app/api/admin.py` — Admin endpoints, caseline assignment
- `client/src/app/admin/teams/page.tsx` — Teams management, caseline editor
- `client/src/components/game/CaselinePanel.tsx` — Caseline display

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Team model already has caseline fields — extend with archetype_id FK
- Admin caseline assignment UI — extend with archetype dropdown
- CaselinePanel — extend with archetype badge and benchmark display
- Alembic migration pattern established

### Integration Points

- New Archetype table + migration
- Team.archetype_id FK
- Admin API: CRUD for archetypes, assign to team
- Seed 4 pre-built archetypes on first run or via admin endpoint

</code_context>

<specifics>
## Specific Ideas

- Pre-built dossiers should feel like real FMCG company profiles
- Benchmark bands are the foundation for Phase 9's archetype-relative scoring
- Admin should be able to run a competition with just the 4 built-in archetypes or create custom ones

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 07-archetypes-and-sample-portfolios_
_Context gathered: 2026-04-16_
