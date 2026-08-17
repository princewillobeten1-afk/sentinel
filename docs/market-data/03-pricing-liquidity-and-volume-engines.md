# 03 — Pricing, Liquidity & Volume Engines

## 1. Price Engine (`PriceEngine`)

The Price Engine is responsible for converting raw pool reserve ratios into normalized USD prices and aggregating multi-market prices into a canonical token price.

### Market Price Calculation (CPMM & Concentrated)
- **CPMM ($x \cdot y = k$)**:
  $$P_{\text{base}} = \frac{R_{\text{quote}}}{R_{\text{base}}} \times 10^{(\text{decimals}_{\text{base}} - \text{decimals}_{\text{quote}})} \times P_{\text{quote\_usd}}$$
- **Concentrated Liquidity ($\sqrt{P}$)**:
  $$P = \left(\frac{\sqrt{P}_{\text{raw}}}{2^{64}}\right)^2 \times 10^{(\text{decimals}_{\text{base}} - \text{decimals}_{\text{quote}})} \times P_{\text{quote\_usd}}$$

---

## 2. Multi-Market Price Aggregation

When a token trades across multiple pools:
```text
Market A (Raydium)  → $1.01 (Liquidity: $2,000,000, 24h Vol: $10,000,000)
Market B (Orca)     → $1.02 (Liquidity: $500,000,   24h Vol: $1,200,000)
Market C (Illiquid) → $0.75 (Liquidity: $400,       24h Vol: $50)
```

The canonical token price uses a **liquidity and volume-weighted quality aggregation** algorithm with outlier filtering:

$$\text{Weight}_i = \ln(1 + \text{Liquidity}_i) \times \sqrt{\text{Volume}_i + 1} \times \text{QualityScore}_i$$
$$P_{\text{canonical}} = \frac{\sum P_i \times \text{Weight}_i}{\sum \text{Weight}_i}$$

A tiny illiquid pool ($400 liquidity) receives negligible weight and cannot distort the token price.

---

## 3. Stale Price & Price Divergence Detection

### Stale Price Detection:
If no swaps or reserve sync events occur on a market within a configurable threshold (default: 180s for active, 600s for secondary):
$$\text{marketPrice.status} = \text{STALE}$$

### Price Divergence Detection:
If the price between two major markets exceeds threshold $\delta > 5\%$:
$$\text{Divergence State} = \begin{cases} \text{NORMAL} & \text{if } \delta \le 2\% \\ \text{WARNING} & \text{if } 2\% < \delta \le 5\% \\ \text{ANOMALOUS} & \text{if } \delta > 5\% \end{cases}$$

---

## 4. Liquidity Engine (`LiquidityEngine`)

Computes base and quote reserve valuations in USD.

$$\text{Market Liquidity USD} = (R_{\text{base}} \times P_{\text{base\_usd}}) + (R_{\text{quote}} \times P_{\text{quote\_usd}})$$

### Token Aggregate Liquidity:
$$\text{Token Liquidity USD} = \sum_{m \in \text{VerifiedMarkets}} \text{MarketLiquidityUSD}_m$$

### Liquidity Anomaly Detection:
Flags sudden liquidity pulls ($\Delta \text{Liquidity} < -40\%$ within 15 minutes).

---

## 5. Volume Engine (`VolumeEngine`)

Maintains rolling volume windows and decomposes volume into buys vs sells:

- **Windows**: `5m`, `15m`, `1h`, `6h`, `24h`.
- **Metrics**: `volumeUsd`, `buyVolumeUsd`, `sellVolumeUsd`, `tradeCount`, `buyCount`, `sellCount`.
- **Deduplication**: Enforces idempotency via deterministic hash:
  $$\text{EventId} = \text{SHA256}(\text{txHash} + \text{logIndex} + \text{marketAddress})$$
