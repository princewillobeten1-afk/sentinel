/**
 * Portfolio Intelligence Mocks — Sprint 9
 *
 * One coherent multi-wallet, multi-chain portfolio that exercises every path
 * the engines are required to handle:
 *
 *  - SENT   deep, healthy Solana position built from several buys + a partial exit
 *  - BONK   concentrated liquidity, held across two grouped wallets via an
 *           internal transfer (must not produce realized P&L)
 *  - ALPHA  "fake liquidity" token — mark value far above executable value
 *  - QUANT  thin, declining liquidity, fully exited (realized loss)
 *  - DRIFT  airdropped — unknown cost basis
 *  - GHOST  no price source — VALUE_UNAVAILABLE
 *  - SOL    native asset
 *  - ETH    native asset on Ethereum, bridged to Base
 *  - NEWX   migrated from OLDX, economic history preserved
 *
 * Plus: a duplicate chain event, a reorged transaction, and a pending sell.
 */

import type { ExitabilityContext, ExitabilityReport } from '@/lib/exitability/types';
import { processExitabilityPipeline } from '@/lib/exitability';
import {
  getSentExitabilityContext,
  getQuantExitabilityContext,
  getBonkExitabilityContext,
  getAlphaExitabilityContext,
} from '@/lib/mocks/exitability-mocks';
import type {
  PortfolioContext,
  PortfolioWallet,
  Position,
  PriceQuote,
  RawLedgerEvent,
  TokenMetaInput,
  ValuePoint,
  WalletGroup,
} from '@/lib/portfolio/types';
import { processPortfolioPipeline } from '@/lib/portfolio/pipeline';

const NOW = new Date();
const NOW_ISO = NOW.toISOString();

