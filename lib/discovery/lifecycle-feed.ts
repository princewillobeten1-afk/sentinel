import 'server-only';

import { CURVE_FRESHNESS_MS, finalStretch, getLifecycle, migrated } from '@/lib/market/lifecycle/lifecycle-engine';
import type { TokenLifecycle } from '@/lib/market/lifecycle/types';
import { fetchJupiterTokensByMint, mapJupiterToken, type JupiterToken } from './jupiter-feed';
import type { DiscoveryToken } from './types';

type Section = 'migrating' | 'graduated';
const METADATA_TTL_MS = 15_000;
const metadata = new Map<string, { token: JupiterToken; at: number }>();
const pending = new Map<string, Promise<void>>();

async function loadMetadata(mints: string[]): Promise<void> {
  const missing = mints.filter((mint) => Date.now() - (metadata.get(mint)?.at ?? 0) >= METADATA_TTL_MS).sort();
  if (!missing.length) return;
  const key = missing.join(',');
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const task = (async () => {
    const rows = await fetchJupiterTokensByMint(missing);
    const wanted = new Set(missing);
    for (const token of rows) {
      if (wanted.has(token.id)) metadata.set(token.id, { token, at: Date.now() });
    }
    for (const [mint, cached] of metadata) {
      if (Date.now() - cached.at > 5 * 60_000) metadata.delete(mint);
    }
  })();
  pending.set(key, task);
  try { await task; } finally { pending.delete(key); }
}

import { resolveLaunchpad } from '@/lib/market/lifecycle/launchpads';

/** The engine decides membership; metadata can decorate it, never classify it. */
export function applyLifecycleToToken(token: DiscoveryToken, record: TokenLifecycle): DiscoveryToken {
  const padConfig = record.launchpadInfo ?? resolveLaunchpad(record.launchpad);

  if (record.state === 'MIGRATED' && record.migration) {
    const proof = record.migration;
    const originLaunchpad = proof.originLaunchpad ?? record.launchpad;
    const originConfig = resolveLaunchpad(originLaunchpad);

    return {
      ...token,
      launchpad: originLaunchpad,
      launchpadInfo: originConfig,
      originLaunchpad: originConfig.name,
      lpHandling: proof.lpHandling || originConfig.lpHandling,
      graduationTarget: originConfig.graduationThreshold,
      bondingStatus: 'graduated', lifecycleState: 'migrated',
      bondingCurveProgress: undefined, migrationProgress: 100,
      migrationSignature: proof.signature, migratedAt: proof.migratedAt,
      migratedPool: proof.poolAddress, liquidityPoolAddress: proof.poolAddress, migratedDex: proof.dex,
      lifecycleEvidence: {
        status: 'measured', source: 'helius-confirmed-migration',
        observedAt: new Date(proof.migratedAt).toISOString(),
      },
    };
  }
  const curve = record.curve!;
  const progress = curve.progress * 100;
  return {
    ...token,
    launchpad: record.launchpad,
    launchpadInfo: padConfig,
    originLaunchpad: padConfig.name,
    graduationTarget: padConfig.graduationThreshold,
    bondingStatus: 'bonding', lifecycleState: 'final_stretch',
    bondingCurveProgress: progress, migrationProgress: progress,
    migrationSignature: undefined, migratedAt: undefined, migratedPool: undefined,
    migratedDex: padConfig.destinationDex,
    lifecycleEvidence: {
      status: 'measured', source: 'solana-bonding-curve',
      observedAt: new Date(curve.readAt).toISOString(),
      expiresAt: new Date(curve.readAt + CURVE_FRESHNESS_MS).toISOString(),
    },
  };
}

export async function getLifecycleDiscoveryTokens(section: Section): Promise<DiscoveryToken[]> {
  const select = section === 'migrating' ? finalStretch : migrated;
  const records = select().slice(0, 100);
  if (!records.length) return [];
  await loadMetadata(records.map((record) => record.mint));
  // A curve can complete while the metadata request is in flight. Re-check
  // membership after awaiting so the same token cannot reappear in Final Stretch.
  const eligible = new Set(select().map((record) => record.mint));
  const tokens: DiscoveryToken[] = [];
  for (const record of records) {
    const cached = metadata.get(record.mint);
    const current = getLifecycle(record.mint);
    if (!eligible.has(record.mint) || !current || !cached) continue;
    const token = mapJupiterToken(cached.token);
    if (Date.now() - cached.at >= METADATA_TTL_MS && token.marketEvidence) {
      token.marketEvidence = { ...token.marketEvidence, status: 'stale', observedAt: new Date(cached.at).toISOString() };
    }
    tokens.push(applyLifecycleToToken(token, current));
  }
  if (!tokens.length && records.some((record) => eligible.has(record.mint))) {
    throw new Error('Lifecycle confirmed; token metadata is temporarily unavailable. Retrying.');
  }
  return tokens;
}

export function __resetLifecycleFeed(): void {
  metadata.clear();
  pending.clear();
}
