/**
 * `IAccessController` — spec §31-32 (access control, principle of least
 * privilege).
 *
 * `ContractRole` is deliberately a separate vocabulary from
 * `lib/server/rbac.ts`'s `user`/`admin`/`analyst` roles — those are the
 * *application's* access domain (who can call which REST route); this is
 * the *on-chain program's* access domain (who can call which privileged
 * contract instruction). A person could reasonably hold both, but the two
 * role sets are never meant to be merged into one.
 */

import type { Address, UnixTimestamp, TxSignature } from './types';

export type ContractRole =
  | 'PROTOCOL_ADMIN'
  | 'FEE_MANAGER'
  | 'EMERGENCY_ADMIN'
  | 'TREASURY_SIGNER'
  | 'UPGRADE_AUTHORITY';

export interface RoleGrant {
  role: ContractRole;
  grantee: Address;
  grantedBy: Address;
  grantedAt: UnixTimestamp;
}

export interface IAccessController {
  hasRole(role: ContractRole, address: Address): Promise<boolean>;

  /** Each role should be grantable only by an already-privileged actor (spec §32) — never a single universal administrator for everything. */
  grantRole(role: ContractRole, grantee: Address, actor: Address): Promise<TxSignature>;
  revokeRole(role: ContractRole, grantee: Address, actor: Address): Promise<TxSignature>;
  listRoleHolders(role: ContractRole): Promise<Address[]>;
}
