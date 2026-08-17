# 06 — Token Discovery Page & Watchlists

## 1. Discovery Route (`/discover`)

The Discovery page enables users to explore tokens across 6 primary discovery categories:
- **Trending**: Ranked by multi-factor momentum score.
- **New Tokens**: Chronological feed with liquidity and volume quality filters.
- **Top Gainers**: Highest percentage gains across 1h, 6h, and 24h.
- **Top Losers**: Largest pullbacks across 1h, 6h, and 24h.
- **Most Liquid**: Ranked by total USD liquidity depth.
- **Highest Volume**: Ranked by 24h DEX trading volume.

## 2. Filter Matrix

Users can filter discovery lists by:
- Blockchain network (`solana`, `ethereum`, `base`).
- Minimum liquidity (e.g. > $10K, > $50K, > $250K).
- Minimum 24h volume (e.g. > $5K, > $50K, > $500K).
- Market age / creation recency.

## 3. Watchlist Persistence

The `WatchlistService` persists user watchlist entries to their server account, ensuring synchronization across sessions and devices while maintaining realtime price update feeds.
