# 04 — OHLCV & Market Snapshots

## 1. OHLCV Engine Architecture

The OHLCV Engine generates standardized candlestick intervals for all tracked markets and canonical tokens:

- **Supported Timeframes**: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`.
- **Candle State**:
  - `OPEN`: Actively forming candle in the current timeframe bucket. High, low, close, and volume update on every incoming swap.
  - `FINAL`: Closed interval bucket. Once sealed, a candle does not mutate unless late-arriving trade reconciliation occurs.

```typescript
export interface OhlcvCandle {
  marketId: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  timestamp: number; // Unix timestamp in seconds (bucket aligned)
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
  tradeCount: number;
  isFinal: boolean;
}
```

---

## 2. Late Trade Arrival & Candle Recalculation

Blockchain data or reorg reconciliation may deliver transactions out of order. The OHLCV Engine supports retroactive candle correction:

```text
[Late Trade Arrives: t = 14:02:15, price = $1.05]
                       │
                       ▼
       Identify Bucket: 14:00 - 14:05 (5m)
                       │
                       ▼
      Recalculate High = max(current_high, $1.05)
      Recalculate Low = min(current_low, $1.05)
      Update Volume += trade_volume
                       │
                       ▼
       Emit 'candle.corrected' Event
```

---

## 3. Market Snapshots & Token Market Snapshots

Periodic materialized snapshots provide sub-millisecond query response times for APIs without executing continuous aggregation queries.

### Snapshot Frequencies:
- `5s`: In-memory hot cache for live streaming.
- `1m`: Persisted snapshot in storage.
- `5m` & `1h`: Historical analytical archive.

### Valuation Formulas:
- **Market Cap**:
  $$\text{MarketCap} = \text{CirculatingSupply} \times P_{\text{canonical}}$$
- **Fully Diluted Valuation (FDV)**:
  $$\text{FDV} = \begin{cases} \text{MaxSupply} \times P_{\text{canonical}} & \text{if MaxSupply is valid} \\ \text{TotalSupply} \times P_{\text{canonical}} & \text{if TotalSupply is capped} \\ \text{null} & \text{if unbounded} \end{cases}$$

### Price Change Calculation:
$$\Delta P_w = \frac{P_{\text{current}} - P_{\text{previous}}}{P_{\text{previous}}} \times 100$$
(Handled with safe zero-division guards).
