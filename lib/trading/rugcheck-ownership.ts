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

function reportedRiskPercentage(risks: unknown[], pattern: RegExp): number | null {
  const risk = risks.find((entry): entry is Record<string, unknown> => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return pattern.test('name' in entry ? String(entry.name) : '');
  });
  if (!risk) return null;
  const text = [risk.value, risk.description].filter(value => typeof value === 'string').join(' ');
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? percentage(Number(match[1])) : null;
}

export function parseRugcheckOwnership(mint: string, body: any): HolderProfile | null {
  if (!body || typeof body !== 'object' || (body.mint && body.mint !== mint)) return null;

  const topHolders = Array.isArray(body.topHolders) ? body.topHolders : [];
  // Some cached reports for established tokens carry zero holders and no holder
  // rows while analysis is pending. That is not a measured zero concentration.
  if (topHolders.length === 0 && count(body.totalHolders) === 0) return null;
  if (topHolders.length === 0 && count(body.totalHolders) === null) return null;

  // Gather known liquidity pool, AMM, vault, and burn addresses from the report
  const poolAddresses = new Set<string>();
  if (Array.isArray(body.markets)) {
    for (const m of body.markets) {
      if (typeof m?.pubkey === 'string') poolAddresses.add(m.pubkey);
      if (typeof m?.liquidityA === 'string') poolAddresses.add(m.liquidityA);
      if (typeof m?.liquidityB === 'string') poolAddresses.add(m.liquidityB);
      if (typeof m?.mintLP === 'string') poolAddresses.add(m.mintLP);
    }
  }
  if (body.knownAccounts && typeof body.knownAccounts === 'object') {
    const accounts = Array.isArray(body.knownAccounts)
      ? body.knownAccounts
      : Object.entries(body.knownAccounts).map(([pubkey, info]: [string, any]) => ({ pubkey, ...info }));
    for (const a of accounts) {
      if (typeof a?.pubkey === 'string' && /pool|amm|curve|migration|vault|locker/i.test(`${a?.type || ''} ${a?.name || ''}`)) {
        poolAddresses.add(a.pubkey);
      }
    }
  }
  const BURN_OR_PROGRAM = new Set([
    '11111111111111111111111111111111',
    '1nc1nerator11111111111111111111111111111111',
  ]);

  // Rank unique wallet owners, not token accounts: a single wallet can own
  // multiple token accounts and must count only once in the top-ten holder set.
  const owners = new Map<string, number>();
  let holdersValid = true;
  for (const holder of topHolders) {
    const pct = percentage(holder?.pct);
    const owner = typeof holder?.owner === 'string' && holder.owner
      ? holder.owner
      : typeof holder?.address === 'string' && holder.address ? holder.address : null;
    const address = typeof holder?.address === 'string' ? holder.address : null;
    if (pct === null || !owner) {
      holdersValid = false;
      continue;
    }
    // Exclude pool and burn accounts from individual wallet rankings
    if (
      poolAddresses.has(owner) ||
      (address && poolAddresses.has(address)) ||
      BURN_OR_PROGRAM.has(owner) ||
      (address && BURN_OR_PROGRAM.has(address))
    ) {
      continue;
    }
    owners.set(owner, (owners.get(owner) ?? 0) + pct);
  }
  const sortedNonPool = [...owners.values()].sort((a, b) => b - a);
  const top10Sum = holdersValid
    ? (sortedNonPool.length > 0
        ? sortedNonPool.slice(0, 10).reduce((sum, pct) => sum + pct, 0)
        : 0)
    : null;
  const top10Pct = top10Sum === null ? null : percentage(Number(top10Sum.toFixed(2)));

  // 2. Creator holding percentage
  const creator = typeof body.creator === 'string' ? body.creator.trim() : null;
  let devPct: number | null = null;
  if (creator && topHolders.length > 0) {
    const creatorAccount = topHolders.find(
      (h: any) => h?.owner === creator || h?.address === creator,
    );
    if (creatorAccount) {
      devPct = percentage(creatorAccount.pct);
    } else if (body.creatorBalance !== undefined && body.creatorBalance === 0) {
      devPct = 0;
    } else if (typeof body.creatorBalance === 'number' && body.token?.supply && Number(body.token.supply) > 0) {
      devPct = percentage(Number(((body.creatorBalance / Number(body.token.supply)) * 100).toFixed(2)));
    }
  } else if (creator && body.creatorBalance !== undefined && body.creatorBalance === 0) {
    devPct = 0;
  }

  // The top-holder list is capped, so its insider flags cannot establish the
  // percentage held by all insiders. Leave that classification unavailable.
  const totalHolders = count(body.totalHolders);

  const risks = Array.isArray(body.risks) ? body.risks : [];
  // A graph count and flags on the capped top-holder list do not measure the
  // percentage of supply held by all insiders.
  let insidersPct = reportedRiskPercentage(risks, /insider/i);
  let insiderCount: number | null = null;
  if (insidersPct === null && Array.isArray(body.insiderNetworks) && body.insiderNetworks.length > 0 && body.token?.supply) {
    const supply = Number(body.token.supply);
    if (supply > 0) {
      const netSupply = body.insiderNetworks.reduce((sum: number, net: any) => sum + (Number(net?.currentHolding ?? net?.tokenAmount) || 0), 0);
      if (netSupply > 0) {
        insidersPct = percentage(Number(((netSupply / supply) * 100).toFixed(2)));
        insiderCount = count(body.graphInsidersDetected) ?? body.insiderNetworks.reduce((sum: number, net: any) => sum + (Number(net?.size ?? net?.activeAccounts) || 0), 0);
      }
    }
  }
  const bundlersPct = reportedRiskPercentage(risks, /high holder correlation|bundled supply|bundler/i);
  const snipersPct = reportedRiskPercentage(risks, /sniper/i);

  const profile: HolderProfile = {
    mint,
    top10Pct,
    totalHolders,
    snipersPct,
    insidersPct,
    bundlersPct,
    devPct,
    insiderCount,
    // Rugcheck does not classify profitable traders or KOL holders.
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
    const body = await readRugcheckReport(mint);
    return parseRugcheckOwnership(mint, body);
  } catch {
    return null;
  }
}
