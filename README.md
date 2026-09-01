# Malkan Strategy Dashboard

A rule-based technical-analysis dashboard inspired by the publicly documented Malkan GFS framework. The UI is built to make every candidate explainable rather than presenting opaque buy/sell calls.

## Current MVP

- Market overview and top-down sector view
- GFS scanner with Monthly / Weekly / Daily RSI columns
- Setup types: Regular GFS, Small Candle GFS, Double Bottom GFS, First GFS + CIP and Breakout
- Status lifecycle: Forming, Ready, Triggered, Failed
- Relative-volume and CIP indicators
- Setup score and risk/reward
- Stock detail modal with evidence, trade-plan levels and an illustrative structure chart
- Search and status/sector filters
- Watchlist interaction
- Responsive desktop/mobile layout
- Configurable GFS rule engine in `lib/malkan-engine.ts`

## Important

The current UI uses **seeded demo data**. It is intentionally labelled as research mode. No live market-data provider or broker execution is connected yet, and no displayed signal should be treated as investment advice.

## Next production steps

1. Select and connect a licensed NSE/Indian market-data provider.
2. Store OHLCV history in PostgreSQL/Supabase.
3. Build candle-level detectors for consolidation, CIP, first-GFS, touch-and-go, double-bottom and breakout patterns.
4. Run the rule engine against historical data and add a reproducible backtest service.
5. Add scheduled daily scans, signal persistence and alert delivery.
6. Add TradingView Lightweight Charts or another licensed charting solution for real OHLCV candles.
7. Add authentication, user-specific watchlists and production observability.

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Type-check with:

```bash
npm run typecheck
```
