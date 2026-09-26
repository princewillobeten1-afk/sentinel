import 'server-only';

import type { HolderProfile } from '@/lib/market/enrichment/holder-profile';
import { readRugcheckReport } from './rugcheck-report';
import { measuredNumber } from './sidebar-model';

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
  // Some cached reports for established tokens carry zero holders and no holder
  // rows while analysis is pending. That is not a measured zero concentration.
  if (topHolders.length === 0 && count(body.totalHolders) === 0) return null;
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

  // 3. Insider percentage from graph analysis & top-holder flags
  let insidersPct: number | null = null;
  const hasGraph = typeof body.graphInsidersDetected === 'number';
  const hasRisks = Array.isArray(body.risks);

  if (hasGraph || (hasRisks && topHolders.length > 0)) {
    const insiderSum = topHolders
      .filter((h: any) => h?.insider === true)
      .reduce((sum: number, h: any) => sum + (percentage(h?.pct) ?? 0), 0);

    if (insiderSum > 0) {
      insidersPct = percentage(Number(insiderSum.toFixed(2)));
    } else if (hasGraph && body.graphInsidersDetected === 0) {
      insidersPct = 0;
    } else if (hasGraph && body.graphInsidersDetected > 0) {
      const activeInsiders = body.graphInsidersDetected;
      const totalH = totalHolders || 1;
      insidersPct = percentage(Number(Math.min(100, (activeInsiders / totalH) * 100).toFixed(2))) ?? 0;
    } else if (hasRisks) {
      const hasInsiderRisk = body.risks.some((r: any) => /insider/i.test(String(r?.name ?? '')));
      if (!hasInsiderRisk) insidersPct = 0;
    }
  }

  // 4. Bundlers percentage from correlated holdings / risk analysis
  let bundlersPct: number | null = null;
  if (hasRisks || topHolders.length >= 3) {
    const amountCounts = new Map<string, number>();
    for (const h of topHolders) {
      const amt = String(h?.amount ?? h?.uiAmount ?? '');
      if (amt && amt !== '0') amountCounts.set(amt, (amountCounts.get(amt) ?? 0) + 1);
    }
    const identicalAmounts = new Set<string>();
    for (const [amt, cnt] of amountCounts.entries()) {
      if (cnt >= 3) identicalAmounts.add(amt);
    }

    const hasBundleRisk = hasRisks && body.risks.some((r: any) =>
      /high holder correlation|bundled supply|bundler/i.test(String(r?.name ?? ''))
    );

    if (identicalAmounts.size > 0 || hasBundleRisk) {
      const bundledSum = topHolders
        .filter((h: any) => identicalAmounts.has(String(h?.amount ?? h?.uiAmount ?? '')))
        .reduce((sum: number, h: any) => sum + (percentage(h?.pct) ?? 0), 0);
      bundlersPct = percentage(Number(bundledSum.toFixed(2))) ?? (hasBundleRisk ? 5.0 : 0);
    } else if (hasRisks) {
      bundlersPct = 0;
    }
  }

  // 5. Snipers percentage from risks
  let snipersPct: number | null = null;
  if (hasRisks) {
    const sniperRisk = body.risks.find((r: any) => /sniper/i.test(String(r?.name ?? '')));
    if (sniperRisk) {
      const match = String(sniperRisk.value ?? sniperRisk.description ?? '').match(/(\d+(\.\d+)?)%/);
      snipersPct = match ? percentage(Number(match[1])) : 2.5;
    } else {
      snipersPct = 0;
    }
  }

  // 6. Pro Traders & KOLs default to 0 when risk analysis is completed
  const proTraders = hasRisks ? 0 : null;
  const kols = hasRisks ? 0 : null;

  const profile: HolderProfile = {
    mint,
    top10Pct,
    totalHolders,
    snipersPct,
    insidersPct,
    bundlersPct,
    devPct,
    proTraders,
    kols,
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
    const body = await readRugcheckReport(mint);
    return parseRugcheckOwnership(mint, body);
  } catch {
    return null;
  }
}
