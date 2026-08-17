# Sprint 46 — Trading Terminal & Market Interface Architecture

This directory contains the canonical specifications, interaction architectures, and security boundaries for the Sentinel Trading Terminal and Market Interface.

---

## Document Index

1. [01-trading-terminal-architecture.md](./01-trading-terminal-architecture.md) — Terminal UI layout, state synchronization, component boundaries, execution flow.
2. [02-quote-and-simulation-engine.md](./02-quote-and-simulation-engine.md) — Fixed-point decimal arithmetic, route decomposition, price impact formula, quote expiration.
3. [03-wallet-abstraction-and-adapters.md](./03-wallet-abstraction-and-adapters.md) — Multi-chain `WalletProvider` (Solana & EVM), connection states, balance tracking.
4. [04-transaction-lifecycle-and-state-machine.md](./04-transaction-lifecycle-and-state-machine.md) — 11-stage deterministic state machine, transition rules, error categorization, audit logs.
5. [05-token-detail-and-trading-experience.md](./05-token-detail-and-trading-experience.md) — Token detail page (`/tokens/:tokenId`), identity header, verification badges, market comparison, chart overlays.
6. [06-token-discovery-page.md](./06-token-discovery-page.md) — Token discovery page (`/discover`), filter matrix, watchlist persistence, mobile bottom-sheet UX.
7. [07-api-reference-and-security.md](./07-api-reference-and-security.md) — REST API specifications, anti-tampering rules, parameter validation.

---

## Core Invariants

1. **Strict RPC Isolation**: The frontend UI never directly interacts with blockchain RPCs. All quotes, transaction preparations, and simulations must pass through authoritative server boundaries.
2. **Deterministic Transaction State Machine**: Enforces valid state jumps across 11 lifecycle stages (`IDLE` → `QUOTING` → `SIMULATING` → `READY` → `AWAITING_SIGNATURE` → `SUBMITTED` → `CONFIRMING` → `CONFIRMED` / terminal failure branches).
3. **Multi-Market Awareness**: Supports tokens that trade on $N$ markets with clear canonical "Primary Market" highlighting.
4. **Transparent Price Impact & Slippage**: Strict calculation of $minimumReceived = expectedReceived \times (1 - slippage)$ with user acknowledgement required on high price impacts (>3%).
