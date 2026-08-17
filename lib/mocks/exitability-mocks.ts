/**
 * Exitability & Execution Engine Mocks — Sprint 8
 *
 * Four distinct liquidity profiles used across API routes and tests:
 *  - SENT:  healthy, deep, multi-pool, stable liquidity.
 *  - QUANT: thin, single-pool, recently declining liquidity.
 *  - BONK:  deep but concentrated in one dominant pool.
 *  - ALPHA: "fake liquidity" — high displayed TVL, CLMM liquidity mostly
 *           positioned out of range, so usable depth is small.
 */

import type { ExitabilityContext, HolderPosition, PoolState } from '@/lib/exitability/types';

const NOW = new Date().toISOString();

function pool(overrides: Partial<PoolState> & Pick<PoolState, 'poolId' | 'dex' | 'kind' | 'tvlUsd' | 'priceUsd'>): PoolState {
  return {
    baseReserve: overrides.tvlUsd / 2 / overrides.priceUsd,
    quoteReserve: overrides.tvlUsd / 2,
    feeTierPct: 0.25,
    observedAt: NOW,
    ...overrides,
  };
}

function holders(specs: Array<[string, number, number, Partial<HolderPosition>?]>): HolderPosition[] {
  return specs.map(([wallet, balanceUsd, supplyPct, extra]) => ({
    wallet,
    balanceUsd,
    supplyPct,
    ...extra,
  }));
}

// ── SENT — healthy, deep, stable ──
export function getSentExitabilityContext(): ExitabilityContext {
  return {
    tokenId: 'dt_sentinel',
    chain: 'solana',
    observedAt: NOW,
    dataCompleteFrom: new Date(Date.now() - 86_400_000).toISOString(),
    dataCompleteTo: NOW,
    recentPriceVolatility: 0.05,
    userPositionUsd: 8_240,
    pools: [
      pool({ poolId: 'sent_ray', dex: 'Raydium', kind: 'CONSTANT_PRODUCT', tvlUsd: 12_000_000, priceUsd: 0.42, ageHours: 24 * 45, lpLocked: true, lpLockedPct: 100 }),
      pool({ poolId: 'sent_orca', dex: 'Orca', kind: 'CONCENTRATED_LIQUIDITY', tvlUsd: 4_500_000, priceUsd: 0.42, activeLiquidityUsd: 2_800_000, feeTierPct: 0.3, ageHours: 24 * 30 }),
      pool({ poolId: 'sent_met', dex: 'Meteora', kind: 'CONSTANT_PRODUCT', tvlUsd: 2_000_000, priceUsd: 0.42, feeTierPct: 0.2, ageHours: 24 * 20 }),
    ],
    holders: holders([
      ['5SentWhale_1', 220_000, 0.018],
      ['5SentWhale_2', 180_000, 0.015],
      ['5SentWhale_3', 120_000, 0.010],
      ['5SentHolder_4', 60_000, 0.005],
      ['5SentHolder_5', 40_000, 0.003],
      ['5SentHolder_6', 25_000, 0.002],
    ]),
  };
}

// ── QUANT — thin, single pool, declining ──
export function getQuantExitabilityContext(): ExitabilityContext {
  const changes = { '5m': -3, '15m': -8, '1h': -22, '4h': -35, '24h': -40 };
  return {
    tokenId: 'dt_quant',
    chain: 'solana',
    observedAt: NOW,
    recentPriceVolatility: 0.25,
    userPositionUsd: 3_000,
    pools: [
      { ...pool({ poolId: 'quant_pump', dex: 'Pump.fun', kind: 'CONSTANT_PRODUCT', tvlUsd: 120_000, priceUsd: 0.008, feeTierPct: 1.0, ageHours: 5, lpLocked: false }), changes } as PoolState & { changes: Record<string, number> },
    ],
    holders: holders([
      ['quant_bot_1', 38_000, 0.09, { clusterId: 'cluster_quant_bots_99' }],
      ['quant_bot_2', 26_000, 0.06, { clusterId: 'cluster_quant_bots_99' }],
      ['quant_bot_3', 18_000, 0.04, { clusterId: 'cluster_quant_bots_99' }],
      ['quant_creator', 30_000, 0.07, { creatorAssociated: true }],
      ['quant_holder_5', 6_000, 0.014],
    ]),
  };
}

