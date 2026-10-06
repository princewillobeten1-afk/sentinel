import type { LiveAlertLaunchpad, LiveTradeAlert } from './live-alert-types';
import type { NormalizedRealtimeEvent } from '@/lib/server/events/event-types';
import type { TokenLifecycle } from '@/lib/market/lifecycle/types';

export interface OnchainAlertToken {
  symbol?: string;
  name?: string;
  avatarUrl?: string;
  priceUsd?: number;
  marketCapUsd?: number;
  liquidityUsd?: number;
  launchpad?: string;
  devAddress?: string;
  firstSeenAt?: string;
}

const LAUNCHPADS = new Set<LiveAlertLaunchpad>(['pump.fun', 'raydium', 'moonshot', 'meteora', 'unknown']);

function toLaunchpad(value?: string): LiveAlertLaunchpad {
  return value && LAUNCHPADS.has(value as LiveAlertLaunchpad)
    ? value as LiveAlertLaunchpad
    : 'unknown';
}

function alertToken(mint: string, details: OnchainAlertToken) {
  const symbol = details.symbol?.trim() || `${mint.slice(0, 4)}…`;
  return {
    mint,
    symbol,
    name: details.name?.trim() || symbol,
    ...(details.avatarUrl ? { avatarUrl: details.avatarUrl } : {}),
    priceUsd: finitePositive(details.priceUsd),
    marketCapUsd: finitePositive(details.marketCapUsd),
    launchpad: toLaunchpad(details.launchpad),
    ...(details.liquidityUsd !== undefined ? { liquidityUsd: finitePositive(details.liquidityUsd) } : {}),
  };
}

