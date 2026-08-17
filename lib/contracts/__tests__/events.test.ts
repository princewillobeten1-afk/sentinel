import { describe, expect, it } from 'vitest';
import { LaunchState } from '@/lib/launchpad/types';
import { toBlockchainEventRow, type ContractEvent } from '../events';

const base = {
  eventId: 'evt_1',
  chainId: 'solana' as const,
  txSignature: 'sig_abc123',
  blockNumber: 12345,
  eventIndex: 0,
  timestamp: '2026-08-15T00:00:00.000Z',
};

const cases: ContractEvent[] = [
  { ...base, type: 'TokenCreated', tokenAddress: 'tokenAddr', creator: 'creatorAddr', name: 'Sentinel', symbol: 'SENT', totalSupply: '1000000000', mintAuthorityRevoked: true, freezeAuthorityRevoked: true },
  { ...base, type: 'LaunchCreated', launchId: 'launch_1', tokenAddress: 'tokenAddr', creator: 'creatorAddr', launchMode: 'BONDING_CURVE', creatorAllocationPct: 5 },
  { ...base, type: 'LaunchStateChanged', launchId: 'launch_1', fromState: LaunchState.CREATED, toState: LaunchState.VALIDATING },
  { ...base, type: 'BondingCurveTrade', launchId: 'launch_1', trader: 'traderAddr', side: 'BUY', nativeAmount: '1000000000', tokenAmount: '5000000', feePaid: '10000000', priceImpact: 0.02, newPrice: '0.0002' },
  { ...base, type: 'LaunchGraduated', launchId: 'launch_1', dexPoolAddress: 'poolAddr', migratedLiquidity: '30000000000' },
  { ...base, type: 'LiquidityLocked', dexPoolAddress: 'poolAddr', lockedAmount: '30000000000', lockDurationDays: 90, unlockAt: '2026-11-15T00:00:00.000Z' },
  { ...base, type: 'FeeConfigUpdated', scope: 'PLATFORM', config: { buyFeeBps: 100, sellFeeBps: 100, protocolShareBps: 5000, creatorShareBps: 5000 }, actor: 'adminAddr' },
  { ...base, type: 'TreasuryWithdrawal', asset: 'NATIVE', amount: '5000000000', destination: 'destAddr', actor: 'adminAddr' },
  { ...base, type: 'RoleGranted', role: 'FEE_MANAGER', grantee: 'granteeAddr', actor: 'adminAddr' },
  { ...base, type: 'RoleRevoked', role: 'FEE_MANAGER', grantee: 'granteeAddr', actor: 'adminAddr' },
  { ...base, type: 'EmergencyPause', scope: 'LAUNCHPAD', reason: 'Suspicious volume spike', actor: 'adminAddr' },
  { ...base, type: 'EmergencyResume', scope: 'LAUNCHPAD', actor: 'adminAddr' },
  { ...base, type: 'ContractUpgraded', contractName: 'Launchpad', fromVersion: '0.1.0', toVersion: '0.2.0', actor: 'adminAddr' },
];

describe('toBlockchainEventRow', () => {
  it('covers all 13 ContractEvent variants (fails loudly if a new variant is added without a test case)', () => {
    expect(cases).toHaveLength(13);
  });

  it.each(cases.map((event) => [event.type, event] as const))('maps %s onto the blockchain_events row shape', (_type, event) => {
    const row = toBlockchainEventRow(event);

    expect(row.id).toBe(event.eventId);
    expect(row.chain_id).toBe(event.chainId);
    expect(row.transaction_id).toBe(event.txSignature);
    expect(row.block_number).toBe(event.blockNumber);
    expect(row.event_index).toBe(event.eventIndex);
    expect(row.event_type).toBe(event.type);
    expect(row.timestamp).toBe(event.timestamp);
    expect(row.payload).toBeTypeOf('object');
    expect(row.payload).not.toHaveProperty('eventId');
    expect(row.payload).not.toHaveProperty('type');
  });

  it('round-trips a representative field through the payload for a spot-checked variant', () => {
    const row = toBlockchainEventRow(cases[3]); // BondingCurveTrade
    expect(row.payload).toMatchObject({ side: 'BUY', nativeAmount: '1000000000', priceImpact: 0.02 });
  });
});
