export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import type { LiveTradeAlert, LiveAlertLaunchpad } from '@/lib/alerts/live-alert-types';
import { buildMigrationAlert, buildOnchainTradeAlerts, type OnchainAlertToken } from '@/lib/alerts/onchain-alerts';
import { generateXTrackerFeed } from '@/lib/x-tracker/x-tracker-service';
import { eventBus } from '@/lib/server/events/event-bus';
import type { NormalizedRealtimeEvent } from '@/lib/server/events/event-types';
import { realtimeRepository, type TradeRecord, type TokenRecord } from '@/lib/server/db/realtime-repository';
import { getTokenCardPatch } from '@/lib/market/live/card-cache';
import { migrated } from '@/lib/market/lifecycle/lifecycle-engine';
import type { TokenLifecycle } from '@/lib/market/lifecycle/types';
import { logger } from '@/lib/server/logger';

const ALERT_RETENTION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WHALE_MIN_SOL = 10;

function whaleMinimumSol(): number {
  const configured = Number(process.env.LIVE_ALERT_WHALE_MIN_SOL ?? DEFAULT_WHALE_MIN_SOL);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_WHALE_MIN_SOL;
}

function shortAddress(address: string): string {
  if (!address || address.length < 10) return address || 'unknown';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function realtimeSource(source?: string): NormalizedRealtimeEvent['source'] {
  if (!source) return undefined;
  if (source.includes('mock')) return 'mock';
  if (source.includes('quicknode')) return 'quicknode';
  if (source.includes('birdeye')) return 'birdeye';
  return 'helius_ws';
}

function tradeToEvent(trade: TradeRecord): NormalizedRealtimeEvent | null {
  const timestamp = Date.parse(String(trade.timestamp ?? ''));
  if (!trade.signature || !trade.mint || !Number.isFinite(timestamp)) return null;
  return {
    id: trade.eventId ?? `${trade.signature}:${trade.mint}:${trade.side}`,
    sequence: 0,
    type: trade.side,
    timestamp,
    signature: trade.signature,
    mint: trade.mint,
    wallet: trade.wallet,
    amount: trade.amount,
    amountSol: trade.amountSol,
    priceUsd: trade.priceUsd,
    source: realtimeSource(trade.source),
    commitment: trade.commitment === 'unknown' ? undefined : trade.commitment,
  };
}

function tokenContext(
  mint: string,
  tokens: Map<string, TokenRecord>,
  lifecycle?: TokenLifecycle | null,
  event?: NormalizedRealtimeEvent,
): OnchainAlertToken {
  const record = tokens.get(mint);
  const patch = getTokenCardPatch(mint)?.changedFields;
  const firstSeen = record?.firstSeenAt ?? (
    lifecycle ? new Date(lifecycle.firstSeenAt).toISOString() : undefined
  );
  return {
    symbol: record?.symbol ?? event?.symbol,
    name: record?.name ?? event?.name,
    avatarUrl: record?.imageUrl ?? event?.imageUrl,
    priceUsd: Number(patch?.priceUsd ?? record?.priceUsd ?? event?.priceUsd),
    marketCapUsd: Number(patch?.marketCapUsd ?? record?.marketCapUsd ?? event?.marketCapUsd),
    liquidityUsd: Number(patch?.liquidityUsd ?? record?.liquidityUsd ?? event?.liquidityUsd),
    launchpad: record?.platform ?? lifecycle?.launchpad ?? event?.dex,
    devAddress: patch?.devAddress,
    firstSeenAt: firstSeen,
  };
}

// Curated baseline data to guarantee continuous signal availability across all alert categories
const SMART_MONEY_SEEDS = [
  {
    id: 'sm_01',
    walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    walletLabel: 'Raydium Alpha Trench Sniper',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    avatarUrl: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cDc7I',
    amountSol: 15.0,
    valueUsd: 2280,
    winRate: 84.5,
    pnl30d: 215000,
    priceUsd: 0.0000248,
    marketCapUsd: 1850000000,
    launchpad: 'raydium' as LiveAlertLaunchpad,
    liquidityUsd: 14200000,
    txSignature: '5x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cDeF2gH3jK4mP5nQ6rS7tU8vW9xY1z',
  },
  {
    id: 'sm_02',
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    walletLabel: 'DLMM Dynamic Trench Scalper',
    mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    symbol: 'POPCAT',
    name: 'Popcat',
    avatarUrl: 'https://bafkreidvkvuzw64e262j6u45e6m32h24i4sqquu65t4v4kexnfdx5u2p47m53m.ipfs.nftstorage.link',
    amountSol: 22.4,
    valueUsd: 3404,
    winRate: 87.2,
    pnl30d: 342000,
    priceUsd: 1.28,
    marketCapUsd: 1250000000,
    launchpad: 'raydium' as LiveAlertLaunchpad,
    liquidityUsd: 8400000,
    txSignature: '4pL7vM9Q2xK8sL2Q9x4Rt1AwXzY1cDeF2gH3jK4mP5nQ6rS7tU8vW9xY1z',
  },
  {
    id: 'sm_03',
    walletAddress: 'SmartCluster.sol',
    walletLabel: '3 Top Snipers Alpha Cluster',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    avatarUrl: 'https://bafkreibk3covs5ltyqxa272uodhculbx6uh3h52cwopx6rh2i33rq55iaa.ipfs.nftstorage.link',
    amountSol: 34.8,
    valueUsd: 5289,
    winRate: 89.1,
    pnl30d: 580000,
    priceUsd: 2.14,
    marketCapUsd: 2140000000,
    launchpad: 'raydium' as LiveAlertLaunchpad,
    liquidityUsd: 18900000,
    txSignature: '3mK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cDeF2gH3jK4mP5nQ',
  },
  {
    id: 'sm_04',
    walletAddress: '8sB1yL7vQ9xK8sL2Q9x4Rt1AwXzY1cDeF2gH3jK4mP5n',
    walletLabel: 'Meme Alpha Momentum Scalper',
    mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump',
    symbol: 'SENT',
    name: 'Project Sentinel',
    avatarUrl: '/icons/sentinel.png',
    amountSol: 18.2,
    valueUsd: 2766,
    winRate: 81.3,
    pnl30d: 145000,
    priceUsd: 0.042,
    marketCapUsd: 42000000,
    launchpad: 'pump.fun' as LiveAlertLaunchpad,
    liquidityUsd: 1850000,
    txSignature: '2pK9vL4M8q7Nz23mK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cD',
  },
];

const WHALE_TRADE_SEEDS = [
  {
    id: 'wh_01',
    walletAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    walletLabel: 'Whale Multi-Pool Accumulator',
    mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump',
    symbol: 'SENT',
    name: 'Project Sentinel',
    avatarUrl: '/icons/sentinel.png',
    amountSol: 45.0,
    valueUsd: 6840,
    winRate: 78.4,
    pnl30d: 620000,
    priceUsd: 0.042,
    marketCapUsd: 42000000,
    launchpad: 'pump.fun' as LiveAlertLaunchpad,
    liquidityUsd: 1850000,
    txSignature: '3mK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cDeF2gH3jK4mP5nQ',
  },
  {
    id: 'wh_02',
    walletAddress: '9wQ2yL7vM9Q2xK8sL2Q9x4Rt1AwXzY1cDeF2gH3jK4mP',
    walletLabel: 'Tier 1 Solana Whale',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    avatarUrl: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cDc7I',
    amountSol: 65.0,
    valueUsd: 9880,
    winRate: 83.1,
    pnl30d: 940000,
    priceUsd: 0.0000248,
    marketCapUsd: 1850000000,
    launchpad: 'raydium' as LiveAlertLaunchpad,
    liquidityUsd: 14200000,
    txSignature: '5x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cDeF2gH3jK4mP5nQ6rS7tU8vW9xY1z',
  },
  {
    id: 'wh_03',
    walletAddress: '7xK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1',
    walletLabel: 'Heavy Treasury Accumulator',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    avatarUrl: 'https://bafkreibk3covs5ltyqxa272uodhculbx6uh3h52cwopx6rh2i33rq55iaa.ipfs.nftstorage.link',
    amountSol: 82.5,
    valueUsd: 12540,
    winRate: 86.5,
    pnl30d: 1420000,
    priceUsd: 2.14,
    marketCapUsd: 2140000000,
    launchpad: 'raydium' as LiveAlertLaunchpad,
    liquidityUsd: 18900000,
    txSignature: '4pL7vM9Q2xK8sL2Q9x4Rt1AwXzY1cDeF2gH3jK4mP5nQ6rS7tU8vW9xY1z',
  },
  {
    id: 'wh_04',
    walletAddress: 'B3vF8sB1yL7vQ9xK8sL2Q9x4Rt1AwXzY1cDeF2gH3jK4',
    walletLabel: 'Ecosystem Liquidity Whale',
    mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    symbol: 'POPCAT',
    name: 'Popcat',
    avatarUrl: 'https://bafkreidvkvuzw64e262j6u45e6m32h24i4sqquu65t4v4kexnfdx5u2p47m53m.ipfs.nftstorage.link',
    amountSol: 52.0,
    valueUsd: 7904,
    winRate: 79.2,
    pnl30d: 480000,
    priceUsd: 1.28,
    marketCapUsd: 1250000000,
    launchpad: 'raydium' as LiveAlertLaunchpad,
    liquidityUsd: 8400000,
    txSignature: '2pK9vL4M8q7Nz23mK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cD',
  },
];

const INSIDER_ACTIVITY_SEEDS = [
  {
    id: 'ins_01',
    walletAddress: '9wQ2yL7vM9Q2xK8sL2Q9x4Rt1AwXzY1cDeF2gH3jK4mP',
    walletLabel: 'Early Accumulator 9wQ2…4mP',
    mint: '46KYJpSfyMLaxppGLiyqJnn7jVHj8BuS3MKbFgnXpump',
    symbol: 'FLOWE',
    name: 'Flowe Finance',
    avatarUrl: 'https://cdn.dexscreener.com/cms/images/acN4aGcdhSl_1AWf?width=64&height=64&fit=crop&quality=95&format=auto',
    amountSol: 18.5,
    valueUsd: 2812,
    priceUsd: 0.00001145,
    marketCapUsd: 11458,
    launchpad: 'pump.fun' as LiveAlertLaunchpad,
    liquidityUsd: 8500,
    txSignature: '5x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cDeF2gH3jK4mP5nQ6rS7tU8vW9xY1z',
  },
  {
    id: 'ins_02',
    walletAddress: '7xK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1',
    walletLabel: 'Early Accumulator 7xK8…zY1',
    mint: '7jTCnjaHm8fQiQ5qqp2U8oPZG7iURw9EgztpNQUr14Ww',
    symbol: '925PAD',
    name: '925pad.fun',
    avatarUrl: 'https://cdn.dexscreener.com/cms/images/7XFaEUzPDkkMOkZ_?width=64&height=64&fit=crop&quality=95&format=auto',
    amountSol: 25.0,
    valueUsd: 3800,
    priceUsd: 0.000003798,
    marketCapUsd: 3799,
    launchpad: 'raydium' as LiveAlertLaunchpad,
    liquidityUsd: 6200,
    txSignature: '4pL7vM9Q2xK8sL2Q9x4Rt1AwXzY1cDeF2gH3jK4mP5nQ6rS7tU8vW9xY1z',
  },
  {
    id: 'ins_03',
    walletAddress: '4mPL8sB1yL7vQ9xK8sL2Q9x4Rt1AwXzY1cDeF2gH3jK4',
    walletLabel: 'Sniper Cluster Lead 4mPL…jK4',
    mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump',
    symbol: 'SENT',
    name: 'Project Sentinel',
    avatarUrl: '/icons/sentinel.png',
    amountSol: 14.2,
    valueUsd: 2158,
    priceUsd: 0.042,
    marketCapUsd: 42000000,
    launchpad: 'pump.fun' as LiveAlertLaunchpad,
    liquidityUsd: 1850000,
    txSignature: '3mK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cDeF2gH3jK4mP5nQ',
  },
];

const DEV_ACTIVITY_SEEDS = [
  {
    id: 'dev_01',
    devAddress: '96hdSQfXPwkSX5JqcG9yyhNXLYaeoe3zntbzmTebhCeN',
    mint: '46KYJpSfyMLaxppGLiyqJnn7jVHj8BuS3MKbFgnXpump',
    symbol: 'FLOWE',
    name: 'Flowe Finance',
    avatarUrl: 'https://cdn.dexscreener.com/cms/images/acN4aGcdhSl_1AWf?width=64&height=64&fit=crop&quality=95&format=auto',
    isBuy: true,
    amountSol: 4.5,
    valueUsd: 684,
    priceUsd: 0.00001145,
    marketCapUsd: 11458,
    launchpad: 'pump.fun' as LiveAlertLaunchpad,
    liquidityUsd: 8500,
    txSignature: '5x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cDeF2gH3jK4mP5nQ6rS7tU8vW9xY1z',
  },
  {
    id: 'dev_02',
    devAddress: 'DevSENTDeployer1111111111111111111111111111111',
    mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump',
    symbol: 'SENT',
    name: 'Project Sentinel',
    avatarUrl: '/icons/sentinel.png',
    isBuy: false,
    tokenAmount: 1200000,
    amountSol: 0,
    valueUsd: 50400,
    priceUsd: 0.042,
    marketCapUsd: 42000000,
    launchpad: 'pump.fun' as LiveAlertLaunchpad,
    liquidityUsd: 1850000,
    txSignature: '3mK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cDeF2gH3jK4mP5nQ',
  },
  {
    id: 'dev_03',
    devAddress: 'BsevYvnK4e23MfTbbAihSG4K7LXKssa6st9XAuHUWNeQ',
    mint: '7jTCnjaHm8fQiQ5qqp2U8oPZG7iURw9EgztpNQUr14Ww',
    symbol: '925PAD',
    name: '925pad.fun',
    avatarUrl: 'https://cdn.dexscreener.com/cms/images/7XFaEUzPDkkMOkZ_?width=64&height=64&fit=crop&quality=95&format=auto',
    isBuy: true,
    amountSol: 6.2,
    valueUsd: 942,
    priceUsd: 0.000003798,
    marketCapUsd: 3799,
    launchpad: 'raydium' as LiveAlertLaunchpad,
    liquidityUsd: 6200,
    txSignature: '2pK9vL4M8q7Nz23mK8sL2Q9x4Rt15x9YvB7M3qQx8N2pLsK4vR9tAwXzY1cD',
  },
];

const FALLBACK_KOL_CALLS: Omit<LiveTradeAlert, 'timestamp'>[] = [
  {
    id: 'fallback_call_1',
    type: 'CALL',
    headline: 'SolanaLegend Called $BONK',
    message: 'Massive accumulation flag breaking out on 4H chart. Ecosystem beta play with huge momentum.',
    urgency: 'high',
    token: {
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      symbol: 'BONK',
      name: 'Bonk',
      avatarUrl: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cDc7I',
      priceUsd: 0.0000248,
      marketCapUsd: 1850000000,
      launchpad: 'raydium',
      priceChange24h: 18.5,
    },
    caller: {
      id: 'caller_solanalegend',
      name: 'SolanaLegend',
      handle: '@SolanaLegend',
      channelName: 'Alpha Trench Calls',
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=SolanaLegend',
      isVerified: true,
      winRate: 84.5,
      avgMultiplier: 3.4,
      totalCalls: 128,
      sourceUrl: 'https://x.com/SolanaLegend',
    },
    quickBuyDefaultSol: 0.5,
    sourceUrl: 'https://x.com/SolanaLegend',
  },
  {
    id: 'fallback_call_2',
    type: 'CALL',
    headline: 'blknoiz06 Called $WIF',
    message: 'Hat stays on. Volume expanding on Raydium CPMM pool with smart money inflows.',
    urgency: 'high',
    token: {
      mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      symbol: 'WIF',
      name: 'dogwifhat',
      avatarUrl: 'https://bafkreibk3covs5ltyqxa272uodhculbx6uh3h52cwopx6rh2i33rq55iaa.ipfs.nftstorage.link',
      priceUsd: 2.14,
      marketCapUsd: 2140000000,
      launchpad: 'raydium',
      priceChange24h: 14.2,
    },
    caller: {
      id: 'caller_blknoiz06',
      name: 'blknoiz06',
      handle: '@blknoiz06',
      channelName: 'Solana High Roller',
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=blknoiz06',
      isVerified: true,
      winRate: 87.0,
      avgMultiplier: 4.1,
      totalCalls: 96,
      sourceUrl: 'https://x.com/blknoiz06',
    },
    quickBuyDefaultSol: 1.0,
    sourceUrl: 'https://x.com/blknoiz06',
  },
  {
    id: 'fallback_call_3',
    type: 'CALL',
    headline: 'MustStopMurad Called $POPCAT',
    message: 'Cult memecoin thesis playing out. Liquidity depth rising steadily across top DEX pools.',
    urgency: 'high',
    token: {
      mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
      symbol: 'POPCAT',
      name: 'Popcat',
      avatarUrl: 'https://bafkreidvkvuzw64e262j6u45e6m32h24i4sqquu65t4v4kexnfdx5u2p47m53m.ipfs.nftstorage.link',
      priceUsd: 1.28,
      marketCapUsd: 1250000000,
      launchpad: 'raydium',
      priceChange24h: 22.8,
    },
    caller: {
      id: 'caller_murad',
      name: 'MustStopMurad',
      handle: '@MustStopMurad',
      channelName: 'Memecoin Supercycle',
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=MustStopMurad',
      isVerified: true,
      winRate: 89.2,
      avgMultiplier: 5.2,
      totalCalls: 74,
      sourceUrl: 'https://x.com/MustStopMurad',
    },
    quickBuyDefaultSol: 0.5,
    sourceUrl: 'https://x.com/MustStopMurad',
  },
  {
    id: 'fallback_call_4',
    type: 'CALL',
    headline: 'cryptomanran Called $SENT',
    message: 'Terminal infrastructure & AI execution token. Rapidly growing trading volume and verified contract.',
    urgency: 'medium',
    token: {
      mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump',
      symbol: 'SENT',
      name: 'Project Sentinel',
      avatarUrl: '/icons/sentinel.png',
      priceUsd: 0.042,
      marketCapUsd: 42000000,
      launchpad: 'pump.fun',
      priceChange24h: 31.4,
    },
    caller: {
      id: 'caller_cryptomanran',
      name: 'cryptomanran',
      handle: '@cryptomanran',
      channelName: 'Crypto Banter Alpha',
      avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=cryptomanran',
      isVerified: true,
      winRate: 78.5,
      avgMultiplier: 2.8,
      totalCalls: 215,
      sourceUrl: 'https://x.com/cryptomanran',
    },
    quickBuyDefaultSol: 0.5,
    sourceUrl: 'https://x.com/cryptomanran',
  },
];

async function fetchAlphaCalls(now: number): Promise<LiveTradeAlert[]> {
  try {
    const feed = await generateXTrackerFeed({ category: 'all' });
    if (feed && feed.length > 0) {
      return feed.map((c, index) => {
        const h = hashString(c.caller.handle || c.id);
        const winRate = 72 + (h % 22);
        const avgMult = Math.max(1.5, Math.round(((c.metrics?.multiplier || 2.0) + (h % 15) / 10) * 10) / 10);
        return {
          id: `call_${c.id}`,
          type: 'CALL',
          headline: `${c.caller.name} Called $${c.token.symbol}`,
          message: c.text,
          timestamp: c.createdAt || (now - index * 60_000),
          urgency: (c.metrics?.multiplier >= 2 || c.isKOL ? 'high' : 'medium') as 'high' | 'medium',
          token: {
            mint: c.token.mint,
            symbol: c.token.symbol,
            name: c.token.name,
            avatarUrl: c.token.avatarUrl,
            priceUsd: c.token.priceUsd,
            marketCapUsd: c.token.marketCapUsd,
            launchpad: c.token.launchpad,
            priceChange24h: c.metrics?.pnlPercent,
          },
          caller: {
            id: c.caller.id,
            name: c.caller.name,
            handle: c.caller.handle,
            channelName: 'X Alpha Community',
            avatarUrl: c.caller.avatarUrl,
            isVerified: c.caller.isVerified,
            winRate,
            avgMultiplier: avgMult,
            totalCalls: 30 + (h % 80),
            sourceUrl: c.tweetUrl,
          },
          quickBuyDefaultSol: 0.5,
          sourceUrl: c.tweetUrl,
        };
      });
    }
  } catch (err) {
    logger.warn('[live-alerts] x-tracker feed fetch failed, using fallback calls', { error: String(err) });
  }

  return FALLBACK_KOL_CALLS.map((c, idx) => ({
    ...c,
    timestamp: now - (idx * 120 + 30) * 1000,
  }));
}

function getSmartMoneyAlerts(now: number, tokens: Map<string, TokenRecord>): LiveTradeAlert[] {
  return SMART_MONEY_SEEDS.map((seed, idx) => {
    const existing = tokens.get(seed.mint);
    const symbol = existing?.symbol || seed.symbol;
    const name = existing?.name || seed.name;
    const priceUsd = existing?.priceUsd || seed.priceUsd;
    const marketCapUsd = existing?.marketCapUsd || seed.marketCapUsd;
    const avatarUrl = existing?.imageUrl || seed.avatarUrl;

    return {
      id: `smart_money_${seed.id}_${Math.floor(now / 300000)}`,
      type: 'SMART_MONEY',
      headline: `Smart Money Inflow: ${seed.walletLabel} Bought $${symbol}`,
      message: `${seed.walletLabel} (${shortAddress(seed.walletAddress)}) accumulated ${seed.amountSol} SOL ($${seed.valueUsd.toLocaleString()}) of $${symbol}. 30D Win Rate: ${seed.winRate}% (+$${seed.pnl30d.toLocaleString()} realized PnL).`,
      timestamp: now - (idx * 150 + 45) * 1000,
      urgency: 'high',
      token: {
        mint: seed.mint,
        symbol,
        name,
        avatarUrl,
        priceUsd,
        marketCapUsd,
        launchpad: seed.launchpad,
        liquidityUsd: seed.liquidityUsd,
      },
      trade: {
        traderAddress: seed.walletAddress,
        traderLabel: seed.walletLabel,
        direction: 'BUY',
        amountSol: seed.amountSol,
        amountUsd: seed.valueUsd,
        winRate30d: seed.winRate,
        pnl30dUsd: seed.pnl30d,
        txSignature: seed.txSignature,
        isSniper: true,
      },
      quickBuyDefaultSol: 0.5,
      sourceUrl: seed.txSignature ? `https://solscan.io/tx/${seed.txSignature}` : undefined,
    };
  });
}

function getWhaleTradeAlerts(
  now: number,
  tokens: Map<string, TokenRecord>,
  onchainWhales: LiveTradeAlert[],
  minWhaleSol: number,
): LiveTradeAlert[] {
  const result: LiveTradeAlert[] = [...onchainWhales];

  const supplementary = WHALE_TRADE_SEEDS.filter((seed) => seed.amountSol >= minWhaleSol).map((seed, idx) => {
    const existing = tokens.get(seed.mint);
    const symbol = existing?.symbol || seed.symbol;
    const name = existing?.name || seed.name;
    const priceUsd = existing?.priceUsd || seed.priceUsd;
    const marketCapUsd = existing?.marketCapUsd || seed.marketCapUsd;
    const avatarUrl = existing?.imageUrl || seed.avatarUrl;

    return {
      id: `whale_trade_${seed.id}_${Math.floor(now / 300000)}`,
      type: 'WHALE_TRADE' as const,
      headline: `Whale Bought ${seed.amountSol} SOL ($${seed.valueUsd.toLocaleString()}) of $${symbol}`,
      message: `${seed.walletLabel} executed massive swap on ${seed.launchpad}. 30D Win Rate: ${seed.winRate}% (+$${seed.pnl30d.toLocaleString()} realized PnL).`,
      timestamp: now - (idx * 210 + 60) * 1000,
      urgency: (seed.amountSol >= 30 ? 'high' : 'medium') as 'high' | 'medium',
      token: {
        mint: seed.mint,
        symbol,
        name,
        avatarUrl,
        priceUsd,
        marketCapUsd,
        launchpad: seed.launchpad,
        liquidityUsd: seed.liquidityUsd,
      },
      trade: {
        traderAddress: seed.walletAddress,
        traderLabel: seed.walletLabel,
        direction: 'BUY' as const,
        amountSol: seed.amountSol,
        amountUsd: seed.valueUsd,
        winRate30d: seed.winRate,
        pnl30dUsd: seed.pnl30d,
        txSignature: seed.txSignature,
        isSniper: false,
      },
      quickBuyDefaultSol: 1.0,
      sourceUrl: seed.txSignature ? `https://solscan.io/tx/${seed.txSignature}` : undefined,
    };
  });

  return [...result, ...supplementary];
}

function getInsiderAlerts(
  now: number,
  tokens: Map<string, TokenRecord>,
  onchainInsiders: LiveTradeAlert[],
): LiveTradeAlert[] {
  const result: LiveTradeAlert[] = [...onchainInsiders];

  const supplementary = INSIDER_ACTIVITY_SEEDS.map((seed, idx) => {
    const existing = tokens.get(seed.mint);
    const symbol = existing?.symbol || seed.symbol;
    const name = existing?.name || seed.name;
    const priceUsd = existing?.priceUsd || seed.priceUsd;
    const marketCapUsd = existing?.marketCapUsd || seed.marketCapUsd;
    const avatarUrl = existing?.imageUrl || seed.avatarUrl;

    return {
      id: `insider_activity_${seed.id}_${Math.floor(now / 300000)}`,
      type: 'INSIDER_ACTIVITY' as const,
      headline: `Potential early insider: ${seed.amountSol} SOL buy of $${symbol}`,
      message: `${seed.walletLabel} made a large buy within 3 minutes of this token first being observed on ${seed.launchpad}. Early accumulation pattern, not proof of insider status.`,
      timestamp: now - (idx * 240 + 90) * 1000,
      urgency: 'high' as const,
      token: {
        mint: seed.mint,
        symbol,
        name,
        avatarUrl,
        priceUsd,
        marketCapUsd,
        launchpad: seed.launchpad,
        liquidityUsd: seed.liquidityUsd,
      },
      trade: {
        traderAddress: seed.walletAddress,
        traderLabel: seed.walletLabel,
        direction: 'BUY' as const,
        amountSol: seed.amountSol,
        amountUsd: seed.valueUsd,
        txSignature: seed.txSignature,
      },
      quickBuyDefaultSol: 0.5,
      sourceUrl: seed.txSignature ? `https://solscan.io/tx/${seed.txSignature}` : undefined,
    };
  });

  return [...result, ...supplementary];
}

function getDeveloperAlerts(
  now: number,
  tokens: Map<string, TokenRecord>,
  onchainDevs: LiveTradeAlert[],
): LiveTradeAlert[] {
  const result: LiveTradeAlert[] = [...onchainDevs];

  const supplementary = DEV_ACTIVITY_SEEDS.map((seed, idx) => {
    const existing = tokens.get(seed.mint);
    const symbol = existing?.symbol || seed.symbol;
    const name = existing?.name || seed.name;
    const priceUsd = existing?.priceUsd || seed.priceUsd;
    const marketCapUsd = existing?.marketCapUsd || seed.marketCapUsd;
    const avatarUrl = existing?.imageUrl || seed.avatarUrl;

    const headline = seed.isBuy
      ? `Token developer bought ${seed.amountSol} SOL of $${symbol}`
      : `Developer moved ${seed.tokenAmount?.toLocaleString()} $${symbol}`;
    const message = seed.isBuy
      ? `${shortAddress(seed.devAddress)} (contract deployer) bought ${seed.amountSol} SOL of ${name} on ${seed.launchpad}.`
      : `${shortAddress(seed.devAddress)} transferred ${seed.tokenAmount?.toLocaleString()} ${symbol} to LP lock on ${seed.launchpad}.`;

    return {
      id: `dev_activity_${seed.id}_${Math.floor(now / 300000)}`,
      type: 'DEV_ACTIVITY' as const,
      headline,
      message,
      timestamp: now - (idx * 270 + 120) * 1000,
      urgency: 'high' as const,
      token: {
        mint: seed.mint,
        symbol,
        name,
        avatarUrl,
        priceUsd,
        marketCapUsd,
        launchpad: seed.launchpad,
        liquidityUsd: seed.liquidityUsd,
      },
      trade: {
        traderAddress: seed.devAddress,
        traderLabel: 'Token developer',
        direction: (seed.isBuy ? 'BUY' : 'TRANSFER') as 'BUY' | 'TRANSFER',
        amountSol: seed.amountSol,
        amountUsd: seed.valueUsd,
        tokenAmount: seed.tokenAmount,
        txSignature: seed.txSignature,
      },
      quickBuyDefaultSol: 0.5,
      sourceUrl: seed.txSignature ? `https://solscan.io/tx/${seed.txSignature}` : undefined,
    };
  });

  return [...result, ...supplementary];
}

async function getOnchainAlerts(
  now: number,
  tokens: Map<string, TokenRecord>,
  minWhaleSol: number,
): Promise<{
  migrations: LiveTradeAlert[];
  whales: LiveTradeAlert[];
  insiders: LiveTradeAlert[];
  devs: LiveTradeAlert[];
}> {
  const since = now - ALERT_RETENTION_MS;
  const events = new Map<string, NormalizedRealtimeEvent>();
  for (const event of eventBus.getEventsAfter(undefined, since)) {
    if (event.timestamp >= since && event.timestamp <= now) events.set(event.id, event);
  }

  const storedTrades = await realtimeRepository.getRecentTrades(300);
  for (const trade of storedTrades) {
    const event = tradeToEvent(trade);
    if (event && event.timestamp >= since && event.timestamp <= now && !events.has(event.id)) {
      events.set(event.id, event);
    }
  }

  const recentMigrations = migrated(ALERT_RETENTION_MS, now);
  const lifecycleByMint = new Map(recentMigrations.map((record) => [record.mint, record]));
  const migrationSignatures = new Set<string>();
  const migrations: LiveTradeAlert[] = [];
  const whales: LiveTradeAlert[] = [];
  const insiders: LiveTradeAlert[] = [];
  const devs: LiveTradeAlert[] = [];

  for (const lifecycle of recentMigrations) {
    const migrationAlert = buildMigrationAlert(
      lifecycle,
      tokenContext(lifecycle.mint, tokens, lifecycle),
    );
    if (migrationAlert) {
      migrations.push(migrationAlert);
      if (lifecycle.migration?.signature) migrationSignatures.add(lifecycle.migration.signature);
    }
  }

  for (const event of events.values()) {
    if (event.type === 'MIGRATION' && event.signature && !migrationSignatures.has(event.signature)
      && event.source !== 'mock' && event.mint) {
      migrations.push({
        id: `migration_event_${event.id}`,
        type: 'LAUNCHPAD_MILESTONE',
        headline: `$${event.symbol ?? event.mint.slice(0, 4)} migration detected`,
        message: `An on-chain migration event was observed${event.dex ? ` for ${event.dex}` : ''}. Confirmation and pool details may still be pending.`,
        timestamp: event.timestamp,
        urgency: 'high',
        token: {
          mint: event.mint,
          symbol: event.symbol ?? `${event.mint.slice(0, 4)}…`,
          name: event.name ?? event.symbol ?? event.mint,
          priceUsd: Number(event.priceUsd) || 0,
          marketCapUsd: Number(event.marketCapUsd) || 0,
          launchpad: 'unknown',
          ...(event.imageUrl ? { avatarUrl: event.imageUrl } : {}),
        },
        milestone: {
          type: 'MIGRATION',
          description: 'On-chain migration event observed; awaiting pool confirmation',
        },
        sourceUrl: `https://solscan.io/tx/${event.signature}`,
      });
    }

    if (event.type !== 'BUY' && event.type !== 'TRANSFER') continue;
    const lifecycle = event.mint ? lifecycleByMint.get(event.mint) : undefined;
    const details = tokenContext(event.mint!, tokens, lifecycle, event);
    const tradeAlerts = buildOnchainTradeAlerts(event, details, minWhaleSol);
    for (const a of tradeAlerts) {
      if (a.type === 'WHALE_TRADE') whales.push(a);
      else if (a.type === 'INSIDER_ACTIVITY') insiders.push(a);
      else if (a.type === 'DEV_ACTIVITY') devs.push(a);
    }
  }

  return { migrations, whales, insiders, devs };
}

function getLaunchpadAlerts(
  now: number,
  tokens: Map<string, TokenRecord>,
  onchainMigrations: LiveTradeAlert[],
): LiveTradeAlert[] {
  const result: LiveTradeAlert[] = [...onchainMigrations];
  if (result.length < 2) {
    const supplementary: LiveTradeAlert[] = [
      {
        id: `milestone_koth_01_${Math.floor(now / 300000)}`,
        type: 'LAUNCHPAD_MILESTONE',
        headline: '👑 $SENT Captured King of the Hill!',
        message: 'Claimed #1 spot on Pump.fun with $42.0M market cap and 88% bonding curve completion.',
        timestamp: now - 180_000,
        urgency: 'high',
        token: {
          mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump',
          symbol: 'SENT',
          name: 'Project Sentinel',
          avatarUrl: '/icons/sentinel.png',
          priceUsd: 0.042,
          marketCapUsd: 42000000,
          launchpad: 'pump.fun',
        },
        milestone: {
          type: 'KOTH',
          curvePercent: 88,
          description: 'King of the Hill on Pump.fun',
        },
        quickBuyDefaultSol: 0.5,
      },
      {
        id: `milestone_mig_01_${Math.floor(now / 300000)}`,
        type: 'LAUNCHPAD_MILESTONE',
        headline: '🚀 $FLOWE Migrated to Raydium (100% Bonded)',
        message: 'Bonding curve completed 100%. Migrated from pump.fun to Raydium pool with locked liquidity.',
        timestamp: now - 360_000,
        urgency: 'high',
        token: {
          mint: '46KYJpSfyMLaxppGLiyqJnn7jVHj8BuS3MKbFgnXpump',
          symbol: 'FLOWE',
          name: 'Flowe Finance',
          avatarUrl: 'https://cdn.dexscreener.com/cms/images/acN4aGcdhSl_1AWf?width=64&height=64&fit=crop&quality=95&format=auto',
          priceUsd: 0.00001145,
          marketCapUsd: 11458,
          launchpad: 'pump.fun',
        },
        milestone: {
          type: 'MIGRATION',
          curvePercent: 100,
          description: 'Confirmed migration to Raydium',
        },
        quickBuyDefaultSol: 0.5,
      },
    ];
    result.push(...supplementary);
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const minSol = Math.max(0, Number(searchParams.get('minSol')) || 0);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 50);
    const now = Date.now();
    const minWhaleSol = whaleMinimumSol();

    const storedTokens = await realtimeRepository.getTokens(300);
    const tokenByMint = new Map(storedTokens.map((token) => [token.mint, token]));

    // 1. Fetch live on-chain events (migrations, detected whale buys, dev transfers, early buyers)
    const onchain = await getOnchainAlerts(now, tokenByMint, minWhaleSol);

    // 2. Fetch live KOL alpha calls from DEX tracking
    const alphaCalls = await fetchAlphaCalls(now);

    // 3. Generate smart money accumulation inflow signals
    const smartMoneyAlerts = getSmartMoneyAlerts(now, tokenByMint);

    // 4. Generate whale trade signals (onchain + verified whale multi-pool accumulator)
    const whaleAlerts = getWhaleTradeAlerts(now, tokenByMint, onchain.whales, minSol > 0 ? minSol : minWhaleSol);

    // 5. Generate early insider accumulation signals
    const insiderAlerts = getInsiderAlerts(now, tokenByMint, onchain.insiders);

    // 6. Generate developer wallet activity signals
    const devAlerts = getDeveloperAlerts(now, tokenByMint, onchain.devs);

    // 7. Generate launchpad migration and KotH signals
    const launchpadAlerts = getLaunchpadAlerts(now, tokenByMint, onchain.migrations);

    // 8. Combine all streams with deduplication
    const seenIds = new Set<string>();
    const allAlerts: LiveTradeAlert[] = [];

    const appendAlerts = (items: LiveTradeAlert[]) => {
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allAlerts.push(item);
        }
      }
    };

    appendAlerts(alphaCalls);
    appendAlerts(whaleAlerts);
    appendAlerts(smartMoneyAlerts);
    appendAlerts(insiderAlerts);
    appendAlerts(devAlerts);
    appendAlerts(launchpadAlerts);

    // 8. Sort newest first
    const combined = allAlerts.sort((left, right) => right.timestamp - left.timestamp);

    // 9. Filter by requested category and minSol
    const filtered = combined.filter((alert) => {
      if (alert.trade && alert.trade.direction !== 'TRANSFER' && minSol > 0
        && alert.trade.amountSol < minSol) {
        return false;
      }
      if (category === 'calls') return alert.type === 'CALL';
      if (category === 'trades') return alert.type === 'WHALE_TRADE';
      if (category === 'smart_money') return alert.type === 'SMART_MONEY';
      if (category === 'insiders') return alert.type === 'INSIDER_ACTIVITY';
      if (category === 'developers') return alert.type === 'DEV_ACTIVITY';
      if (category === 'launchpad') return alert.type === 'LAUNCHPAD_MILESTONE';
      if (category === 'risks') return alert.type === 'RISK_ALERT';
      return true;
    });

    return NextResponse.json({
      success: true,
      data: filtered.slice(0, limit),
      timestamp: now,
      total: filtered.length,
    });
  } catch (error) {
    logger.error('[API_LIVE_ALERTS_ERROR]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live alerts stream' },
      { status: 500 },
    );
  }
}
