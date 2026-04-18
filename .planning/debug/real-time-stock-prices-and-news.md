---
status: investigating
slug: real-time-stock-prices-and-news
trigger: |
  1. World events not appearing in Market/news UI (need admin delete too)
  2. Stock charts not reflecting real-time prices - not updating live
  3. Price inconsistency - Market view shows different prices than Trading platform
  4. Chart state lost when switching between companies
created: 2026-04-18
updated: 2026-04-18
---

# Real-Time Stock Prices & News Debug

## Symptoms

- **Expected:** 
  - World events/news appear in Market UI and can be deleted from admin
  - Stock prices update in real-time via WebSocket
  - Same prices shown in Market and Trading views
  - Chart maintains state when switching between companies
- **Actual:** 
  - News not appearing in UI
  - Prices not updating live
  - Inconsistent prices between views
  - Chart loses state on company switch
- **Errors:** None specific
- **Timeline:** Unknown when this broke
- **Reproduction:** Navigate to Market, select different company, observe prices not updating

## Scope

**Investigate:**
1. News generation flow: `generate_news.py` → API → UI
2. Price tick flow: Celery tick → SimulationService → Redis → WebSocket → Client
3. Price display: Market API vs Trading API vs client stores
4. Chart state: Zustand store persistence on company switch

## Current Focus

**Hypothesis:** 
**Next action:** gather initial evidence