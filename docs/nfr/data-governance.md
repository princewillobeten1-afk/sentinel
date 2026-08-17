# Project Sentinel: Data Governance & Single Source of Truth Matrix

## 1. Domain Ownership Matrix (Sprint 32 §86)

| Domain | Responsible Team | Authoritative Source of Truth | Secondary / Derived Stores | Retention Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Market Data** | Market Data Engineering | Solana DEX Pools & Pyth Oracles | Redis Cache, Timescale Partition | 90 Days Hot / 1 Yr Cold |
| **Trading & Orders** | Trading Core Team | On-Chain Token Accounts & Programs | `trade_executions_partitioned` | 7 Years (Compliance) |
| **Wallet & Auth** | Identity & Security Team | SIWS Cryptographic Signature | `users`, `user_wallets`, Session Store | 30 Days (Sessions) / Perm (Users) |
| **Portfolio & P&L** | Portfolio Intelligence Team | Derived from Trade Ledger & Oracles | Cached Portfolio Snapshots | 7 Years |
| **Token Intelligence** | Risk & Data Science Team | Graph Clustering Engine & RPC Geyser | Feature Store, Intelligence Cache | 90 Days |
| **Security Audit** | InfoSec & Governance Team | `audit_logs_partitioned` | Cold Parquet Storage | 3 Years (SOC2) |

## 2. Canonical Source of Truth Principles (Sprint 32 §87-88)
1. **Blockchain Is Ground Truth**: If internal accounting disagrees with canonical on-chain transaction logs and token balances, the reconciliation engine corrects the internal record to match the blockchain.
2. **Deterministic Derivation**: All portfolio P&L metrics must be deterministically reproducible from raw immutable trade execution logs and historical price ticks.
