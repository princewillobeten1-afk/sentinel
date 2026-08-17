# 02 — Token & Pool Discovery Pipeline

## 1. Discovery Pipeline Architecture

```text
[New On-Chain Activity / Factory Event]
                   │
                   ▼
             DEX Adapter
                   │
                   ▼
            Market Candidate
                   │
                   ▼
         Validation & Verification
         (Address, Base, Quote, Math)
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    Valid Tokens        Unverifiable
         │                   │
         ▼                   ▼
    Deduplicate         Tag SUSPICIOUS
         │                   │
         ▼                   ▼
   Create Market       Log to Quality Audit
         │
         ▼
   Token Discovery Pipeline
         │
         ▼
   Begin Realtime Tracking
```

---

## 2. Token Lifecycle

Tokens progress through a deterministic verification lifecycle:

```text
DISCOVERED ──► VALIDATED ──► ACTIVE ──► INACTIVE / SUSPICIOUS
```

- **`DISCOVERED`**: Candidate token address extracted from new pool creation.
- **`VALIDATED`**: On-chain mint account confirmed, decimals parsed, supply model built.
- **`ACTIVE`**: Token has $\ge 1$ active market, pricing data available, public trading enabled.
- **`SUSPICIOUS`**: Mint authority retained with freeze ability, honeypot code, or spoofed ticker.
- **`INACTIVE`**: Zero active markets, all liquidity pulled.

---

## 3. Token Metadata Enrichment & Trust Boundaries

External metadata (logos, websites, descriptions, socials) are inherently untrusted and sanitized before inclusion:

```typescript
export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logoUrl?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  telegramUrl?: string;
  discordUrl?: string;
  description?: string;
  isVerified: boolean;
  metadataSource: 'ONCHAIN_METAPLEX' | 'ERC20_BYTECODE' | 'OFFCHAIN_REGISTRY' | 'USER_SUBMITTED';
}
```

---

## 4. Token Supply Model & Confidence

Circulating supply is often less verifiable than total on-chain supply. The engine explicitly models supply confidence:

```typescript
export interface TokenSupplyInfo {
  tokenId: string;
  totalSupply: number;
  circulatingSupply: number;
  maxSupply: number | null; // null if unbounded / inflationary
  supplyConfidence: number; // 0.0 - 1.0 (1.0 for on-chain verifiable, lower for self-reported)
  source: 'ONCHAIN_RPC' | 'TOKEN_METADATA' | 'COINGECKO' | 'CALCULATED';
  updatedAt: string;
}
```
