# 02 — Frontend & Client Architecture (Sprint 34 §4-9)

## 1. Domain-Driven Layout
The frontend is built with **Next.js (App Router)**, **React 19**, and **TypeScript**, organized strictly by feature domain rather than unstructured component folders:

```text
src/
├── app/                      # Next.js route handlers & page entrypoints
├── features/
│   ├── trading/              # Swap terminal, limit order forms, execution stepper
│   ├── discovery/            # New pairs feed, scanner table, custom filter pills
│   ├── token/                # Chart container, order book, market stats, audits
│   ├── portfolio/            # Multi-wallet P&L rollup, holdings table, trade history
│   ├── wallet/               # SIWS connection modal, balance indicators, address book
│   ├── launchpad/            # Token launch wizard, liquidity lock config, bonding curve
│   ├── alerts/               # Trigger manager, push/webhook preferences, logs
│   └── analytics/            # Whale tracking, volume distribution, token rank lists
├── components/               # Domain-agnostic reusable UI elements (Button, Card, Badge, Modal)
├── hooks/                    # Reusable React hooks (useDebounce, useWebSocket, useLocalStorage)
├── stores/                   # Global client/wallet state stores (Zustand / React Context)
├── lib/                      # Pure business logic, formatting, math, and API clients
└── types/                    # Shared TypeScript interfaces
```

---

## 2. State Triage & Boundary Separation

```text
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│      SERVER STATE       │     CLIENT UI STATE     │      WALLET STATE       │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Token Intelligence    │ • Selected Token Pair   │ • Connected Pubkey      │
│ • Live Order Book       │ • Active Chart Interval │ • Hardware Signer Type  │
│ • User Trade History    │ • Visible Dock Panels   │ • In-Flight Tx Signature│
│ • Active Alerts         │ • Reduced Motion Mode   │ • Session Challenge/JWT │
│ Managed by React Query  │ Managed by Zustand /    │ Managed by Wallet       │
│ & WebSocket sync        │ Local Component State   │ Adapter Store           │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## 3. Real-Time WebSocket Gateway & Subscription Protocol

Instead of aggressive HTTP polling, the client establishes a single multiplexed WebSocket connection to the backend gateway:

```text
Client Connection: wss://stream.sentinel.trade/v1/ws

1. Handshake & Auth:
   {"type": "AUTH", "token": "jwt_session_token_xyz"}

2. Subscriptions:
   {"type": "SUBSCRIBE", "topic": "token:So11111111111111111111111111111111111111112", "events": ["price", "trades", "liquidity"]}
   {"type": "SUBSCRIBE", "topic": "orders:user_pubkey_abc", "events": ["status_changed", "filled"]}

3. Sequence & Deduplication:
   Every event contains a per-topic incremental sequence ID.
   The client drops duplicate sequence numbers and requests a backfill if a gap is detected.

4. Backpressure & Reconnection:
   - Heartbeat ping/pong every 15 seconds.
   - Exponential reconnect backoff (500ms -> 1s -> 2s -> 5s -> max 10s).
```
