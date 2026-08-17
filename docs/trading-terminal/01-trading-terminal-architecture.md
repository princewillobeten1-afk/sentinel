# 01 — Trading Terminal Architecture & Component Boundaries

## 1. Architectural Overview

The Sentinel Trading Terminal transforms canonical market-data into an intuitive, ultra-low-latency, professional desktop and mobile trading interface.

```text
┌────────────────────────────────────────────────────────────┐
│ TradingHeader (Logo, Global Search, Network, Wallet, Menu) │
├───────────────┬──────────────────────────────┬─────────────┤
│ TokenInfo     │                              │ Buy / Sell  │
│ MarketStats   │      TradingChart (OHLCV)    │ OrderPanel  │
│               │                              │             │
│               ├──────────────────────────────┤ (Slippage,  │
│ Watchlist /   │ TradeHistoryFeed /           │  Preview,   │
│ MarketCompare │ TransactionHistoryTable      │  Status)    │
└───────────────┴──────────────────────────────┴─────────────┘
```

## 2. Component Boundaries & Responsibilities

| Component | Responsibility | Data Source |
|---|---|---|
| `TradingHeader` | Global navigation, omnibox token search (`/`), network switching, wallet connection status | Global store, `TokenSearchEngine`, `WalletProvider` |
| `TokenIdentityHeader` | Token identity, symbol, verification badge, contract address copy, dynamic explorer link, watchlist toggle | `TokenDiscoveryPipeline`, `WatchlistService` |
| `MarketStats` | Market Cap, FDV, 24h Volume, Total Liquidity, Holders, Pool Age | `SnapshotEngine`, `MarketDataQualityService` |
| `TradingChart` | Multi-interval candlestick/line chart, volume histogram overlay, realtime trade tick updates | `OhlcvEngine`, WebSocket `market.price_updated` |
| `MarketComparisonTable` | Multi-market pool comparison, price/liquidity/volume share, Primary Market badge | `CanonicalMarketRegistry`, `PriceEngine` |
| `OrderPanel` | Buy/Sell tabs, amount inputs, balance display, slippage controls, quote refresh, transaction trigger | `QuoteService`, `WalletProvider`, `ExecutionService` |
| `TradeHistoryFeed` | Realtime public trade feed with buy/sell coloring and large trade indicators | `VolumeEngine`, WebSocket `market.trade` |
| `TransactionHistoryTable` | User-specific transactions with lifecycle status and block explorer links | `TransactionStateMachine`, `DbWalletTransaction` |

## 3. Responsive Layout Strategy

- **Desktop (>= 1280px)**: 3-column layout (Token Info & Market Stats on left, Chart & Trades in center, Order Panel on right).
- **Laptop / Tablet (768px - 1279px)**: 2-column layout (Chart & Trades on left, Order Panel & Token Info on right).
- **Mobile (< 768px)**: Stacked single-column view with bottom-sheet order panel modal triggered via sticky `BUY / SELL` CTA buttons.
