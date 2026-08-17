# 08 — Trading Router & External DEX Integration

Spec §25-28 (router, external DEX integration, slippage protection, deadline protection).

## `ITradingRouter` / `IDexAdapter`

```ts
interface IDexAdapter {
  readonly dexId: string;
  getQuote(tokenIn: Address, tokenOut: Address, amountIn: BigNumberish): Promise<DexQuote>;
  buildSwapInstruction(quote: DexQuote, minAmountOut: BigNumberish, trader: Address): Promise<{ txSignature: TxSignature }>;
}

interface ITradingRouter {
  registerAdapter(adapter: IDexAdapter): void;
  getBestQuote(tokenIn: Address, tokenOut: Address, amountIn: BigNumberish): Promise<DexQuote>;
  executeSwap(quote: DexQuote, minAmountOut: BigNumberish, trader: Address, deadline: number): Promise<{ txSignature: TxSignature }>;
  listAdapters(): string[];
}
```

Full definition: `lib/contracts/trading-router.ts`.

## Not forcing proprietary liquidity (spec §25-26)

> The platform should route trades through the best available liquidity rather than forcing proprietary liquidity.

`ITradingRouter` is adapter-based specifically so a `BondingCurve` pool (`04-bonding-curve.md`) is registrable as just one more `IDexAdapter` among several, not a mandatory hop every trade must pass through. `getBestQuote` compares across every registered adapter; the application layer (not the on-chain transaction) decides which route is optimal, and the on-chain transaction then executes that specific route — matching spec §26's "the application layer determines the optimal route; the on-chain transaction executes that route" exactly.

`dexId` vocabulary matches `db/migrations/013_production_data_model.sql`'s existing `dexes.protocol` column values — an adapter implementation registers under `'raydium_clmm'`, `'orca_whirlpool'`, `'uniswap_v3'`, or `'meteora_dlmm'`, not an invented name that would need separate reconciliation with the app's own DEX schema later.

## Slippage protection (spec §27)

`minAmountOut` is a required parameter on both `IDexAdapter.buildSwapInstruction` and `ITradingRouter.executeSwap` — never optional. A conforming implementation must reject execution that would settle below it; this interface makes "no slippage protection" impossible to express by construction, not just discouraged by convention.

## Deadline protection (spec §28)

`ITradingRouter.executeSwap`'s `deadline: number` parameter is **required**, not optional — a stale quote executing later at a worse price is exactly what deadline protection exists to prevent, so making it optional would reintroduce the exact gap the spec calls out. `IDexAdapter.buildSwapInstruction` does not itself take a deadline; deadline enforcement is the router's responsibility (it's the router, not any individual adapter, that decides whether "later" has already happened by the time execution occurs).
