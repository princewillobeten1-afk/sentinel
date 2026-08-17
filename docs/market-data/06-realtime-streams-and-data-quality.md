# 06 — Realtime Streams & Data Quality

## 1. WebSocket Streaming & Coalescing

Publishing every raw swap directly to connected WebSocket clients causes client-side thrashing and network overhead. The Realtime Publisher uses a 250ms batching/coalescing window:

```text
[Raw Swaps (50/sec)]
         │
         ▼
    Price Engine
         │
         ▼
[Coalescer (250ms)]
         │
         ▼
Broadcast 'market.price_updated' & 'token.market_data_updated'
```

### Channel Topics:
- `market.price_updated:${marketId}`
- `token.market_data_updated:${tokenId}`

### Reconnection Recovery:
When a WebSocket reconnects, the client requests the latest snapshot state and resumes the live differential stream.

---

## 2. Data Quality Engine (`MarketDataQualityService`)

Computes a dedicated `dataQualityScore` (0-100) and `dataConfidence` (0.0-1.0), distinct from risk or exitability scores:

```typescript
export interface MarketDataQualityReport {
  tokenId: string;
  dataQualityScore: number; // 0 - 100
  dataConfidence: number; // 0.0 - 1.0
  freshnessScore: number;
  marketCoverageScore: number;
  divergenceStatus: 'NORMAL' | 'WARNING' | 'ANOMALOUS';
  anomaliesDetected: Array<'LIQUIDITY_DROP' | 'VOLUME_SPIKE' | 'PRICE_DISCONNECT' | 'STALE_FEED'>;
  lastEvaluatedAt: string;
}
```
