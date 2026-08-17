# 01 — Market Registry & DEX Adapters

## 1. Canonical Market Architecture

A token frequently trades across multiple automated market maker (AMM) pools and order books:

```text
Token
  │
  ├── Market A (Raydium CPMM — SOL/USDC)
  ├── Market B (Orca Whirlpools — SOL/USDT)
  └── Market C (Meteora DLMM — SOL/bSOL)
        │
        ├── Price
        ├── Liquidity
        ├── Volume
        └── OHLCV
```

### The $1 \text{ Token} \neq 1 \text{ Market}$ Axiom
Never assume one token maps to exactly one market. The canonical market registry explicitly decouples tokens from individual market pools, maintaining a $1:N$ relationship.

---

## 2. Market Model & Identity

Every market is uniquely identified across supported blockchains and protocols by its canonical tuple:

$$\text{Canonical Market Identity} = (\text{chainId}, \text{protocol}, \text{address})$$

### Market Entity Schema
```typescript
export interface Market {
  marketId: string; // Deterministic hash: `${chainId}:${protocol}:${address}`
  chainId: 'solana' | 'ethereum' | 'base' | string;
  protocol: 'raydium_cpmm' | 'raydium_amm' | 'orca_whirlpool' | 'meteora' | 'pump_fun' | 'uniswap_v2' | 'uniswap_v3' | string;
  marketType: 'CPMM' | 'CONCENTRATED' | 'ORDERBOOK' | 'STABLE_SWAP';
  address: string; // On-chain pool contract address
  baseTokenId: string;
  quoteTokenId: string;
  feeBps: number;
  status: MarketStatus;
  source: MarketDiscoverySource;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Market Lifecycle & Status

Markets transition across distinct operational states. A market does not disappear simply because trading activity temporarily stops.

```text
       [New On-Chain Activity]
                  │
                  ▼
             DISCOVERED
                  │
          ┌───────┴───────┐
          ▼               ▼
        ACTIVE       SUSPICIOUS (Unverified critical metadata)
          │               │
     [Inactive 30d]  [Remediated / Verified]
          │               │
          ▼               ▼
       INACTIVE        ACTIVE
          │
     [Pool Drained / Closed]
          │
          ▼
      DEPRECATED
```

- **`DISCOVERED`**: Identified from factory logs or first swap, pending validation.
- **`ACTIVE`**: Verified reserves, tokens validated, actively producing price updates.
- **`INACTIVE`**: Zero swaps for extended interval (>30 days), retained in historical registry.
- **`SUSPICIOUS`**: Unverifiable tokens, irregular mathematical invariant, or spoofed bytecode.
- **`DEPRECATED`**: Pool destroyed, zero liquidity permanently, or migrated to newer contract version.

---

## 4. Market Discovery Sources

Tracking provenance enables downstream data-quality scoring:

- **`ONCHAIN`**: Extracted directly from blockchain factory logs / account creations.
- **`REGISTRY`**: Verified platform registry or official token list.
- **`INDEXER`**: Ingested from decentralized indexers (Helius, Subsquid, TheGraph).
- **`MANUAL`**: Operator configured through Admin Operations switchboard.
- **`EXTERNAL_PROVIDER`**: Supplementary discovery via partner API (Birdeye, CoinGecko).

---

## 5. DEX Adapter Abstraction

All DEX protocols implement a unified contract, decoupling market ingestion from protocol-specific mathematical quirks:

```typescript
export interface DexAdapter {
  readonly protocol: string;
  readonly chainId: string;

  discoverMarkets(fromBlock?: number): Promise<MarketCandidate[]>;
  getMarketState(marketAddress: string): Promise<MarketState>;
  getReserves(marketAddress: string): Promise<ReserveState>;
  getSwapEvents(marketAddress: string, since?: string): Promise<RawSwapEvent[]>;
  getLiquidityEvents(marketAddress: string, since?: string): Promise<RawLiquidityEvent[]>;
}
```

### Implementations:
1. **`SolanaDexAdapter`**: Interacts with Raydium (Constant Product & AMMv4), Orca Whirlpools (sqrtPriceX64 ticks), Meteora DLMM, and Pump.fun bonding curves.
2. **`UniswapV2Adapter`**: Standard constant product invariant ($x \cdot y = k$).
3. **`UniswapV3Adapter`**: Concentrated liquidity invariant with $\sqrt{P}$ tick ranges and active liquidity $L$.
