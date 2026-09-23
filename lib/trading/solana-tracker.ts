import 'server-only';

import type { HolderProfile } from '@/lib/market/enrichment/holder-profile';
import { measuredNumber } from './sidebar-model';
import { readProvider } from './provider-read';

const BASE = 'https://data.solanatracker.io';

export function trackerConfigured(): boolean {
  return Boolean(process.env.SOLANA_TRACKER_API_KEY?.trim());
}

function percentage(value: unknown): number | null {
  const number = measuredNumber(value);
  return number !== null && number >= 0 && number <= 100 ? number : null;
}

function count(value: unknown): number | null {
  const number = measuredNumber(value);
  return number !== null && Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/** Solana Tracker's token risk response; omitted classifications stay unknown. */
export function parseTrackerOwnership(mint: string, body: any): HolderProfile | null {
  if (body?.token?.mint !== mint || !body.risk || typeof body.risk !== 'object') return null;
  const risk = body.risk;
  const profile: HolderProfile = {
    mint,
    top10Pct: percentage(risk.top10),
    totalHolders: count(body.holders),
    snipersPct: percentage(risk.snipers?.totalPercentage),
    insidersPct: percentage(risk.insiders?.totalPercentage),
    bundlersPct: percentage(risk.bundlers?.totalPercentage),
    devPct: percentage(risk.dev?.percentage),
    proTraders: null,
    kols: null,
    fetchedAt: Date.now(),
    source: 'solana-tracker-token-risk',
  };
  return [profile.top10Pct, profile.totalHolders, profile.snipersPct, profile.insidersPct,
    profile.bundlersPct, profile.devPct].some(value => value !== null) ? profile : null;
}

export async function fetchTrackerOwnership(mint: string): Promise<HolderProfile | null> {
  const key = process.env.SOLANA_TRACKER_API_KEY?.trim();
  if (!key) return null;
  try {
    const body = await readProvider('Solana Tracker ownership', `${BASE}/tokens/${encodeURIComponent(mint)}`,
      { headers: { 'x-api-key': key } });
    return parseTrackerOwnership(mint, body);
  } catch {
    return null;
  }
}

/** PnL V2 returns a single wallet-token position, in USD. Never infer absent amounts as zero. */
export function parseTrackerWalletPosition(body: any, wallet: string, mint: string) {
  if (body?.wallet !== wallet || body?.token !== mint) return null;
  const position = {
    boughtUsd: measuredNumber(body.volume?.buyUsd ?? body.invested),
    soldUsd: measuredNumber(body.volume?.sellUsd ?? body.proceeds),
    holdingUsd: measuredNumber(body.current?.value),
    pnlUsd: measuredNumber(body.pnl?.total),
  };
  return Object.values(position).some(value => value !== null) ? position : null;
}

export async function fetchTrackerWalletPosition(wallet: string, mint: string) {
  const key = process.env.SOLANA_TRACKER_API_KEY?.trim();
  if (!key) return null;
  const body = await readProvider('Solana Tracker wallet PnL',
    `${BASE}/v2/pnl/wallets/${encodeURIComponent(wallet)}/tokens/${encodeURIComponent(mint)}?pnlMode=strict`,
    { headers: { 'x-api-key': key } });
  return parseTrackerWalletPosition(body, wallet, mint);
}
