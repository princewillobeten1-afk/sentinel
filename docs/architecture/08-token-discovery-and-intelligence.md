# 08 — Token Discovery & Intelligence Architecture (Sprint 34 §34-42)

## 1. Token Discovery Engine

```text
Canonical Event Bus (`TOKEN_CREATED`, `SWAP`, `LIQUIDITY_ADDED`)
                     │
                     ▼
Feature Extraction Worker (`lib/activity/feature-store.ts`)
                     │ (Volume velocity, unique wallet count, liquidity depth)
                     ▼
Discovery Ranking Engine (`lib/discovery/`)
                     │ (Scores momentum, organic volume, exitability, and creator rep)
                     ▼
Discovery Cache (Redis Sorted Sets)
                     │
                     ▼
Discovery API (`/api/v1/discovery/tokens`)
```

### Discovery Ranking Factors:
- **Volume & Acceleration**: 5m/1h volume surges and trade frequency acceleration.
- **Liquidity & Depth**: Total locked pool liquidity and bid/ask depth.
- **Organic Trader Ratio**: Ratio of genuine independent wallets vs. bot wash-trading clusters.
- **Creator Provenance**: Reputation score of deployer wallet.
- **Exitability Score**: Liquidity-to-market-cap ratio and sell tax bounds.

---

## 2. Token Intelligence Architecture & 8 Sub-Engines

```text
                               RAW BLOCKCHAIN EVENTS
                                        │
                                        ▼
                             FEATURE EXTRACTION STORE
                                        │
    ┌────────────────┬──────────────────┼──────────────────┬────────────────┐
    ▼                ▼                  ▼                  ▼                ▼
1. Ownership     2. Creator         3. Organic         4. Insider       5. Exitability
   Clustering       Reputation         Volume             Detection        Engine
   (`lib/`          (`lib/`            (`lib/`            (`lib/`          (`lib/`
   `ownership/`)    `creator/`)        `activity/`)       `activity/`)     `exitability/`)
    │                │                  │                  │                │
    ├────────────────┴──────────────────┼──────────────────┴────────────────┤
    ▼                                   ▼                                   ▼
6. Contract Risk                    7. Liquidity Risk                   8. Pre-Trade Risk
   Security Analyzer                   Slippage & Depth                    Enforcer
   (`lib/intelligence/`)               (`lib/quote/`)                      (`lib/security/`)
    │                                   │                                   │
    └───────────────────────────────────┼───────────────────────────────────┘
                                        │
                                        ▼
                            RISK SCORE AGGREGATOR
                        (`lib/intelligence/score-aggregator.ts`)
                                        │
                                        ▼
                         UNIFIED TOKEN INTELLIGENCE OBJECT
```

---

## 3. Unified Token Intelligence Object

Every token is mapped to a standardized deterministic intelligence representation:
```typescript
interface TokenIntelligence {
  tokenMint: string;
  overallScore: number;       // 0 - 100
  riskScore: number;          // 0 - 100
  confidence: number;         // 0 - 100%
  dimensions: {
    ownershipScore: number;   // Holder distribution & cluster control
    creatorScore: number;     // Deployer history & rug incidence
    organicVolumeScore: number; // Wash-trading penalty
    insiderScore: number;     // Early snipe & pre-launch funding
    exitabilityScore: number; // Realistic sell slippage & tax bounds
    liquidityScore: number;   // Pool depth & lock duration
    contractScore: number;    // Mint revocation, freeze authority
  };
  methodologyVersion: string; // e.g. "sentinel-intelligence-v1.0.0"
  dataFreshnessTimestamp: string;
}
```
