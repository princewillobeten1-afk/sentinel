# 10 — Portfolio, Order Management & Smart Alerts (Sprint 34 §47-56)

## 1. Portfolio & Net P&L Engine (`lib/portfolio/`)
- **Multi-Wallet Aggregation**: Aggregates balances, active token positions, and historical executions across all connected user wallets.
- **Fixed-Point P&L Computation (`lib/math/decimal.ts`)**:
  - `Realized P&L`: Calculated on position close using FIFO cost-basis allocation.
  - `Unrealized P&L`: `(Current Price - Cost Basis) * Current Position Size`.
  - `Net P&L`: Deducts exchange swap fees, compute unit gas costs, and priority tips from gross profit.

---

## 2. Order Management System (OMS) & Trigger Engines (`lib/order/`)

```text
User Limit / Stop-Loss Order
             │
             ▼
Order Management Store (`lib/order/`)
             │ (State: CREATED -> VALIDATED -> SUBMITTED -> FILLED / CANCELLED)
             ▼
Market Price & Condition Watcher
             │ (Evaluates tick stream against target limit & stop triggers)
             ▼
Execution Dispatcher (`lib/execution/router.ts`)
```

- **Trigger Safety**: Before submitting a triggered limit/stop-loss order, the engine re-evaluates user balance, token exitability, and maximum slippage bounds.

---

## 3. Copy Trading Architecture (`lib/copy/`)

```text
Target Leader Wallet
         │
         ▼
On-Chain Activity Detector (`lib/activity/`)
         │ (Listens for confirmed swaps via Event Bus)
         ▼
Copy Trade Rule Engine (`lib/security/approval-risk.ts`)
         │ (Filters: Max copy size, Token risk score < 70, Slippage < 1.5%)
         ▼
Follower Order Generator
         │
         ▼
Preflight Simulation & Swap Broadcast
```
- **Anti-Drain Protection**: Never blindly copies every transaction. If a leader wallet performs a suspected rug/drain action (e.g. dumping into an unverified pool), the copy rule engine halts execution immediately.

---

## 4. Smart Alerts & Notification Router (`lib/alert/`)
- **Alert Rule Engine**: Continuously evaluates user-defined triggers (Price targets, % changes in 5m, Whale buy/sell > $10,000, Cluster accumulation alerts).
- **Multi-Channel Dispatch**:
  - `In-App`: Real-time WebSocket event banner.
  - `Push Notifications`: Web Push via Service Worker.
  - `External Webhooks`: Telegram Bot API, Discord Webhooks, Custom HTTP endpoints with HMAC-SHA256 signatures (`lib/webhooks/signing.ts`).
