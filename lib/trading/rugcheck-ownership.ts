import 'server-only';

import type { HolderProfile } from '@/lib/market/enrichment/holder-profile';
import { readProvider } from './provider-read';
import { measuredNumber } from './sidebar-model';

const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1/tokens';

function percentage(value: unknown): number | null {
  const number = measuredNumber(value);
  return number !== null && number >= 0 && number <= 100 ? number : null;
}

function count(value: unknown): number | null {
  const number = measuredNumber(value);
  return number !== null && Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function parseRugcheckOwnership(mint: string, body: any): HolderProfile | null {
  if (!body || typeof body !== 'object' || (body.mint && body.mint !== mint)) return null;

  const topHolders = Array.isArray(body.topHolders) ? body.topHolders : [];
  if (topHolders.length === 0 && count(body.totalHolders) === null) return null;

  // Top holders are token accounts. An invalid row invalidates the sum; it is
  // not a measured zero and must not make a risky token look less concentrated.
  const percentages: Array<number | null> = topHolders.slice(0, 10).map((holder: any) => percentage(holder?.pct));
  const top10Sum = percentages.every((pct: number | null) => pct !== null)
    ? percentages.reduce<number>((sum: number, pct: number | null) => sum + pct!, 0) : null;
  const top10Pct = topHolders.length > 0 && top10Sum !== null ? percentage(Number(top10Sum.toFixed(2))) : null;

  // 2. Creator holding percentage
  const creator = typeof body.creator === 'string' ? body.creator.trim() : null;
  let devPct: number | null = null;
  if (creator && topHolders.length > 0) {
    const creatorAccount = topHolders.find(
      (h: any) => h?.owner === creator || h?.address === creator,
    );
    if (creatorAccount) {
      devPct = percentage(creatorAccount.pct);
    }
  }

  // The top-holder list is capped, so its insider flags cannot establish the
  // percentage held by all insiders. Leave that classification unavailable.
  const totalHolders = count(body.totalHolders);

  const profile: HolderProfile = {
    mint,
    top10Pct,
    totalHolders,
    snipersPct: null,
    insidersPct: null,
    bundlersPct: null,
    devPct,
    proTraders: null,
    kols: null,
    fetchedAt: Date.now(),
    source: 'rugcheck-report',
  };

  return profile.top10Pct !== null || profile.totalHolders !== null || profile.devPct !== null
    ? profile
    : null;
}

export async function fetchRugcheckOwnership(mint: string): Promise<HolderProfile | null> {
  if (!mint) return null;
  try {
    const body = await readProvider(
      'Rugcheck ownership',
      `${RUGCHECK_BASE}/${encodeURIComponent(mint)}/report`,
    );
    return parseRugcheckOwnership(mint, body);
  } catch {
    return null;
  }
}
