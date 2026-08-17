# 05 — Token Search & Ranking Engine

## 1. Token Search Engine

Token search implements a tiered match scoring algorithm to ensure relevant tokens appear first:

### Ranking Hierarchy:
1. **Tier 1: Exact Symbol Match** (e.g. `SOL` $\rightarrow$ Solana native mint)
2. **Tier 2: Exact Address Match** (Mint address exact string)
3. **Tier 3: Exact Name Match** (e.g. "Solana")
4. **Tier 4: Prefix Symbol Match** (e.g. `SOL` matches `SOLM`, `SOLAR`)
5. **Tier 5: Partial Substring Match** (Matches anywhere in name or symbol)
6. **Tier 6: Volume / Liquidity Tie-Breaker** (Higher volume tokens rank above zero-volume tokens)

---

## 2. Generic Ranking Engine (`RankingEngine`)

A unified framework for computing all platform leaderboards without redundant queries:

- **Top Gainers (`/api/v1/tokens/gainers`)**: Sorted by $\Delta P$ (1h, 6h, 24h) where Liquidity $> \$10,000$.
- **Top Losers (`/api/v1/tokens/losers`)**: Sorted by $-\Delta P$ where Liquidity $> \$10,000$.
- **Most Liquid (`/api/v1/tokens/liquid`)**: Sorted by total aggregated USD liquidity.
- **Highest Volume (`/api/v1/tokens/volume`)**: Sorted by chosen window (5m, 1h, 24h).
- **New Tokens Feed (`/api/v1/tokens/new`)**: Sorted by `firstSeenAt` / discovery timestamp.

---

## 3. Trending Tokens Algorithm & Transparency

Trending is not simply "highest volume". It uses a multi-factor momentum score:

$$\text{TrendScore} = w_1 \cdot \text{VolMomentum} + w_2 \cdot \text{PriceMomentum} + w_3 \cdot \text{TraderActivity} + w_4 \cdot \text{LiquidityFactor}$$

### Formula Components:
- **Volume Momentum**: Ratio of $\text{Volume}_{1\text{h}}$ to $(\text{Volume}_{24\text{h}} / 24)$.
- **Price Momentum**: Positive acceleration $\Delta P_{1\text{h}} / \Delta P_{24\text{h}}$.
- **Trader Activity**: Unique active wallets interacting in the last 1 hour.
- **Liquidity Factor**: $\log_{10}(\text{LiquidityUSD})$ to ensure minimum base depth.

### Transparency Metadata:
Every trending response includes the underlying factors so the UI can answer: *"Why is this token trending?"*