// ── BONK — deep but concentrated in one pool ──
export function getBonkExitabilityContext(): ExitabilityContext {
  return {
    tokenId: 'dt_bonk',
    chain: 'solana',
    observedAt: NOW,
    dataCompleteFrom: new Date(Date.now() - 86_400_000).toISOString(),
    dataCompleteTo: NOW,
    recentPriceVolatility: 0.08,
    pools: [
      pool({ poolId: 'bonk_ray', dex: 'Raydium', kind: 'CONSTANT_PRODUCT', tvlUsd: 14_000_000, priceUsd: 0.000022, ageHours: 24 * 200, lpLocked: true, lpLockedPct: 100 }),
      pool({ poolId: 'bonk_orca', dex: 'Orca', kind: 'CONSTANT_PRODUCT', tvlUsd: 900_000, priceUsd: 0.000022, feeTierPct: 0.3, ageHours: 24 * 120 }),
    ],
    holders: holders([
      ['bonk_whale_1', 1_400_000, 0.058, { clusterId: 'bonk_cluster_a' }],
      ['bonk_whale_2', 900_000, 0.037, { clusterId: 'bonk_cluster_a' }],
      ['bonk_whale_3', 600_000, 0.025],
      ['bonk_holder_4', 300_000, 0.012],
    ]),
  };
}

// ── ALPHA — fake liquidity: high TVL, mostly out-of-range CLMM ──
export function getAlphaExitabilityContext(): ExitabilityContext {
  return {
    tokenId: 'dt_alpha',
    chain: 'solana',
    observedAt: NOW,
    recentPriceVolatility: 0.35,
    userPositionUsd: 5_000,
    pools: [
      pool({
        poolId: 'alpha_clmm',
        dex: 'Orca',
        kind: 'CONCENTRATED_LIQUIDITY',
        tvlUsd: 1_000_000,
        priceUsd: 0.05,
        feeTierPct: 0.3,
        ageHours: 8,
        // Displayed TVL $1M, but active liquidity around price is only ~$45K —
        // most liquidity is parked in out-of-range bands well below price.
        activeLiquidityUsd: 45_000,
        bands: [
          { lowerPriceRatio: 0.98, upperPriceRatio: 1.02, liquidityUsd: 30_000 },
          { lowerPriceRatio: 0.9, upperPriceRatio: 1.1, liquidityUsd: 15_000 },
          { lowerPriceRatio: 0.4, upperPriceRatio: 0.6, liquidityUsd: 955_000 }, // out of range
        ],
      }),
    ],
    holders: holders([
      ['alpha_insider_1', 90_000, 0.09, { clusterId: 'alpha_team', creatorAssociated: true, earlyParticipant: true }],
      ['alpha_insider_2', 70_000, 0.07, { clusterId: 'alpha_team', earlyParticipant: true }],
      ['alpha_insider_3', 55_000, 0.055, { clusterId: 'alpha_team', earlyParticipant: true }],
      ['alpha_sniper_4', 40_000, 0.04, { earlyParticipant: true }],
    ]),
  };
}

export function getExitabilityContext(symbol: string): ExitabilityContext | null {
  switch (symbol.toUpperCase()) {
    case 'SENT':
      return getSentExitabilityContext();
    case 'QUANT':
      return getQuantExitabilityContext();
    case 'BONK':
      return getBonkExitabilityContext();
    case 'ALPHA':
      return getAlphaExitabilityContext();
    default:
      return null;
  }
}