function daysAgo(days: number, hours = 0): string {
  return new Date(NOW.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();
}

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

// ────────────────────────────────────────────────────────────────────────────
// Wallets & groups (spec §38, §39)
// ────────────────────────────────────────────────────────────────────────────

export const MOCK_MAIN_WALLET = '7xK99zK8mP2xQ5wN3a19';
export const MOCK_TRADING_WALLET = '9tR4bV7cX1zA6yU2wQ8e';
export const MOCK_BOT_WALLET = '0xB07A1c4E9d3F5a72Bc61';
export const MOCK_COLD_WALLET = '0xC01D5f2A8b91E4d3F70a';
export const MOCK_EXTERNAL_WALLET = 'ExT3rNa1W4l1eTnotMine';

export const MOCK_WALLETS: PortfolioWallet[] = [
  {
    address: MOCK_MAIN_WALLET,
    chain: 'solana',
    label: 'My Main Wallet',
    role: 'MAIN',
    linkedBy: 'USER',
    linkConfidence: 1,
    addedAt: daysAgo(120),
  },
  {
    address: MOCK_TRADING_WALLET,
    chain: 'solana',
    label: 'My Trading Wallet',
    role: 'TRADING',
    linkedBy: 'USER',
    linkConfidence: 1,
    addedAt: daysAgo(90),
  },
  {
    address: MOCK_BOT_WALLET,
    chain: 'base',
    label: 'Bot Wallet',
    role: 'BOT',
    linkedBy: 'USER',
    linkConfidence: 1,
    addedAt: daysAgo(45),
  },
  {
    address: MOCK_COLD_WALLET,
    chain: 'ethereum',
    label: 'Cold Wallet',
    role: 'COLD',
    linkedBy: 'USER',
    linkConfidence: 1,
    addedAt: daysAgo(200),
  },
];

export const MOCK_WALLET_GROUP: WalletGroup = {
  id: 'wg_sentinel_default',
  userId: 'user_001',
  name: 'Primary Portfolio',
  wallets: MOCK_WALLETS,
  visibility: 'PRIVATE',
  createdAt: daysAgo(200),
};

// ────────────────────────────────────────────────────────────────────────────
// Token metadata
// ────────────────────────────────────────────────────────────────────────────

export const MOCK_PORTFOLIO_TOKENS: Record<string, TokenMetaInput> = {
  dt_sentinel: {
    tokenId: 'dt_sentinel',
    symbol: 'SENT',
    name: 'Solana Sentinel Token',
    chain: 'solana',
    creatorId: 'creator_sentinel_labs',
    creatorLabel: 'Sentinel Labs',
    intelligenceScore: 82,
    organicScore: 78,
    ownershipConcentration: 24,
    creatorReputation: 81,
    insiderRisk: 12,
    volatility: 0.05,
    correlationGroup: 'solana_infra',
  },
  dt_bonk: {
    tokenId: 'dt_bonk',
    symbol: 'BONK',
    name: 'Bonk Doge Token',
    chain: 'solana',
    creatorId: 'creator_bonk_dao',
    creatorLabel: 'Bonk DAO',
    intelligenceScore: 68,
    organicScore: 71,
    ownershipConcentration: 46,
    creatorReputation: 64,
    insiderRisk: 22,
    volatility: 0.08,
    correlationGroup: 'solana_memes',
  },
  dt_alpha: {
    tokenId: 'dt_alpha',
    symbol: 'ALPHA',
    name: 'Alpha Matrix AI',
    chain: 'solana',
    creatorId: 'creator_alpha_team',
    creatorLabel: 'Alpha Team',
    intelligenceScore: 18,
    organicScore: 14,
    ownershipConcentration: 88,
    creatorReputation: 12,
    insiderRisk: 92,
    volatility: 0.45,
    correlationGroup: 'solana_memes',
  },
  dt_quant: {
    tokenId: 'dt_quant',
    symbol: 'QUANT',
    name: 'Cyber Quantum AI',
    chain: 'solana',
    creatorId: 'creator_quant_anon',
    creatorLabel: 'Unattributed deployer',
    intelligenceScore: 31,
    organicScore: 26,
    ownershipConcentration: 71,
    creatorReputation: 24,
    insiderRisk: 68,
    volatility: 0.25,
    correlationGroup: 'solana_memes',
  },
  dt_drift: {
    tokenId: 'dt_drift',
    symbol: 'DRIFT',
    name: 'Drift Protocol',
    chain: 'solana',
    intelligenceScore: 74,
    organicScore: 69,
    ownershipConcentration: 33,
    volatility: 0.12,
  },
  dt_ghost: {
    tokenId: 'dt_ghost',
    symbol: 'GHOST',
    name: 'Ghost Chain',
    chain: 'solana',
    // Deliberately sparse: no intelligence coverage AND no price feed.
  },
  dt_sol: {
    tokenId: 'dt_sol',
    symbol: 'SOL',
    name: 'Solana',
    chain: 'solana',
    isNative: true,
    intelligenceScore: 95,
    organicScore: 92,
    ownershipConcentration: 12,
    volatility: 0.04,
  },
  dt_eth: {
    tokenId: 'dt_eth',
    symbol: 'ETH',
    name: 'Ethereum',
    chain: 'ethereum',
    isNative: true,
    intelligenceScore: 96,
    organicScore: 94,
    ownershipConcentration: 9,
    volatility: 0.03,
  },
  dt_eth_base: {
    tokenId: 'dt_eth_base',
    symbol: 'ETH',
    name: 'Base ETH',
    chain: 'base',
    isNative: true,
    intelligenceScore: 94,
    organicScore: 91,
    ownershipConcentration: 10,
    volatility: 0.03,
  },
  dt_usdc: {
    tokenId: 'dt_usdc',
    symbol: 'USDC',
    name: 'USD Coin',
    chain: 'solana',
    isStable: true,
    intelligenceScore: 97,
    organicScore: 95,
    ownershipConcentration: 8,
    volatility: 0.001,
  },
  dt_oldx: {
    tokenId: 'dt_oldx',
    symbol: 'OLDX',
    name: 'Legacy X (pre-migration)',
    chain: 'solana',
    intelligenceScore: 55,
  },
  dt_newx: {
    tokenId: 'dt_newx',
    symbol: 'NEWX',
    name: 'Nexus X',
    chain: 'solana',
    intelligenceScore: 66,
    organicScore: 61,
    ownershipConcentration: 38,
    volatility: 0.15,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Ledger events (blockchain facts)
// ────────────────────────────────────────────────────────────────────────────

function swap(
  overrides: Partial<RawLedgerEvent> &
    Pick<RawLedgerEvent, 'id' | 'txHash' | 'wallet' | 'tokenId' | 'symbol' | 'direction' | 'quantity' | 'timestamp'>,
): RawLedgerEvent {
  return {
    chain: 'solana',
    source: 'DEX_SWAP',
    status: 'CONFIRMED',
    strategy: 'MANUAL',
    tradingFeeUsd: 0,
    networkFeeUsd: 0.03,
    dexFeeUsd: 0,
    ...overrides,
  };
}

export const MOCK_LEDGER_EVENTS: RawLedgerEvent[] = [
  // ── SENT: three buys and one partial exit (FIFO exercise) ──
  swap({
    id: 'evt_sent_buy_1',
    txHash: 'tx_sent_buy_1',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_sentinel',
    symbol: 'SENT',
    direction: 'IN',
    quantity: 40_000,
    pricePerTokenUsd: 0.25,
    quotedPricePerTokenUsd: 0.248,
    tradingFeeUsd: 10,
    dexFeeUsd: 25,
    timestamp: daysAgo(62),
  }),
  swap({
    id: 'evt_sent_buy_2',
    txHash: 'tx_sent_buy_2',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_sentinel',
    symbol: 'SENT',
    direction: 'IN',
    quantity: 25_000,
    pricePerTokenUsd: 0.31,
    quotedPricePerTokenUsd: 0.305,
    tradingFeeUsd: 7.75,
    dexFeeUsd: 19.4,
    timestamp: daysAgo(38),
  }),
  swap({
    id: 'evt_sent_buy_3',
    txHash: 'tx_sent_buy_3',
    wallet: MOCK_TRADING_WALLET,
    tokenId: 'dt_sentinel',
    symbol: 'SENT',
    direction: 'IN',
    quantity: 18_000,
    pricePerTokenUsd: 0.36,
    quotedPricePerTokenUsd: 0.3555,
    tradingFeeUsd: 6.48,
    dexFeeUsd: 16.2,
    strategy: 'LIMIT_ORDER',
    timestamp: daysAgo(11),
  }),
  swap({
    id: 'evt_sent_sell_1',
    txHash: 'tx_sent_sell_1',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_sentinel',
    symbol: 'SENT',
    direction: 'OUT',
    quantity: 20_000,
    pricePerTokenUsd: 0.41,
    quotedPricePerTokenUsd: 0.415,
    tradingFeeUsd: 8.2,
    dexFeeUsd: 20.5,
    strategy: 'MARKET_ORDER',
    timestamp: daysAgo(5),
  }),

  // ── BONK: buy, then an internal transfer between two grouped wallets ──
  swap({
    id: 'evt_bonk_buy_1',
    txHash: 'tx_bonk_buy_1',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_bonk',
    symbol: 'BONK',
    direction: 'IN',
    quantity: 900_000_000,
    pricePerTokenUsd: 0.0000185,
    quotedPricePerTokenUsd: 0.0000184,
    tradingFeeUsd: 16.65,
    dexFeeUsd: 41.6,
    timestamp: daysAgo(74),
  }),
  {
    id: 'evt_bonk_transfer_out',
    txHash: 'tx_bonk_internal_1',
    chain: 'solana',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_bonk',
    symbol: 'BONK',
    direction: 'OUT',
    quantity: 400_000_000,
    counterpartyWallet: MOCK_TRADING_WALLET,
    networkFeeUsd: 0.02,
    source: 'TRANSFER',
    status: 'CONFIRMED',
    timestamp: daysAgo(30),
  },
  {
    id: 'evt_bonk_transfer_in',
    txHash: 'tx_bonk_internal_1',
    chain: 'solana',
    wallet: MOCK_TRADING_WALLET,
    tokenId: 'dt_bonk',
    symbol: 'BONK',
    direction: 'IN',
    quantity: 400_000_000,
    counterpartyWallet: MOCK_MAIN_WALLET,
    source: 'TRANSFER',
    status: 'CONFIRMED',
    timestamp: daysAgo(30),
  },

  // ── ALPHA: bought into a token whose displayed liquidity is not executable ──
  swap({
    id: 'evt_alpha_buy_1',
    txHash: 'tx_alpha_buy_1',
    wallet: MOCK_TRADING_WALLET,
    tokenId: 'dt_alpha',
    symbol: 'ALPHA',
    direction: 'IN',
    quantity: 700_000,
    pricePerTokenUsd: 0.041,
    quotedPricePerTokenUsd: 0.0385,
    requestedQuantity: 750_000,
    tradingFeeUsd: 28.7,
    dexFeeUsd: 71.75,
    strategy: 'LAUNCH_PARTICIPATION',
    timestamp: daysAgo(9),
  }),

  // ── QUANT: bought and fully exited at a loss ──
  swap({
    id: 'evt_quant_buy_1',
    txHash: 'tx_quant_buy_1',
    wallet: MOCK_TRADING_WALLET,
    tokenId: 'dt_quant',
    symbol: 'QUANT',
    direction: 'IN',
    quantity: 1_200_000,
    pricePerTokenUsd: 0.0125,
    quotedPricePerTokenUsd: 0.0122,
    tradingFeeUsd: 15,
    dexFeeUsd: 37.5,
    strategy: 'COPY_TRADE',
    timestamp: daysAgo(21),
  }),
  swap({
    id: 'evt_quant_sell_1',
    txHash: 'tx_quant_sell_1',
    wallet: MOCK_TRADING_WALLET,
    tokenId: 'dt_quant',
    symbol: 'QUANT',
    direction: 'OUT',
    quantity: 1_200_000,
    pricePerTokenUsd: 0.008,
    quotedPricePerTokenUsd: 0.0086,
    tradingFeeUsd: 9.6,
    dexFeeUsd: 24,
    strategy: 'STOP_LOSS',
    timestamp: daysAgo(6),
  }),

  // ── DRIFT: airdrop — cost basis must stay unknown ──
  {
    id: 'evt_drift_airdrop',
    txHash: 'tx_drift_airdrop',
    chain: 'solana',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_drift',
    symbol: 'DRIFT',
    direction: 'IN',
    quantity: 5_000,
    source: 'AIRDROP',
    status: 'CONFIRMED',
    networkFeeUsd: 0.01,
    hints: { knownAirdropProgram: 'drift_s1_distribution' },
    timestamp: daysAgo(48),
  },

  // ── GHOST: held, but no price source will serve it ──
  swap({
    id: 'evt_ghost_buy',
    txHash: 'tx_ghost_buy',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_ghost',
    symbol: 'GHOST',
    direction: 'IN',
    quantity: 250_000,
    pricePerTokenUsd: 0.004,
    tradingFeeUsd: 1,
    dexFeeUsd: 2.5,
    timestamp: daysAgo(33),
  }),

  // ── SOL: native asset ──
  swap({
    id: 'evt_sol_buy',
    txHash: 'tx_sol_buy',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_sol',
    symbol: 'SOL',
    isNative: true,
    direction: 'IN',
    quantity: 120,
    pricePerTokenUsd: 138,
    tradingFeeUsd: 16.56,
    timestamp: daysAgo(110),
  }),

  // ── USDC: stable, counts as available balance ──
  swap({
    id: 'evt_usdc_buy',
    txHash: 'tx_usdc_buy',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_usdc',
    symbol: 'USDC',
    direction: 'IN',
    quantity: 8_400,
    pricePerTokenUsd: 1,
    tradingFeeUsd: 4.2,
    timestamp: daysAgo(20),
  }),

  // ── ETH bridged Ethereum → Base (must not read as sell + buy) ──
  swap({
    id: 'evt_eth_buy',
    txHash: 'tx_eth_buy',
    chain: 'ethereum',
    wallet: MOCK_COLD_WALLET,
    tokenId: 'dt_eth',
    symbol: 'ETH',
    isNative: true,
    direction: 'IN',
    quantity: 6,
    pricePerTokenUsd: 2_450,
    tradingFeeUsd: 44.1,
    networkFeeUsd: 12.4,
    timestamp: daysAgo(150),
  }),
  {
    id: 'evt_eth_bridge_out',
    txHash: 'tx_eth_bridge_out',
    chain: 'ethereum',
    wallet: MOCK_COLD_WALLET,
    tokenId: 'dt_eth',
    symbol: 'ETH',
    isNative: true,
    direction: 'OUT',
    quantity: 2,
    counterpartyChain: 'base',
    source: 'BRIDGE',
    status: 'CONFIRMED',
    networkFeeUsd: 8.2,
    hints: { bridgeId: 'bridge_eth_base_0x91', bridgeProtocol: 'Base Bridge' },
    timestamp: daysAgo(40),
  },
  {
    id: 'evt_eth_bridge_in',
    txHash: 'tx_eth_bridge_in',
    chain: 'base',
    wallet: MOCK_BOT_WALLET,
    tokenId: 'dt_eth_base',
    symbol: 'ETH',
    isNative: true,
    direction: 'IN',
    quantity: 2,
    counterpartyChain: 'ethereum',
    source: 'BRIDGE',
    status: 'CONFIRMED',
    networkFeeUsd: 0.4,
    hints: { bridgeId: 'bridge_eth_base_0x91', bridgeProtocol: 'Base Bridge' },
    timestamp: daysAgo(40),
  },

  // ── OLDX → NEWX migration (economic history preserved) ──
  swap({
    id: 'evt_oldx_buy',
    txHash: 'tx_oldx_buy',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_oldx',
    symbol: 'OLDX',
    direction: 'IN',
    quantity: 100_000,
    pricePerTokenUsd: 0.02,
    tradingFeeUsd: 4,
    dexFeeUsd: 5,
    timestamp: daysAgo(85),
  }),
  {
    id: 'evt_oldx_migrate_out',
    txHash: 'tx_migration_1',
    chain: 'solana',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_oldx',
    symbol: 'OLDX',
    direction: 'OUT',
    quantity: 100_000,
    source: 'MIGRATION',
    status: 'CONFIRMED',
    networkFeeUsd: 0.02,
    timestamp: daysAgo(26),
  },
  {
    id: 'evt_newx_migrate_in',
    txHash: 'tx_migration_1',
    chain: 'solana',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_newx',
    symbol: 'NEWX',
    direction: 'IN',
    quantity: 50_000,
    source: 'MIGRATION',
    status: 'CONFIRMED',
    hints: { migrationFromTokenId: 'dt_oldx', migrationRatio: 0.5 },
    timestamp: daysAgo(26),
  },

  // ── Adversarial: duplicate ingestion of an already-applied event ──
  swap({
    id: 'evt_sent_buy_2_duplicate',
    txHash: 'tx_sent_buy_2',
    wallet: MOCK_MAIN_WALLET,
    tokenId: 'dt_sentinel',
    symbol: 'SENT',
    direction: 'IN',
    quantity: 25_000,
    pricePerTokenUsd: 0.31,
    tradingFeeUsd: 7.75,
    dexFeeUsd: 19.4,
    timestamp: daysAgo(38),
  }),

  // ── Adversarial: a transaction that did not survive the chain ──
  swap({
    id: 'evt_alpha_buy_reorged',
    txHash: 'tx_alpha_buy_reorged',
    wallet: MOCK_TRADING_WALLET,
    tokenId: 'dt_alpha',
    symbol: 'ALPHA',
    direction: 'IN',
    quantity: 300_000,
    pricePerTokenUsd: 0.044,
    tradingFeeUsd: 13.2,
    status: 'REORGED',
    timestamp: daysAgo(8),
  }),

  // ── Pending sell — shown, never treated as final ──
  swap({
    id: 'evt_alpha_sell_pending',
    txHash: 'tx_alpha_sell_pending',
    wallet: MOCK_TRADING_WALLET,
    tokenId: 'dt_alpha',
    symbol: 'ALPHA',
    direction: 'OUT',
    quantity: 150_000,
    quotedPricePerTokenUsd: 0.049,
    status: 'PENDING',
    strategy: 'MARKET_ORDER',
    timestamp: minutesAgo(2),
  }),
];

// ────────────────────────────────────────────────────────────────────────────
// Prices (spec §42)
// ────────────────────────────────────────────────────────────────────────────

function price(
  tokenId: string,
  chain: string,
  priceUsd: number | null,
  overrides: Partial<PriceQuote> = {},
): PriceQuote {
  return {
    tokenId,
    chain,
    priceUsd,
    priceSource: 'sentinel_market_aggregator',
    priceTimestamp: minutesAgo(0.3),
    confidence: 0.94,
    status: priceUsd === null ? 'UNAVAILABLE' : 'KNOWN',
    ...overrides,
  };
}

export const MOCK_PRICES: Record<string, PriceQuote> = {
  dt_sentinel: price('dt_sentinel', 'solana', 0.42),
  dt_bonk: price('dt_bonk', 'solana', 0.000022),
  dt_alpha: price('dt_alpha', 'solana', 0.05, { confidence: 0.72 }),
  dt_quant: price('dt_quant', 'solana', 0.008, { confidence: 0.6 }),
  dt_drift: price('dt_drift', 'solana', 0.94),
  // GHOST has no feed at all — must resolve to VALUE_UNAVAILABLE, not 0.
  dt_ghost: price('dt_ghost', 'solana', null, { priceSource: 'none', confidence: 0 }),
  dt_sol: price('dt_sol', 'solana', 152.4),
  dt_eth: price('dt_eth', 'ethereum', 2_610),
  dt_eth_base: price('dt_eth_base', 'base', 2_608),
  dt_usdc: price('dt_usdc', 'solana', 1, { confidence: 0.99 }),
  dt_oldx: price('dt_oldx', 'solana', 0, { confidence: 0.2, status: 'ESTIMATED' }),
  // NEWX price is deliberately old — must be marked STALE, not used silently.
  dt_newx: price('dt_newx', 'solana', 0.055, {
    priceSource: 'last_known_dex_trade',
    priceTimestamp: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(),
    confidence: 0.55,
  }),
};

// ────────────────────────────────────────────────────────────────────────────
// Exitability (reuses Sprint 8 engine output)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Deep, boring liquidity profile used for native assets and stables. These are
 * not interesting risk cases; they exist so the portfolio has realistic exit
 * coverage instead of a headline exit value assembled from three tokens.
 */
function deepLiquidityContext(
  tokenId: string,
  chain: string,
  priceUsd: number,
  tvlUsd: number,
): ExitabilityContext {
  return {
    tokenId,
    chain,
    observedAt: NOW_ISO,
    dataCompleteFrom: daysAgo(1),
    dataCompleteTo: NOW_ISO,
    recentPriceVolatility: 0.02,
    pools: [
      {
        poolId: `${tokenId}_primary`,
        dex: 'Aggregated',
        kind: 'CONSTANT_PRODUCT',
        baseReserve: tvlUsd / 2 / priceUsd,
        quoteReserve: tvlUsd / 2,
        priceUsd,
        tvlUsd,
        feeTierPct: 0.05,
        ageHours: 24 * 365,
        lpLocked: true,
        lpLockedPct: 100,
        observedAt: NOW_ISO,
      },
      {
        poolId: `${tokenId}_secondary`,
        dex: 'Aggregated-2',
        kind: 'CONSTANT_PRODUCT',
        baseReserve: tvlUsd / 4 / priceUsd,
        quoteReserve: tvlUsd / 4,
        priceUsd,
        tvlUsd: tvlUsd / 2,
        feeTierPct: 0.05,
        ageHours: 24 * 300,
        observedAt: NOW_ISO,
      },
    ],
    holders: [
      { wallet: `${tokenId}_h1`, balanceUsd: tvlUsd * 0.01, supplyPct: 0.01 },
      { wallet: `${tokenId}_h2`, balanceUsd: tvlUsd * 0.008, supplyPct: 0.008 },
    ],
  };
}

/** Mid-tier profile: real liquidity, but thinner and less stable. */
function midLiquidityContext(tokenId: string, priceUsd: number, tvlUsd: number): ExitabilityContext {
  return {
    tokenId,
    chain: 'solana',
    observedAt: NOW_ISO,
    recentPriceVolatility: 0.14,
    pools: [
      {
        poolId: `${tokenId}_ray`,
        dex: 'Raydium',
        kind: 'CONSTANT_PRODUCT',
        baseReserve: tvlUsd / 2 / priceUsd,
        quoteReserve: tvlUsd / 2,
        priceUsd,
        tvlUsd,
        feeTierPct: 0.25,
        ageHours: 24 * 60,
        observedAt: NOW_ISO,
      },
    ],
    holders: [
      { wallet: `${tokenId}_w1`, balanceUsd: tvlUsd * 0.06, supplyPct: 0.06 },
      { wallet: `${tokenId}_w2`, balanceUsd: tvlUsd * 0.04, supplyPct: 0.04 },
      { wallet: `${tokenId}_w3`, balanceUsd: tvlUsd * 0.03, supplyPct: 0.03 },
    ],
  };
}

let exitabilityCache: Record<string, ExitabilityReport> | null = null;

export function getMockExitability(): Record<string, ExitabilityReport> {
  if (exitabilityCache) return exitabilityCache;

  const reports: Record<string, ExitabilityReport> = {};
  const contexts: ExitabilityContext[] = [
    getSentExitabilityContext(),
    getQuantExitabilityContext(),
    getBonkExitabilityContext(),
    getAlphaExitabilityContext(),
    deepLiquidityContext('dt_sol', 'solana', 152.4, 900_000_000),
    deepLiquidityContext('dt_eth', 'ethereum', 2_610, 2_400_000_000),
    deepLiquidityContext('dt_eth_base', 'base', 2_608, 180_000_000),
    deepLiquidityContext('dt_usdc', 'solana', 1, 1_200_000_000),
    midLiquidityContext('dt_drift', 0.94, 6_800_000),
    midLiquidityContext('dt_newx', 0.055, 740_000),
  ];

  for (const context of contexts) {
    reports[context.tokenId] = processExitabilityPipeline({ context }).exitability;
  }

  // GHOST deliberately has no exitability analysis: it is the token where both
  // price and liquidity data are missing.
  exitabilityCache = reports;
  return reports;
}

// ────────────────────────────────────────────────────────────────────────────
// Snapshot history (spec §34, §35)
// ────────────────────────────────────────────────────────────────────────────

export function getMockHistory(): ValuePoint[] {
  // A rise into a peak at ~$154K, then a drawdown to the present ~$129K, so
  // peak / max drawdown / current drawdown are all non-trivial. The final point
  // sits just below the live computed value so today's change stays realistic.
  const shape = [
    [45, 86_200, 82_900],
    [40, 94_500, 91_000],
    [35, 101_300, 97_400],
    [30, 110_900, 106_800],
    [25, 121_400, 116_900],
    [20, 133_600, 128_600],
    [15, 154_200, 148_100],
    [10, 148_700, 142_600],
    [7, 141_100, 135_200],
    [5, 136_300, 130_500],
    [3, 133_100, 127_400],
    [1, 130_400, 124_800],
    [0.5, 129_600, 124_000],
  ] as const;

  return shape.map(([days, mark, exit]) => ({
    at: daysAgo(days),
    markValueUsd: mark,
    estimatedExitValueUsd: exit,
    netPnlUsd: Math.round((mark - 113_600) * 100) / 100,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Assembled context
// ────────────────────────────────────────────────────────────────────────────

export function getMockPortfolioContext(
  overrides: Partial<PortfolioContext> = {},
): PortfolioContext {
  return {
    portfolioId: 'pf_sentinel_primary',
    userId: 'user_001',
    walletGroupId: MOCK_WALLET_GROUP.id,
    wallets: MOCK_WALLETS,
    events: MOCK_LEDGER_EVENTS,
    tokens: MOCK_PORTFOLIO_TOKENS,
    prices: MOCK_PRICES,
    exitability: getMockExitability(),
    history: getMockHistory(),
    previousPositions: getMockPreviousPositions(),
    method: 'FIFO',
    priceFreshnessSeconds: 120,
    observedAt: NOW_ISO,
    ...overrides,
  };
}

/**
 * The previous portfolio state, used to exercise change detection (spec §30).
 *
 * Yesterday ALPHA still had healthy liquidity and a clean intelligence read;
 * today it does not. Running the same pipeline against the earlier inputs
 * guarantees the two snapshots are structurally comparable rather than
 * hand-written to disagree.
 */
let previousPositionsCache: Position[] | null = null;

export function getMockPreviousPositions(): Position[] {
  if (previousPositionsCache) return previousPositionsCache;

  const yesterday = daysAgo(1);
  const healthierAlpha = processExitabilityPipeline({
    context: {
      ...getAlphaExitabilityContext(),
      observedAt: yesterday,
      recentPriceVolatility: 0.12,
      pools: [
        {
          poolId: 'alpha_clmm',
          dex: 'Orca',
          kind: 'CONCENTRATED_LIQUIDITY',
          baseReserve: 1_000_000 / 2 / 0.05,
          quoteReserve: 500_000,
          priceUsd: 0.05,
          tvlUsd: 1_000_000,
          feeTierPct: 0.3,
          ageHours: 200,
          activeLiquidityUsd: 480_000,
          observedAt: yesterday,
        },
      ],
      holders: [{ wallet: 'alpha_holder_1', balanceUsd: 20_000, supplyPct: 0.02 }],
    },
  }).exitability;

  const result = processPortfolioPipeline({
    context: {
      portfolioId: 'pf_sentinel_primary',
      userId: 'user_001',
      walletGroupId: MOCK_WALLET_GROUP.id,
      wallets: MOCK_WALLETS,
      // Only events that had already confirmed a day ago.
      events: MOCK_LEDGER_EVENTS.filter(
        (event) => Date.parse(event.timestamp) <= Date.parse(yesterday) && event.status === 'CONFIRMED',
      ),
      tokens: {
        ...MOCK_PORTFOLIO_TOKENS,
        dt_alpha: {
          ...MOCK_PORTFOLIO_TOKENS.dt_alpha,
          intelligenceScore: 54,
          organicScore: 58,
          ownershipConcentration: 41,
          creatorReputation: 49,
          insiderRisk: 33,
          volatility: 0.12,
        },
      },
      prices: { ...MOCK_PRICES, dt_alpha: price('dt_alpha', 'solana', 0.047) },
      exitability: { ...getMockExitability(), dt_alpha: healthierAlpha },
      history: getMockHistory(),
      method: 'FIFO',
      observedAt: yesterday,
    },
  });

  previousPositionsCache = result.positions;
  return previousPositionsCache;
}

/**
 * Single-wallet variant used to prove wallet separation: the same events,
 * but only the main wallet is grouped, so the BONK move to the trading wallet
 * is no longer internal.
 */
export function getSingleWalletContext(): PortfolioContext {
  return getMockPortfolioContext({
    portfolioId: 'pf_sentinel_main_only',
    wallets: [MOCK_WALLETS[0]],
  });
}

/** Portfolio holding only the illiquid ALPHA position (spec §43). */
export function getIlliquidPortfolioContext(): PortfolioContext {
  return getMockPortfolioContext({
    portfolioId: 'pf_illiquid',
    events: MOCK_LEDGER_EVENTS.filter((event) => event.tokenId === 'dt_alpha' && event.status === 'CONFIRMED'),
  });
}

/** Portfolio whose only holding has no price source (spec §42, §44). */
export function getUnpricedPortfolioContext(): PortfolioContext {
  return getMockPortfolioContext({
    portfolioId: 'pf_unpriced',
    events: MOCK_LEDGER_EVENTS.filter((event) => event.tokenId === 'dt_ghost'),
  });
}

export const MOCK_PORTFOLIO_ID = 'pf_sentinel_primary';
export { NOW_ISO as MOCK_OBSERVED_AT };
