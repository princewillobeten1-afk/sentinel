/**
 * `ContractEvent` — spec §39-40 (contract events, event design).
 *
 * A discriminated union so `toBlockchainEventRow` can be an exhaustive
 * `switch` — adding a new event variant without a matching `case` is a
 * compile error, not a silent gap in indexing. Maps onto
 * `db/migrations/014_smart_contract_platform.sql`'s (documentation-only)
 * `blockchain_events`-style row shape, matching
 * `db/migrations/013_production_data_model.sql`'s existing
 * `blockchain_events` table columns exactly:
 * `(id, chain_id, transaction_id, block_number, event_index, event_type, payload, timestamp)`.
 *
 * Simplification noted here rather than hidden: `blockchain_events.transaction_id`
 * is a foreign key to `blockchain_transactions.id`, not a raw tx signature —
 * a real indexer would resolve that FK first. `toBlockchainEventRow` maps
 * `txSignature` straight into `transaction_id` for illustration; this is
 * schema-as-documentation, not a working indexer.
 */

import type { Address, BigNumberish, ChainId, TxSignature, UnixTimestamp } from './types';
import type { LaunchState } from '@/lib/launchpad/types';
import type { FeeConfig } from './fee-controller';
import type { ContractRole } from './access-controller';
import type { KillSwitchScope } from './types';

interface BaseContractEvent {
  eventId: string;
  chainId: ChainId;
  txSignature: TxSignature;
  blockNumber: number;
  eventIndex: number;
  timestamp: UnixTimestamp;
}

export interface TokenCreatedEvent extends BaseContractEvent {
  type: 'TokenCreated';
  tokenAddress: Address;
  creator: Address;
  name: string;
  symbol: string;
  totalSupply: BigNumberish;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
}

export interface LaunchCreatedEvent extends BaseContractEvent {
  type: 'LaunchCreated';
  launchId: string;
  tokenAddress: Address;
  creator: Address;
  launchMode: string;
  creatorAllocationPct: number;
}

export interface LaunchStateChangedEvent extends BaseContractEvent {
  type: 'LaunchStateChanged';
  launchId: string;
  fromState: LaunchState;
  toState: LaunchState;
  reason?: string;
}

export interface BondingCurveTradeEvent extends BaseContractEvent {
  type: 'BondingCurveTrade';
  launchId: string;
  trader: Address;
  side: 'BUY' | 'SELL';
  nativeAmount: BigNumberish;
  tokenAmount: BigNumberish;
  feePaid: BigNumberish;
  priceImpact: number;
  newPrice: BigNumberish;
}

export interface LaunchGraduatedEvent extends BaseContractEvent {
  type: 'LaunchGraduated';
  launchId: string;
  dexPoolAddress: Address;
  migratedLiquidity: BigNumberish;
}

export interface LiquidityLockedEvent extends BaseContractEvent {
  type: 'LiquidityLocked';
  dexPoolAddress: Address;
  lockedAmount: BigNumberish;
  lockDurationDays: number;
  unlockAt: UnixTimestamp;
}

export interface FeeConfigUpdatedEvent extends BaseContractEvent {
  type: 'FeeConfigUpdated';
  scope: 'PLATFORM' | Address;
  config: FeeConfig;
  actor: Address;
}

export interface TreasuryWithdrawalEvent extends BaseContractEvent {
  type: 'TreasuryWithdrawal';
  asset: Address | 'NATIVE';
  amount: BigNumberish;
  destination: Address;
  actor: Address;
}

export interface RoleGrantedEvent extends BaseContractEvent {
  type: 'RoleGranted';
  role: ContractRole;
  grantee: Address;
  actor: Address;
}

export interface RoleRevokedEvent extends BaseContractEvent {
  type: 'RoleRevoked';
  role: ContractRole;
  grantee: Address;
  actor: Address;
}

export interface EmergencyPauseEvent extends BaseContractEvent {
  type: 'EmergencyPause';
  scope: KillSwitchScope;
  reason: string;
  actor: Address;
}

export interface EmergencyResumeEvent extends BaseContractEvent {
  type: 'EmergencyResume';
  scope: KillSwitchScope;
  actor: Address;
}

