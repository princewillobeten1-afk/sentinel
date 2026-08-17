# Sprint 47 — Swap Execution Engine Documentation

This documentation suite defines the complete production architecture, security boundaries, and execution pipeline for the **Swap Execution Engine**.

---

## Master Architecture Index

1. **[01. Execution Service Architecture](./01-execution-service-architecture.md)**
   - Core execution pipeline, component responsibilities, execution request and intent lifecycles.
2. **[02. DEX Routing and Execution Adapters](./02-routing-and-dex-adapters.md)**
   - Multi-hop & multi-market route engine, composite route ranking, Uniswap V2/V3 and Solana DEX adapters.
3. **[03. Transaction Construction & Simulation](./03-transaction-construction-and-simulation.md)**
   - Unsigned payload generation, EVM calldata & nonces, Solana instructions, pre-flight simulation, ERC-20 allowance management.
4. **[04. Safety Checks & Slippage Enforcement](./04-safety-checks-and-slippage.md)**
   - Server-side slippage enforcement, quote drift detection (`QUOTE_MOVED`), native gas balance verification.
5. **[05. Broadcasting, Monitoring & Reorg Handling](./05-broadcasting-monitoring-and-reorgs.md)**
   - Idempotent transaction broadcasting, multi-tier RPC failover, per-chain confirmations, reorg detection (`REORG_DETECTED`), replacement transactions.
6. **[06. Reconciliation & Execution Receipts](./06-reconciliation-and-execution-receipts.md)**
   - Post-trade balance reconciliation, actual vs expected output calculation, effective execution price, normalized `ExecutionReceipt`.
7. **[07. MEV Protection & Operational Security](./07-mev-protection-and-security.md)**
   - MEV protection strategies (`PRIVATE_RPC`, `PROTECTED_ROUTE`), emergency kill switch, contract allowlists, and token blocklists.

---

## Core Operational Invariant

> **The frontend requests an execution. It never constructs or broadcasts an authoritative transaction by itself. All quotes, routes, transactions, simulations, and broadcasts pass through the authoritative Swap Execution Engine.**