function finitePositive(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function tradeInfo(
  event: NormalizedRealtimeEvent,
  direction: 'BUY' | 'TRANSFER',
  label: string,
  tokenAmount?: number,
) {
  const wallet = direction === 'TRANSFER'
    ? String(event.fromWallet ?? event.extra?.fromWallet ?? event.wallet ?? '')
    : event.wallet ?? '';
  return {
    traderAddress: wallet,
    traderLabel: label,
    direction,
    amountSol: finitePositive(event.amountSol),
    amountUsd: finitePositive(event.amountUsd),
    ...(tokenAmount !== undefined && Number.isFinite(tokenAmount) ? { tokenAmount } : {}),
    txSignature: event.signature,
  };
}

/**
 * Turns observed on-chain events into user-facing alerts. It deliberately
 * ignores mock events and only calls a trade a whale buy when SOL notional is
 * present and meets the configured threshold.
 */
export function buildOnchainTradeAlerts(
  event: NormalizedRealtimeEvent,
  details: OnchainAlertToken,
  whaleMinSol: number,
): LiveTradeAlert[] {
  if (!event.mint || !Number.isFinite(event.timestamp) || event.source === 'mock') return [];

  const token = alertToken(event.mint, details);
  const timestamp = event.timestamp;
  const alerts: LiveTradeAlert[] = [];
  const devAddress = details.devAddress?.trim();

  if (event.type === 'TRANSFER') {
    const fromWallet = String(event.fromWallet ?? event.extra?.fromWallet ?? event.wallet ?? '');
    const toWallet = String(event.toWallet ?? event.extra?.toWallet ?? '');
    const tokenAmount = finitePositive(
      event.tokenAmount ?? (typeof event.extra?.tokenAmount === 'number' ? event.extra.tokenAmount : event.amount),
    );
    const isDevMovement = Boolean(devAddress && (
      fromWallet.toLowerCase() === devAddress.toLowerCase()
      || toWallet.toLowerCase() === devAddress.toLowerCase()
    ));
    if (!isDevMovement || !fromWallet || !toWallet || tokenAmount <= 0) return [];

    const devIsSender = fromWallet.toLowerCase() === devAddress?.toLowerCase();
    const headline = devIsSender
      ? `Developer moved ${tokenAmount.toLocaleString()} $${token.symbol}`
      : `Developer received ${tokenAmount.toLocaleString()} $${token.symbol}`;
    alerts.push({
      id: `dev_transfer_${event.id}`,
      type: 'DEV_ACTIVITY',
      headline,
      message: `${shortAddress(devAddress!)} ${devIsSender ? 'transferred' : 'received'} ${tokenAmount.toLocaleString()} ${token.symbol} ${devIsSender ? `to ${shortAddress(toWallet)}` : `from ${shortAddress(fromWallet)}`}.`,
      timestamp,
      urgency: 'high',
      token,
      trade: tradeInfo(event, 'TRANSFER', 'Token developer', tokenAmount),
      sourceUrl: event.signature ? `https://solscan.io/tx/${event.signature}` : undefined,
    });
    return alerts;
  }

  if (event.type !== 'BUY' || !event.wallet) return [];
  const amountSol = finitePositive(event.amountSol);
  if (amountSol <= 0) return [];

  const isDeveloper = Boolean(devAddress && event.wallet.toLowerCase() === devAddress.toLowerCase());
  if (isDeveloper && amountSol >= 1) {
    alerts.push({
      id: `dev_buy_${event.id}`,
      type: 'DEV_ACTIVITY',
      headline: `Token developer bought ${amountSol.toFixed(2)} SOL of $${token.symbol}`,
      message: `${shortAddress(event.wallet)} bought ${amountSol.toFixed(2)} SOL of ${token.name}.`,
      timestamp,
      urgency: amountSol >= whaleMinSol ? 'high' : 'medium',
      token,
      trade: tradeInfo(event, 'BUY', 'Token developer'),
      sourceUrl: event.signature ? `https://solscan.io/tx/${event.signature}` : undefined,
    });
  } else if (amountSol >= whaleMinSol) {
    const walletLabel = `Whale ${shortAddress(event.wallet)}`;
    alerts.push({
      id: `whale_buy_${event.id}`,
      type: 'WHALE_TRADE',
      headline: `Whale bought ${amountSol.toFixed(2)} SOL of $${token.symbol}`,
      message: `${walletLabel} bought ${amountSol.toFixed(2)} SOL of ${token.name}.`,
      timestamp,
      urgency: amountSol >= whaleMinSol * 2 ? 'high' : 'medium',
      token,
      trade: tradeInfo(event, 'BUY', walletLabel),
      sourceUrl: event.signature ? `https://solscan.io/tx/${event.signature}` : undefined,
    });
  }

  const firstSeenAt = details.firstSeenAt ? Date.parse(details.firstSeenAt) : NaN;
  if (amountSol >= whaleMinSol && Number.isFinite(firstSeenAt)
    && timestamp >= firstSeenAt && timestamp - firstSeenAt <= 5 * 60_000) {
    const walletLabel = `Early buyer ${shortAddress(event.wallet)}`;
    alerts.push({
      id: `insider_buy_${event.id}`,
      type: 'INSIDER_ACTIVITY',
      headline: `Potential early insider: ${amountSol.toFixed(2)} SOL buy of $${token.symbol}`,
      message: `${walletLabel} made a large buy within five minutes of this token first being observed. This is an early-entry signal, not proof of insider status.`,
      timestamp,
      urgency: 'high',
      token,
      trade: tradeInfo(event, 'BUY', walletLabel),
      sourceUrl: event.signature ? `https://solscan.io/tx/${event.signature}` : undefined,
    });
  }

  return alerts;
}

export function buildMigrationAlert(
  lifecycle: TokenLifecycle,
  details: OnchainAlertToken,
): LiveTradeAlert | null {
  const migration = lifecycle.migration;
  if (lifecycle.state !== 'MIGRATED' || !migration?.signature || !migration.poolAddress || !migration.dex) {
    return null;
  }

  const token = alertToken(lifecycle.mint, {
    ...details,
    launchpad: migration.originLaunchpad ?? lifecycle.launchpad,
  });
  return {
    id: `migration_${migration.signature}`,
    type: 'LAUNCHPAD_MILESTONE',
    headline: `$${token.symbol} migrated to ${migration.dex}`,
    message: `Confirmed migration from ${migration.originLaunchpad ?? lifecycle.launchpad} to ${migration.dex}. Pool: ${migration.poolAddress}.`,
    timestamp: migration.migratedAt,
    urgency: 'high',
    token,
    milestone: {
      type: 'MIGRATION',
      curvePercent: 100,
      description: `Confirmed migration to ${migration.dex}`,
    },
    sourceUrl: `https://solscan.io/tx/${migration.signature}`,
  };
}