export interface ContractUpgradedEvent extends BaseContractEvent {
  type: 'ContractUpgraded';
  contractName: string;
  fromVersion: string;
  toVersion: string;
  actor: Address;
}

export type ContractEvent =
  | TokenCreatedEvent
  | LaunchCreatedEvent
  | LaunchStateChangedEvent
  | BondingCurveTradeEvent
  | LaunchGraduatedEvent
  | LiquidityLockedEvent
  | FeeConfigUpdatedEvent
  | TreasuryWithdrawalEvent
  | RoleGrantedEvent
  | RoleRevokedEvent
  | EmergencyPauseEvent
  | EmergencyResumeEvent
  | ContractUpgradedEvent;

export interface BlockchainEventRow {
  id: string;
  chain_id: ChainId;
  transaction_id: TxSignature;
  block_number: number;
  event_index: number;
  event_type: ContractEvent['type'];
  payload: Record<string, unknown>;
  timestamp: UnixTimestamp;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ContractEvent type: ${JSON.stringify(value)}`);
}

/**
 * Maps any `ContractEvent` onto the generic `blockchain_events` row shape.
 * The exhaustive `switch` (not a generic spread) is the point: it forces a
 * compile error if a new event variant is ever added without a case here.
 */
export function toBlockchainEventRow(event: ContractEvent): BlockchainEventRow {
  const base = {
    id: event.eventId,
    chain_id: event.chainId,
    transaction_id: event.txSignature,
    block_number: event.blockNumber,
    event_index: event.eventIndex,
    timestamp: event.timestamp,
  };

  switch (event.type) {
    case 'TokenCreated':
      return { ...base, event_type: event.type, payload: { tokenAddress: event.tokenAddress, creator: event.creator, name: event.name, symbol: event.symbol, totalSupply: event.totalSupply, mintAuthorityRevoked: event.mintAuthorityRevoked, freezeAuthorityRevoked: event.freezeAuthorityRevoked } };
    case 'LaunchCreated':
      return { ...base, event_type: event.type, payload: { launchId: event.launchId, tokenAddress: event.tokenAddress, creator: event.creator, launchMode: event.launchMode, creatorAllocationPct: event.creatorAllocationPct } };
    case 'LaunchStateChanged':
      return { ...base, event_type: event.type, payload: { launchId: event.launchId, fromState: event.fromState, toState: event.toState, reason: event.reason } };
    case 'BondingCurveTrade':
      return { ...base, event_type: event.type, payload: { launchId: event.launchId, trader: event.trader, side: event.side, nativeAmount: event.nativeAmount, tokenAmount: event.tokenAmount, feePaid: event.feePaid, priceImpact: event.priceImpact, newPrice: event.newPrice } };
    case 'LaunchGraduated':
      return { ...base, event_type: event.type, payload: { launchId: event.launchId, dexPoolAddress: event.dexPoolAddress, migratedLiquidity: event.migratedLiquidity } };
    case 'LiquidityLocked':
      return { ...base, event_type: event.type, payload: { dexPoolAddress: event.dexPoolAddress, lockedAmount: event.lockedAmount, lockDurationDays: event.lockDurationDays, unlockAt: event.unlockAt } };
    case 'FeeConfigUpdated':
      return { ...base, event_type: event.type, payload: { scope: event.scope, config: event.config, actor: event.actor } };
    case 'TreasuryWithdrawal':
      return { ...base, event_type: event.type, payload: { asset: event.asset, amount: event.amount, destination: event.destination, actor: event.actor } };
    case 'RoleGranted':
      return { ...base, event_type: event.type, payload: { role: event.role, grantee: event.grantee, actor: event.actor } };
    case 'RoleRevoked':
      return { ...base, event_type: event.type, payload: { role: event.role, grantee: event.grantee, actor: event.actor } };
    case 'EmergencyPause':
      return { ...base, event_type: event.type, payload: { scope: event.scope, reason: event.reason, actor: event.actor } };
    case 'EmergencyResume':
      return { ...base, event_type: event.type, payload: { scope: event.scope, actor: event.actor } };
    case 'ContractUpgraded':
      return { ...base, event_type: event.type, payload: { contractName: event.contractName, fromVersion: event.fromVersion, toVersion: event.toVersion, actor: event.actor } };
    default:
      return assertNever(event);
  }
}
