# Routing and DEX Adapters

The Route Engine discovers and scores swap execution paths across supported Decentralized Exchanges on Solana and EVM chains.

---

## 1. Route Types

The engine evaluates three topologies:

1. **DIRECT Route**:
   $$TokenIn \longrightarrow TokenOut$$
   *Example: $USDC \longrightarrow SOL$ on Raydium CPMM.*
2. **MULTI_HOP Route**:
   $$TokenIn \longrightarrow IntermediateToken \longrightarrow TokenOut$$
   *Example: $USDC \longrightarrow WETH \longrightarrow PEPE$ on Uniswap V3.*
3. **MULTI_MARKET Route**:
   Splits orders across multiple DEX pools (e.g. 60% Raydium, 40% Orca) when total volume exceeds single pool depth.

---

## 2. Multi-Factor Route Ranking

The optimal route is **not simply the route with highest gross output**. The ranking algorithm scores routes on a 0–100 composite scale:

$$Score = w_1 \cdot NetOutputScore + w_2 \cdot PriceImpactScore + w_3 \cdot LiquidityScore + w_4 \cdot GasEfficiencyScore - Penalty_{Risk}$$

Where:
- **Net Output**: Gross tokens received minus DEX protocol swap fees and gas costs.
- **Price Impact Penalty**: Severe penalties if price impact exceeds 1.0% ($Penalty = \Delta_{impact} \times 50$).
- **Venue Liquidity**: Higher confidence weights assigned to pools with depth $> \$500,000$.
- **Execution Risk**: Protocol security audit status and recent pool volatility.

---

## 3. DEX Execution Adapter Interface

```typescript
export interface DexExecutionAdapter {
  getProtocolIdentifier(): string;
  getChainId(): string;
  
  getQuotes(request: ExecutionRequest): Promise<RouteOption[]>;
  
  buildSwapTransaction(
    route: RouteOption,
    walletAddress: string,
    slippage: number
  ): Promise<UnsignedTransactionPayload>;
  
  simulateSwap(
    payload: UnsignedTransactionPayload
  ): Promise<SimulationResult>;
  
  decodeSwapResult(
    receipt: RawTransactionReceipt
  ): Promise<DecodedSwapResult>;
  
  getHealth(): Promise<{ isHealthy: boolean; latencyMs: number }>;
}
```

---

## 4. Supported DEX Adapters

### A. Uniswap V2 Adapter (`UNISWAP_V2`)
- Constant Product Market Maker formula: $(x + \Delta x \cdot (1 - \gamma)) \cdot (y - \Delta y) = k$.
- Invokes `swapExactTokensForTokens` with strict `amountOutMin`.

### B. Uniswap V3 Adapter (`UNISWAP_V3`)
- Concentrated liquidity ticking and multi-hop paths encoded via byte packing `abi.encodePacked(tokenIn, fee1, tokenMid, fee2, tokenOut)`.
- Invokes `exactInputSingle` or `exactInput` on `SwapRouter02`.

### C. Solana DEX Adapter (`RAYDIUM_ORCA_SOLANA`)
- Builds Solana instructions for Raydium AMM / CPMM and Orca Whirlpools.
- Encodes required Associated Token Accounts (ATA), System Program rent funding, and Compute Budget priority fee instructions (`SetComputeUnitLimit`, `SetComputeUnitPrice`).
