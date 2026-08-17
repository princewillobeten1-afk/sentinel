# 05 — Token Detail & Trading Experience

## 1. Token Detail Route (`/tokens/:tokenId`)

The token detail page serves as the comprehensive control hub for token evaluation and trading.

### Key Sections
1. **Token Identity Header**:
   - Token logo, name, symbol, and chain badge.
   - Verification status badge (`VERIFIED`, `UNVERIFIED`, `SUSPICIOUS`).
   - Contract address with copy-to-clipboard and dynamic blockchain explorer links.
   - Watchlist toggle button.
2. **Price & Data Freshness Bar**:
   - Current canonical price and multi-timeframe price changes (1m, 5m, 1h, 24h, 7d).
   - Realtime freshness indicator (flags "Data delayed" if market feeds become stale).
3. **Interactive Trading Chart**:
   - Candlestick / Line / Area views with timeframes: `1m`, `5m`, `15m`, `1h`, `4h`, `1D`, `1W`.
   - Volume histogram overlay.
   - Realtime active candle updates from WebSocket trade ticks.
4. **Multi-Market Comparison Table**:
   - Detailed breakdown of all DEX pools trading the token.
   - Identifies the canonical "Primary Market".
   - Shows pool liquidity, price, 24h volume share, and spread.
5. **Trade & Transaction History Tabs**:
   - Public live trade feed with buy/sell coloring and large trade indicators.
   - User's own transaction history for the active token.
6. **Order Panel**:
   - Buy / Sell tabs with market execution flow, slippage settings, price impact alerts, and confirmation modals.
