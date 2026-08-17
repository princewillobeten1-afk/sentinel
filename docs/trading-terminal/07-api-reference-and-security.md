# 07 — REST API Reference & Security Standards

## 1. REST API Endpoints

### Tokens
- `GET /api/v1/tokens/:id` — Retrieve full token profile, supply metrics, and verification status.
- `GET /api/v1/tokens/:id/trades` — Retrieve recent live trade events for a token.
- `GET /api/v1/tokens/:id/transactions` — Retrieve blockchain transactions for a token.
- `GET /api/v1/tokens/:id/ohlcv` — Retrieve OHLCV candlestick series for a token.

### Trading & Orders
- `GET /api/v1/quotes` — Compute authoritative swap quote with 15-second TTL.
- `POST /api/v1/orders/preview` — Generate detailed transaction preview and route breakdown.
- `POST /api/v1/orders/simulate` — Execute pre-flight simulation before requesting wallet signature.

### Watchlist
- `GET /api/v1/watchlist` — Retrieve watchlisted tokens for the authenticated user.
- `POST /api/v1/watchlist` — Add or remove a token from the watchlist.

## 2. Anti-Tampering & Security Safeguards

1. **Authoritative Server Math**: The backend never accepts client-provided `outputAmount`, `priceImpact`, or `minimumReceived` as final values. All calculations are strictly re-verified.
2. **Quote Signatures & Expiration**: Quotes are cryptographically tagged with an expiration timestamp (`expiresAt`). Attempting to sign an expired quote is rejected.
3. **Simulation Requirement**: High-value transactions must successfully complete simulation before the wallet signature prompt is opened.
