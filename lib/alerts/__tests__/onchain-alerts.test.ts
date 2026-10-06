import { describe, expect, it } from 'vitest';
import { buildMigrationAlert, buildOnchainTradeAlerts } from '@/lib/alerts/onchain-alerts';
import type { NormalizedRealtimeEvent } from '@/lib/server/events/event-types';
import type { TokenLifecycle } from '@/lib/market/lifecycle/types';

const mint = 'TokenMint111111111111111111111111111111111';
const wallet = 'WhaleWallet1111111111111111111111111111111';

function buyEvent(overrides: Partial<NormalizedRealtimeEvent> = {}): NormalizedRealtimeEvent {
  return {
    id: 'trade-1',
    sequence: 1,
    type: 'BUY',
    timestamp: Date.parse('2025-01-01T00:02:00.000Z'),
    signature: 'tx-signature',
    mint,
    wallet,
    amountSol: 12,
    source: 'helius_ws',
    ...overrides,
  };
}

describe('on-chain live alerts', () => {
  it('identifies a large buy with wallet, token, SOL size, and signature', () => {
    const [alert] = buildOnchainTradeAlerts(
      buyEvent(),
      { symbol: 'MEME', name: 'Meme Token' },
      10,
    );

    expect(alert).toMatchObject({
      type: 'WHALE_TRADE',
      token: { mint, symbol: 'MEME' },
      trade: { traderAddress: wallet, amountSol: 12, direction: 'BUY' },
    });
    expect(alert.headline).toContain('12.00 SOL');
    expect(alert.sourceUrl).toContain('tx-signature');
  });

  it('does not label sub-threshold or mock buys as whale activity', () => {
    expect(buildOnchainTradeAlerts(buyEvent({ amountSol: 9.99 }), {}, 10)).toEqual([]);
    expect(buildOnchainTradeAlerts(buyEvent({ source: 'mock' }), {}, 10)).toEqual([]);
  });

  it('labels a large buy shortly after first observation as potential, not confirmed, insider activity', () => {
    const alerts = buildOnchainTradeAlerts(
      buyEvent(),
      { firstSeenAt: '2025-01-01T00:00:00.000Z' },
      10,
    );

    expect(alerts.some((alert) => alert.type === 'INSIDER_ACTIVITY')).toBe(true);
    expect(alerts.find((alert) => alert.type === 'INSIDER_ACTIVITY')?.message)
      .toContain('not proof of insider status');
  });

  it('alerts when a developer wallet sends token balances', () => {
    const devAddress = 'DevWallet11111111111111111111111111111111';
    const event = buyEvent({
      id: 'dev-transfer',
      type: 'TRANSFER',
      wallet: devAddress,
      fromWallet: devAddress,
      toWallet: wallet,
      tokenAmount: 500_000,
      amount: 500_000,
    });
    const [alert] = buildOnchainTradeAlerts(event, { symbol: 'MEME', devAddress }, 10);

    expect(alert).toMatchObject({
      type: 'DEV_ACTIVITY',
      trade: { traderAddress: devAddress, direction: 'TRANSFER', tokenAmount: 500_000 },
    });
    expect(alert.message).toContain('transferred 500,000 MEME');
  });

  it('alerts only on a confirmed migration with a signature and destination pool', () => {
    const lifecycle: TokenLifecycle = {
      mint,
      state: 'MIGRATED',
      launchpad: 'pump.fun',
      curve: null,
      migration: {
        signature: 'migration-signature',
        migratedAt: Date.parse('2025-01-01T00:04:00.000Z'),
        dex: 'Raydium',
        poolAddress: 'Pool1111111111111111111111111111111111111',
        originLaunchpad: 'pump.fun',
      },
      firstSeenAt: Date.parse('2025-01-01T00:00:00.000Z'),
      stateChangedAt: Date.parse('2025-01-01T00:04:00.000Z'),
      source: 'migration-event',
    };

    expect(buildMigrationAlert(lifecycle, { symbol: 'MEME' })).toMatchObject({
      type: 'LAUNCHPAD_MILESTONE',
      headline: '$MEME migrated to Raydium',
      milestone: { type: 'MIGRATION' },
    });
    expect(buildMigrationAlert({ ...lifecycle, migration: null }, {})).toBeNull();
  });
});
