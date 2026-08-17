# 05 — Liquidity Migration & Manager

Spec §15-18 (liquidity migration, liquidity manager, liquidity locking, liquidity ownership).

## `ILiquidityManager`

```ts
interface ILiquidityManager {
  migrateLiquidity(launchId: string, reserveBalance: BigNumberish, remainingTokens: BigNumberish): Promise<LiquidityLockRecord>;
  getLockStatus(dexPoolAddress: Address): Promise<LiquidityLockRecord | null>;
  isLiquidityLocked(dexPoolAddress: Address): Promise<boolean>;
  validateLockDuration(days: number): LiquidityLockValidation;
}
```

Full definition: `lib/contracts/liquidity-manager.ts`.

## Migration (spec §15-16)

```text
Bonding Curve (graduated — checkGraduation() = true)
      ↓
LiquidityManager.migrateLiquidity(launchId, reserveBalance, remainingTokens)
      ↓
DEX Liquidity (via ITradingRouter's registered IDexAdapter — 08-trading-router-and-dex-adapters.md)
      ↓
Trading enabled on the DEX, bonding curve retired for that launch
```

`migrateLiquidity`'s signature formalizes `lib/launchpad/graduation.ts#GraduationManager.migrateLiquidity(launchId, reserveBalance, remainingTokens)`'s existing shape exactly — that method is a real, callable stub today (`console.log`, a 2-second `setTimeout`, and a hardcoded `dexPoolAddress: '0xmockDexPoolAddress'`, with a comment literally stating *"In a real implementation, this interacts with the LaunchController contract"*). This interface **types that stub's shape**; it does not make the migration real. The migration remains deterministic and observable in the sense that matters for a spec: given the same `(launchId, reserveBalance, remainingTokens)`, the result shape is always `LiquidityLockRecord`, never a different shape depending on hidden state.

## Liquidity locking (spec §17)

> If the platform claims liquidity is locked, the lock must be cryptographically verifiable. No database flag should be treated as proof.

`isLiquidityLocked()` returning `true` must mean a real, on-chain, time-locked escrow exists — never a `contract_deployments`-style database row asserting it. `LiquidityLockRecord.unlockTxSignature` is `undefined` while locked and only populated once a real unlock transaction exists; its presence (not a boolean flag alone) is what "unlocked" means.

`LIQUIDITY_LOCK_DURATION_DAYS = { MIN: 30, MAX: 365 }` (`lib/contracts/liquidity-manager.ts`) matches `docs/architecture/11-launchpad-and-reputation.md`'s already-published invariant ("minimum 100% of initial paired liquidity locked... for a minimum of 30 to 365 days"). `validateLockDuration` is pure and enforces this range — the same "validate before you trust it" pattern `ITokenFactory.validateCreationParams` uses.

## Liquidity ownership (spec §18)

The platform must be able to answer, for any `dexPoolAddress`:

| Question | Answered by |
|---|---|
| Who controls liquidity? | `LiquidityLockRecord.dexPoolAddress` + the lock escrow's on-chain authority (not this interface's concern directly — the escrow contract's own access control is) |
| Who can withdraw liquidity? | Nobody, while `isLiquidityLocked()` is `true` — the lock's entire purpose is removing this as a question during the lock window |
| When can it be withdrawn? | `LiquidityLockRecord.lockEnd` |
| What conditions permit withdrawal? | `now >= lockEnd`, full stop — no early-withdrawal path is defined in this interface; if one is ever added, it must be a distinct, clearly-labeled method, never a silent exception to `isLiquidityLocked` |

The intelligence engine ingests this automatically the same way it already ingests everything else on-chain: via `LiquidityLocked` events (`11-event-indexing-and-schema.md`), which carry `dexPoolAddress`, `lockedAmount`, `lockDurationDays`, and `unlockAt` — feeding `lib/creator`/`lib/ownership`'s existing liquidity-event vocabulary (`CreatorLiquidityEvent`'s `ADDED|REMOVED|MIGRATED`), not a new one.
