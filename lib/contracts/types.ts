/**
 * Shared primitives for the smart-contract specification layer
 * (Sprint 36 — see `docs/contracts/`). These are typechecked TypeScript
 * interfaces describing a future on-chain program, not a live
 * implementation — nothing in `lib/contracts/**` calls a real chain.
 *
 * Re-exports (never redefines) the vocabulary that already exists and is
 * already real elsewhere in this codebase, so the spec can never silently
 * drift from the application it's describing.
 */

export type {
  LaunchState,
  LaunchMode,
  RiskLevel,
  CreatorAllocation,
  BondingCurveState,
  LaunchConfig,
  LaunchRiskScore,
} from '@/lib/launchpad/types';

// Aliased deliberately: `lib/chain/adapter.ts` already exports its own,
// differently-shaped `SimulationResult` (raw chain-tx simulation). This one
// is the bonding-curve trade-simulation shape. Never import both unaliased
// in the same file — see docs/contracts/01-architecture-and-chain-strategy.md.
export type { SimulationResult as CurveSimulationResult } from '@/lib/launchpad/types';

export type { AuthorityState, ContractObservation } from '@/lib/intelligence/types';
export type { KillSwitchScope } from '@/lib/server/kill-switch';

/**
 * Deliberately narrow, not `string` — this platform deploys to Solana only
 * today (see docs/contracts/01-architecture-and-chain-strategy.md). Widening
 * this to a broader union is the entire cost of adding a second chain later;
 * nothing else in this interface layer needs to change.
 */
export type ChainId = 'solana';

/**
 * Plain strings at the interface boundary — matches `lib/chain/adapter.ts`'s
 * existing convention of never leaking a chain-specific SDK type (e.g.
 * Solana's `PublicKey`) into a shared interface.
 */
export type Address = string;
export type TxSignature = string;

/** A numeric amount serialized as a string, to avoid float precision loss on large token amounts. */
export type BigNumberish = string;

/** ISO-8601 — matches `ContractObservation`'s existing `observedAt` convention. */
export type UnixTimestamp = string;
