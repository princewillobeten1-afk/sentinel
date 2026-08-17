# 07 — Access Control & Emergency Controller

Spec §31-35 (access control, principle of least privilege, emergency controller, emergency powers, pause granularity).

## `IAccessController`

```ts
type ContractRole = 'PROTOCOL_ADMIN' | 'FEE_MANAGER' | 'EMERGENCY_ADMIN' | 'TREASURY_SIGNER' | 'UPGRADE_AUTHORITY';

interface IAccessController {
  hasRole(role: ContractRole, address: Address): Promise<boolean>;
  grantRole(role: ContractRole, grantee: Address, actor: Address): Promise<TxSignature>;
  revokeRole(role: ContractRole, grantee: Address, actor: Address): Promise<TxSignature>;
  listRoleHolders(role: ContractRole): Promise<Address[]>;
}
```

Full definition: `lib/contracts/access-controller.ts`.

**`ContractRole` is a deliberately separate vocabulary from `lib/server/rbac.ts`'s `user`/`admin`/`analyst` roles.** Those govern who can call which *REST route* in this application; `ContractRole` governs who can call which *privileged on-chain instruction*. A person could reasonably hold both (e.g. an app admin who is also `PROTOCOL_ADMIN`), but the two role sets are never meant to be merged into one — an app-level `admin` gaining implicit on-chain authority (or vice versa) would be exactly the kind of hidden administrative power spec §7 and §31 both warn against.

## Principle of least privilege (spec §32)

No single role holds every permission. `FeeController` (`06-fee-controller-and-treasury.md`) does not itself grant `Treasury.withdraw` or `Launchpad.cancelLaunch` authority — a `FEE_MANAGER` grant is scoped to `setFeeConfig` alone. Each of the five roles above maps to a narrow, named responsibility:

| Role | Scope |
|---|---|
| `PROTOCOL_ADMIN` | Broadest — but still not universal; see below |
| `FEE_MANAGER` | `IFeeController.setFeeConfig` only |
| `EMERGENCY_ADMIN` | `IEmergencyController.pause`/`resume` only |
| `TREASURY_SIGNER` | `ITreasury.withdraw` only |
| `UPGRADE_AUTHORITY` | Contract upgrades (`14-audit-monitoring-and-deployment-pipeline.md`) only |

Even `PROTOCOL_ADMIN` is not a single universal administrator in the sense spec §31 warns against: it is one role among five, itself revocable by another `PROTOCOL_ADMIN` holder or a governance process, not an unremovable superuser.

## `IEmergencyController`

```ts
interface IEmergencyController {
  pause(scope: KillSwitchScope, reason: string, actor: Address): Promise<TxSignature>;
  resume(scope: KillSwitchScope, actor: Address): Promise<TxSignature>;
  isPaused(scope: KillSwitchScope): Promise<boolean>;
  getPauseHistory(scope: KillSwitchScope): Promise<PauseHistoryEntry[]>;
}
```

Full definition: `lib/contracts/emergency-controller.ts`.

**This is the documented on-chain mirror of an already-real off-chain mechanism, not a new design.** `KillSwitchScope` (`'TRADING' | 'LAUNCHPAD'`) is imported verbatim from `lib/server/kill-switch.ts` — the same scope granularity the application already enforces today via `lib/server/dual-control.ts`'s `PAUSE_TRADING`/`PAUSE_LAUNCHPAD` approval actions. `pause`/`resume` here describe what those same off-chain actions would eventually trigger on-chain, not a broader primitive invented fresh.

### Pause granularity (spec §35)

`KillSwitchScope` is a union of exactly two values, not `boolean` or a free string — this is a structural guarantee against a "PAUSE EVERYTHING" implementation. There is no `pauseAll()` method; pausing every scope requires two calls, one per scope, each independently reasoned about and each producing its own `EmergencyPause` event (`11-event-indexing-and-schema.md`).

### Emergency powers must never become a hidden permanent backdoor (spec §34)

- `getPauseHistory` exists specifically so every pause/resume is inspectable, not just the current state — an emergency action that's silently reversible with no trace would fail spec §34's "visible" requirement.
- `EMERGENCY_ADMIN` is a distinct role from `PROTOCOL_ADMIN` (least-privilege, above) — an emergency responder does not thereby gain fee-setting or treasury-withdrawal authority.
- This spec does not define a time-bound/auto-expiring pause. Flagged, not silently assumed: `docs/contracts/out-of-scope.md` notes this as a real design question (auto-expiry vs. requiring an explicit `resume`) deferred to whenever real implementation begins, since the off-chain kill switch it mirrors also has no auto-expiry today.
