# 11 — Contract Events & Indexing Schema

Spec §39-40 (contract events, event design).

## The event union

`ContractEvent` (`lib/contracts/events.ts`) is a 13-variant discriminated union, one variant per event named in spec §39:

| Event | Fires when |
|---|---|
| `TokenCreated` | `ITokenFactory.createToken` succeeds |
| `LaunchCreated` | `ILaunchpad.createLaunch` succeeds |
| `LaunchStateChanged` | any `LAUNCH_STATE_TRANSITIONS`-valid state change (`03-launchpad-and-launch-controller.md`) |
| `BondingCurveTrade` | `IBondingCurve.buy`/`sell` |
| `LaunchGraduated` | `checkGraduation()` → true and migration completes |
| `LiquidityLocked` | `ILiquidityManager.migrateLiquidity` completes |
| `FeeConfigUpdated` | `IFeeController.setFeeConfig` |
| `TreasuryWithdrawal` | `ITreasury.withdraw` |
| `RoleGranted` / `RoleRevoked` | `IAccessController.grantRole`/`revokeRole` |
| `EmergencyPause` / `EmergencyResume` | `IEmergencyController.pause`/`resume` |
| `ContractUpgraded` | any deployment's version changes (`12-versioning-and-deployment-registry.md`) |

Every variant carries enough information to reconstruct the state change it represents without requiring an indexer to infer anything from a separate, unrelated transaction (spec §40) — e.g. `LaunchStateChanged` carries both `fromState` and `toState`, not just the new state, so a gap in indexing is detectable (an indexer that sees `toState: 'LIVE'` without ever having seen the matching `fromState: 'DEPLOYED'` knows it missed an event).

## Mapping onto `blockchain_events`

`toBlockchainEventRow()` (`lib/contracts/events.ts`, real and tested — `lib/contracts/__tests__/events.test.ts` round-trips all 13 variants) is an **exhaustive `switch`**, not a generic object spread:

```ts
switch (event.type) {
  case 'TokenCreated': return { ...base, event_type: event.type, payload: { tokenAddress: event.tokenAddress, /* ... */ } };
  // ... one case per variant ...
  default: return assertNever(event); // compile error if a variant is ever added without a case
}
```

This maps every event onto `db/migrations/013_production_data_model.sql`'s existing `blockchain_events` table shape exactly: `(id, chain_id, transaction_id, block_number, event_index, event_type, payload, timestamp)`. That table already exists in the schema and is currently unused by any application code — genuinely greenfield, not a redesign of something already in use.

**One documented simplification**: `blockchain_events.transaction_id` is a foreign key to `blockchain_transactions.id`, not a raw transaction signature. `toBlockchainEventRow` maps `txSignature` straight into `transaction_id` for illustration — a real indexer would resolve that foreign key (look up or insert the corresponding `blockchain_transactions` row) first. This is schema-as-documentation, not a working indexer; the simplification is stated here rather than hidden.

## Why an exhaustive switch, not a generic mapper

A generic `payload: {...event}` spread would "work" today but silently include `eventId`/`chainId`/`type` inside `payload` (duplicating the row's own columns) and would never fail to compile if a 14th event variant were added without anyone updating the mapping — it would just silently produce a plausible-looking row with whatever fields happened to be on the new type. The exhaustive switch trades a small amount of per-variant repetition for a compile-time guarantee that every event type is deliberately mapped, not accidentally mapped.
