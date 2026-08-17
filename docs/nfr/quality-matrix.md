# Project Sentinel: Master Production Quality Matrix (Sprint 33)

This document defines the consolidated engineering quality matrix across all Project Sentinel subsystems. Every feature must satisfy these non-functional criteria before production release.

---

## 1. Subsystem Criticality & Availability Tiers

| Subsystem | Criticality | Target Availability | Latency Class | Consistency Model | Data Freshness | Security Class | DR Tier |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Trading API** | P0 (Financial) | 99.99% | L0 (<500ms) | Strong | Real-Time | Financial | Tier A (RPO ≤1m, RTO ≤15m) |
| **Order Management** | P0 (Financial) | 99.99% | L0 (<500ms) | Strong | Real-Time | Financial | Tier A (RPO ≤1m, RTO ≤15m) |
| **Wallet & Balances** | P0 (Financial) | 99.99% | L0 (<500ms) | Strong | Real-Time | Financial | Tier A (RPO ≤1m, RTO ≤15m) |
| **Authentication** | P0 (Financial) | 99.99% | L0 (<300ms) | Strong | Real-Time | Authenticated | Tier A (RPO ≤1m, RTO ≤15m) |
| **Market Data** | P1 (Trading) | 99.99% | L1 (<250ms) | Strong | Real-Time | Public | Tier B (RPO ≤5m, RTO ≤30m) |
| **Portfolio & P&L** | P1 (Trading) | 99.95% | L2 (<500ms) | Strong | Near Real-Time | Authenticated | Tier B (RPO ≤5m, RTO ≤30m) |
| **Pre-Trade Risk** | P1 (Trading) | 99.95% | L0 (<250ms) | Strong | Near Real-Time | Financial | Tier B (RPO ≤5m, RTO ≤30m) |
| **Token Intelligence**| P2 (Intelligence)| 99.90% | L2 (<600ms) | Eventual | Near Real-Time | Public | Tier B (RPO ≤15m, RTO ≤60m)|
| **Discovery** | P3 (Product) | 99.90% | L2 (<500ms) | Eventual | Near Real-Time | Public | Tier C (RPO ≤30m, RTO ≤2h) |
| **Alerts** | P3 (Product) | 99.90% | L1 (<300ms) | Strong | Real-Time | Authenticated | Tier C (RPO ≤15m, RTO ≤1h) |
| **Analytics** | P4 (Non-Critical)| 99.50% | L3 (Background)| Eventual | Periodic | Public | Tier C (RPO ≤1h, RTO ≤4h) |
| **Admin** | P4 (Non-Critical)| 99.50% | L2 (<600ms) | Strong | Real-Time | Administrative| Tier C (RPO ≤15m, RTO ≤1h) |

---

## 2. Latency Class Definitions
- **L0 (Ultra-Critical)**: Swap submission, risk validation, preflight simulation. Platform-side target: `<500ms`.
- **L1 (Real-Time)**: Price ticks, pool liquidity, trades, order book updates, WebSocket propagation. Target: `<250ms`.
- **L2 (Interactive)**: Discovery search, token page load, portfolio queries. Target: `<500ms`.
- **L3 (Background)**: Deep graph intelligence, historical analytics, backfills. Target: seconds to minutes.

---

## 3. Consistency Matrix
- **Strong Consistency Required**: Account balances, active limit orders, trade execution states, wallet permissions, transaction lifecycles, user identity.
- **Eventual Consistency Allowed**: Trending token rankings, volume leaderboards, aggregated holder analytics, social activity metrics.
