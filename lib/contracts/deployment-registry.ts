/**
 * `deployment-registry.ts` — spec §54-56 (contract versioning, deployment
 * registry, contract verification).
 *
 * CamelCase TS mirrors of `db/migrations/014_smart_contract_platform.sql`'s
 * three tables — typed, never queried, same relationship every other
 * migration-mirroring type in this codebase has to its table.
 */

import type { Address, ChainId, TxSignature, UnixTimestamp } from './types';
import type { ContractRole } from './access-controller';

export type ContractName =
  | 'TokenFactory'
  | 'Launchpad'
  | 'LaunchController'
  | 'BondingCurve'
  | 'LiquidityManager'
  | 'FeeController'
  | 'Treasury'
  | 'AccessController'
  | 'EmergencyController'
  | 'TradingRouter';

export type DeploymentStatus = 'unreleased' | 'active' | 'deprecated' | 'retired';

export interface ContractDeploymentRecord {
  id: string;
  chainId: ChainId;
  contractName: ContractName;
  /** Semver, e.g. `'0.1.0'`. */
  version: string;
  programAddress?: Address;
  status: DeploymentStatus;
  deployedBy?: Address;
  deployedAt?: UnixTimestamp;
  deploymentTx?: TxSignature;
  /** Self-reference — the deployment this one supersedes, if any (spec §37: previous implementation must be observable). */
  previousVersionId?: string;
  createdAt: UnixTimestamp;
}

export interface ContractVerificationRecord {
  id: string;
  deploymentId: string;
  verified: boolean;
  verificationSource?: string; // e.g. 'solscan', 'internal-review'
  sourceHash?: string;
  verifiedAt?: UnixTimestamp;
}

export interface ContractRoleGrantRecord {
  id: string;
  deploymentId: string;
  role: ContractRole;
  granteeAddress: Address;
  grantedBy: Address;
  grantedAt: UnixTimestamp;
  revokedAt?: UnixTimestamp;
}
