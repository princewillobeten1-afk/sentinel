# 03 — Launchpad & Launch Controller

Spec §9-11 (Launchpad contract, launch states, launch parameters).

## The canonical launch state machine

`LaunchState` (`lib/launchpad/types.ts`) is the one real state machine in this codebase — already used by the live, gateway-wired `app/api/v1/launches/**` routes. `lib/contracts/launchpad.ts` makes its valid-transition graph explicit and type-checked as `LAUNCH_STATE_TRANSITIONS`:

```text
CREATED ──► VALIDATING ──► DEPLOYED ──► LIVE ──► GRADUATING ──► GRADUATED
   │            │              │          │  ▲
   │            │              │          │  │
   │            │              │          ▼  │
   │            │              │        PAUSED
   │            │              │          │
   ▼            ▼              ▼          ▼
CANCELLED   CANCELLED      CANCELLED  CANCELLED
```

`isValidLaunchStateTransition(from, to)` is the single source of truth this diagram is rendered from (`lib/contracts/__tests__/launchpad-state-machine.test.ts` asserts the happy path, pause/resume, rejection of skipped states, and rejection of any transition out of a terminal state). Any implementation — on-chain or off — that wants to claim conformance with this spec transitions state only through this function's logic, never by directly assigning a new state value.

### Retired vocabulary (Sprint 36 reconciliation)

An older, informal state vocabulary (`DRAFT → READY/VALIDATION_FAILED → DEPLOYED → LAUNCHING`) used to live in a separate, unauthenticated route tree (`app/api/launches/**`, non-`v1`) called only by two orphaned UI components that were never mounted into any page. That entire subtree — 3 route files and `lib/launchpad/validator.ts` (a second, unwired validator) — was deleted this sprint rather than left as a second, drifting source of truth. Term mapping, for anyone who referenced the old vocabulary informally:

| Old (deleted) | Canonical (`LaunchState`) |
|---|---|
| `DRAFT` | `CREATED` |
| `READY` | `VALIDATING` → (passes) → `DEPLOYED` |
| `VALIDATION_FAILED` | `VALIDATING` → (fails) → back to `CREATED`, or `CANCELLED` |
| `LAUNCHING` | `LIVE` |
| *(no equivalent existed)* | `GRADUATING`, `GRADUATED`, `PAUSED` |

## `ILaunchpad` / `ILaunchController`

```ts
interface ILaunchpad {
  createLaunch(config: LaunchConfig, creatorWallet: Address): Promise<LaunchRecord>;
  getLaunch(launchId: string): Promise<LaunchRecord | null>;
  listLaunches(filter?: { state?: LaunchState; creatorWallet?: Address }): Promise<LaunchRecord[]>;
  transitionState(launchId: string, to: LaunchState, reason?: string): Promise<LaunchRecord>;
}

interface ILaunchController {
  preflightAnalysis(config: LaunchConfig, creatorWallet: Address): Promise<LaunchRiskScore>;
  deployLaunch(config: LaunchConfig, creatorWallet: Address): Promise<LaunchDeploymentResult>;
  pauseLaunch(launchId: string, reason: string, actor: Address): Promise<void>;
  resumeLaunch(launchId: string, actor: Address): Promise<void>;
  cancelLaunch(launchId: string, reason: string, actor: Address): Promise<void>;
}
```

Full definitions: `lib/contracts/launchpad.ts`. `preflightAnalysis`'s signature matches `lib/launchpad/engine.ts#LaunchController.preflightAnalysis` exactly — the same real risk engine (`lib/launchpad/risk.ts#LaunchRiskEngine.analyzePreLaunch`) underneath, not a parallel one.

## Launch parameters (spec §11)

`LaunchConfig` (`lib/launchpad/types.ts`, reused verbatim) already carries: `name`, `symbol`, `description`, `logoUrl`, `websiteUrl`, `socialLinks`, `totalSupply`, `creatorAllocation` (`{walletAddress, percentage, isVested, cliffDays?, vestingDays?}`), `launchMode` (`FAIR | BONDING_CURVE | SCHEDULED`). Every field is validated on-chain per spec §11 — `validateCreationParams` (Token Factory) and `preflightAnalysis` (risk scoring, see `09-creator-accountability-and-reputation.md`) are the two validation passes; neither is optional or bypassable via a direct `deployLaunch` call.

`transitionState`'s `reason` parameter exists specifically so `LaunchStateChanged` events (`11-event-indexing-and-schema.md`) carry a human-readable audit trail, not just the bare state transition.
