# 03 — Multi-Entity Investigation Workspace & Graph (Sprint 39 §11-22, §26-29, §57-58, §79-83)

## 1. Unified Multi-Entity Investigation Workspace

The Investigation Workspace empowers analysts to move seamlessly from **"Something looks suspicious"** to verified ground truth without switching between fragmented tools.

```text
Omnibox (⌘K) ──► Entity Resolution ──► 360° Profile ──► Relationship Graph ──► AI Evidence
 (Token / Wallet / User / Tx / Order / Launch / Incident)
```

Supported Entity Types:
1. **User Profile**: Account status, linked wallets, cumulative trading P&L, risk flags, support tickets, login history.
2. **Token Explorer**: Contract address, liquidity depth, organic volume ratio, creator reputation, insider concentration.
3. **Wallet Inspector**: Balance, funding sources, counterparties, bot activity, wash trading clusters.
4. **Creator Dossier**: Launch history, rug pull track record, connected dev wallets, reputation score.
5. **Order & Failed Trade Diagnostic**: Complete order lifecycle (`Order ID` $\rightarrow$ `User Intent` $\rightarrow$ `Pre-Trade Risk Check` $\rightarrow$ `DEX Router` $\rightarrow$ `RPC Simulation` $\rightarrow$ `On-Chain Tx Hash`).

---

## 2. Interactive Relationship Graph Topology

The graph engine constructs directional multi-entity network graphs to reveal hidden syndicates and wash trading rings:

```text
           [Creator: 9pQ1...4c00] (Deployer)
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   [Token: $NEO]          [Token: $CYBER]
         ▲                       ▲
         │ (Initial Sniping)     │ (Liquidity Injection)
   [Wallet A] ◄───(Transfers)───► [Wallet B]
```

### Graph Node Types
- `CREATOR` (Deployer identity and past mint record)
- `WALLET` (Trader, sniper, smart money, insider)
- `TOKEN` (Mint address, pool address)
- `ORDER` (Internal platform order ID)
- `TRANSACTION` (On-chain signature / hash)

### Graph Edge Relationships
- `DEPLOYED` (Creator $\rightarrow$ Token)
- `TRANSFERRED_FUNDS` (Wallet A $\rightarrow$ Wallet B)
- `SNIPED_BLOCK_0` (Wallet $\rightarrow$ Token)
- `SHARED_FUNDING_SOURCE` (CEX deposit wallet / mixer bridge)

---

## 3. AI Investigation Assistant & Evidence Traceability Panel

The AI Investigation Assistant processes multi-source telemetry and drafts structured incident briefings:

> **Analyst Query**: *"Summarize unusual activity around token $PUMP in the last 2 hours."*

### AI Response Structure
1. **Executive Summary**: High-level verdict with calculated confidence score.
2. **Chronological Timeline**: Step-by-step breakdown of on-chain & off-chain events.
3. **Detected Risk Signals**: Insider clusters, wash trading cycles, price impact manipulation.
4. **Actionable Recommendations**: Advisory checklist for the human analyst (e.g., "Consider freezing launchpad discovery").
5. **Traceable Evidence Panel**: Every statement is anchored to verifiable citations:

| Citation ID | Evidence Type | Reference Hash / Metric | Verification Status |
| :--- | :--- | :--- | :--- |
| `ev_01` | Transaction | `5k2N...8b11` (Solana Block 294,810,211) | Verified on-chain |
| `ev_02` | Cluster Metric | 8 wallets funded from single CEX bin `0x3a...` | High Confidence (94%) |
| `ev_03` | Volume Anomaly | 72% circular wash volume in 15-minute window | Calculated by Engine |

> [!CAUTION]
> AI Assistant outputs are strictly **advisory**. AI is never permitted to automatically trigger state mutations or user bans without human-in-the-loop admin approval.
