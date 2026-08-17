# 07 — API Reference & Storage Architecture

## 1. REST API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/markets` | `GET` | List tracked markets with chain, protocol, and status filters |
| `/api/v1/markets/:id` | `GET` | Get single market details, reserve state, and fee info |
| `/api/v1/markets/:id/price` | `GET` | Get current market price, confidence, and divergence status |
| `/api/v1/markets/:id/ohlcv` | `GET` | Get market candlestick data with interval (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`) |
| `/api/v1/tokens/:id/markets` | `GET` | List all trading pools for a given token ($1 \text{ Token} \rightarrow N \text{ Markets}$) |
| `/api/v1/tokens/:id/market-data`| `GET` | Canonical token summary (price, 24h %, volume, liquidity, mcap, FDV, confidence) |
| `/api/v1/tokens/:id/ohlcv` | `GET` | Aggregated canonical token candlestick series |
| `/api/v1/tokens/search` | `GET` | Multi-tier token search with cursor pagination |
| `/api/v1/tokens/new` | `GET` | Chronological new tokens feed with quality filters |
| `/api/v1/tokens/trending` | `GET` | Top trending tokens with transparent momentum score breakdown |
| `/api/v1/tokens/gainers` | `GET` | Top gainers across 1h, 6h, 24h windows |
| `/api/v1/tokens/losers` | `GET` | Top losers across 1h, 6h, 24h windows |
| `/api/v1/tokens/liquid` | `GET` | Most liquid tokens sorted by validated USD depth |
| `/api/v1/tokens/volume` | `GET` | Highest volume tokens across configurable windows |

---

## 2. Storage & Index Design

```sql
CREATE INDEX idx_markets_identity ON markets (chain_id, protocol, address);
CREATE INDEX idx_markets_base_quote ON markets (base_token_id, quote_token_id);
CREATE INDEX idx_market_snapshots_ts ON market_snapshots (market_id, timestamp DESC);
CREATE INDEX idx_token_snapshots_ts ON token_market_snapshots (token_id, timestamp DESC);
CREATE INDEX idx_ohlcv_lookup ON ohlcv_candles (market_id, interval, timestamp DESC);
CREATE INDEX idx_tokens_status_created ON tokens (status, created_at DESC);
CREATE INDEX idx_tokens_symbol ON tokens (symbol);
CREATE INDEX idx_tokens_name ON tokens (name);
```
