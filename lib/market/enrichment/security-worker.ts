import 'server-only';

import { Connection, PublicKey, type AccountInfo } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, unpackMint } from '@solana/spl-token';
import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import { acquireBirdeyeSlot } from './birdeye-limiter';
import { getAudit } from './audit-worker';
import { calculateRugRisk, RUG_RISK_VERSION } from './rug-risk';
import { getTokenCardPatch, updateTokenCard } from '@/lib/market/live/card-cache';
import { currentEvidence } from '@/lib/discovery/audit-freshness';
import { saveTokenCardEvidence } from '@/lib/server/db/token-card-evidence-repository';
import { getLiquidityLock } from '@/lib/trading/rugcheck-liquidity';

const SECURITY_TTL_MS = 60 * 60_000;
const CREATOR_TTL_MS = 24 * 60 * 60_000;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 60_000;
const MAX_QUEUE = 200;
/** Next reconciliation time, bounded by the shortest-lived contributing source. */
const cache = new Map<string, number>();
const creatorCache = new Map<string, { result: CreatorAgeResult; fetchedAt: number }>();
const authorityCache = new Map<string, { value: MintAuthorities; fetchedAt: number; permanent: boolean }>();
const pending: string[] = [];
const queued = new Set<string>();
let targets = new Set<string>();
let activeMint: string | null = null;
let draining = false;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

interface MintAuthorities {
  mintRevoked?: boolean;
  freezeRevoked?: boolean;
}

function rpcUrl(): string {
  return env.HELIUS_RPC_URL || (env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}` : '');
}

interface BirdeyeSecurity {
  creatorAddress?: string | null;
  creatorPercentage?: number | string | null;
  top10HolderPercent?: number | null;
  lockInfo?: Record<string, unknown> | null;
}

async function fetchBirdeyeSecurity(mint: string): Promise<BirdeyeSecurity | null> {
  if (!env.BIRDEYE_API_KEY) return null;
  await acquireBirdeyeSlot('background');
  const url = new URL('/defi/token_security', 'https://public-api.birdeye.so');
  url.searchParams.set('address', mint);
  const response = await fetch(url, {
    headers: { 'X-API-KEY': env.BIRDEYE_API_KEY, 'x-chain': 'solana', Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = await response.json() as { success?: boolean; data?: BirdeyeSecurity };
  return body.success && body.data ? body.data : null;
}

/** Reject token accounts, unrelated owners and uninitialized mint bytes. */
export function parseMintAuthorities(mint: string, info: AccountInfo<Buffer> | null): MintAuthorities {
  if (!info || (!info.owner.equals(TOKEN_PROGRAM_ID) && !info.owner.equals(TOKEN_2022_PROGRAM_ID))) return {};
  try {
    const decoded = unpackMint(new PublicKey(mint), info, info.owner);
    if (!decoded.isInitialized || ![0, 1].includes(info.data.readUInt32LE(0))
      || ![0, 1].includes(info.data.readUInt32LE(46))) return {};
    return { mintRevoked: decoded.mintAuthority === null, freezeRevoked: decoded.freezeAuthority === null };
  } catch { return {}; }
}

function connection(endpoint: string): Connection {
  return new Connection(endpoint, {
    commitment: 'confirmed', disableRetryOnRateLimit: true,
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
  });
}

async function fetchMintAuthorities(mint: string): Promise<MintAuthorities> {
  const cached = authorityCache.get(mint);
  if (cached && (cached.permanent || Date.now() - cached.fetchedAt < SECURITY_TTL_MS)) return cached.value;
  const endpoint = rpcUrl();
  if (!endpoint) return {};
  const info = await connection(endpoint).getAccountInfo(new PublicKey(mint), 'confirmed');
  const value = parseMintAuthorities(mint, info);
  if (value.mintRevoked === undefined) return {};
  authorityCache.set(mint, {
    value,
    fetchedAt: Date.now(),
    // Neither authority can be restored after revocation, so the mint account
    // does not need to be polled again for these facts.
    permanent: value.mintRevoked === true && value.freezeRevoked === true,
  });
  return value;
}

interface CreatorAgeResult { age?: string; firstActivityAt?: number; reason?: string }

function formatWalletAge(firstActivityAt: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - firstActivityAt) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days}d`;
  return `${Math.floor(days / 365)}y`;
}

/** Finds the true earliest signature when the wallet fits within five pages. */
async function fetchCreatorAge(address: string): Promise<CreatorAgeResult> {
  const cached = creatorCache.get(address);
  if (cached && Date.now() - cached.fetchedAt < CREATOR_TTL_MS) {
    return cached.result.firstActivityAt
      ? { ...cached.result, age: formatWalletAge(cached.result.firstActivityAt) }
      : cached.result;
  }
  const endpoint = rpcUrl();
  if (!endpoint) return { reason: 'Helius RPC is not configured.' };
  const remember = (result: CreatorAgeResult): CreatorAgeResult => {
    creatorCache.set(address, { result, fetchedAt: Date.now() });
    return result;
  };
  const rpc = connection(endpoint);
  const owner = new PublicKey(address);
  let before: string | undefined;
  let oldestSeconds: number | null = null;
  for (let page = 0; page < 5; page += 1) {
    const batch = await rpc.getSignaturesForAddress(owner, { limit: 1_000, before }, 'confirmed');
    if (batch.length === 0) {
      return oldestSeconds === null
        ? remember({ reason: 'Creator history has no confirmed timestamp.' })
        : remember({ age: formatWalletAge(oldestSeconds * 1_000), firstActivityAt: oldestSeconds * 1_000 });
    }
    for (const signature of batch) {
      if (signature.err === null && typeof signature.blockTime === 'number') oldestSeconds = Math.min(oldestSeconds ?? signature.blockTime, signature.blockTime);
    }
    if (batch.length < 1_000) {
      if (oldestSeconds === null) return remember({ reason: 'Creator history has no confirmed timestamp.' });
      const firstActivityAt = oldestSeconds * 1_000;
      return remember({ age: formatWalletAge(firstActivityAt), firstActivityAt });
    }
    before = batch[batch.length - 1]?.signature;
  }
  return remember({ reason: 'Creator history exceeds the bounded scan; wallet age is unavailable.' });
}

async function enrich(mint: string): Promise<void> {
  const [authorities, security, liquidityLock] = await Promise.all([
    fetchMintAuthorities(mint).catch((): MintAuthorities => ({})),
    fetchBirdeyeSecurity(mint).catch(() => null),
    getLiquidityLock(mint),
  ]);
  const cachedAudit = getAudit(mint);
  const card = getTokenCardPatch(mint)?.changedFields;
  const ownershipTtl = card?.lifecycleState === 'migrated' ? 180_000 : 60_000;
  const audit = cachedAudit && Date.now() - cachedAudit.fetchedAt < ownershipTtl
    && currentEvidence(card?.ownershipEvidence).status === 'measured' ? cachedAudit : null;
  // Ownership comes from Holder Profile only. Token Security percentage units
  // are not interchangeable with that contract and must not override its tags.
  const devPct = audit?.devPct;
  const top10Pct = audit?.top10Pct;
  // A boolean is retained for the compact shared pill, but only a virtually
  // complete lock earns "yes". The exact percentage is carried separately.
  const liquidityLocked = liquidityLock.lpLockedPct === null ? undefined : liquidityLock.lpLockedPct >= 99.9;
  const creator = security?.creatorAddress
    ? await fetchCreatorAge(security.creatorAddress).catch((): CreatorAgeResult => ({ reason: 'Creator history request failed.' }))
    : null;
  const measured = authorities.mintRevoked !== undefined || authorities.freezeRevoked !== undefined || security !== null || liquidityLock.lpLockedPct !== null;
  if (!measured) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    updateTokenCard(mint, {
      securityEvidence: {
        status: 'unavailable',
        source: 'helius-rpc+birdeye-security',
        observedAt: new Date().toISOString(),
        reason: 'Security providers returned no usable evidence.',
      },
    }, 'security-coordinator', 'stale');
    return;
  }
  consecutiveFailures = 0;

  const observedAt = new Date().toISOString();
  const rugRisk = calculateRugRisk({
    top10Pct,
    devPct,
    snipersPct: audit?.snipersPct,
    insidersPct: audit?.insidersPct,
    bundlersPct: audit?.bundlersPct,
    mintAuthorityRevoked: authorities.mintRevoked,
    freezeAuthorityRevoked: authorities.freezeRevoked,
    liquidityLocked: currentEvidence(liquidityLock.evidence).status === 'measured' ? liquidityLocked : undefined,
  });
  updateTokenCard(mint, {
    devAddress: security?.creatorAddress ?? undefined,
    devWalletAge: creator?.age,
    isMintRenounced: authorities.mintRevoked,
    isFreezeDisabled: authorities.freezeRevoked,
    isLiquidityLocked: liquidityLocked,
    lpLockedPct: liquidityLock.lpLockedPct,
    liquidityEvidence: liquidityLock.evidence,
    rugRisk: rugRisk ?? undefined,
    auditVersion: RUG_RISK_VERSION,
    securityEvidence: {
      status: authorities.mintRevoked !== undefined && authorities.freezeRevoked !== undefined ? 'measured' : 'unavailable',
      source: 'helius-rpc+birdeye-security+rugcheck',
      observedAt,
      expiresAt: new Date(Date.now() + SECURITY_TTL_MS).toISOString(),
      reason: authorities.mintRevoked !== undefined && authorities.freezeRevoked !== undefined ? undefined : 'Mint authority lookup was incomplete; retained authority values are not current.',
    },
    creatorEvidence: security?.creatorAddress ? {
      status: creator?.age ? 'measured' : 'unavailable',
      source: 'helius-creator-history',
      observedAt,
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      reason: creator?.reason,
    } : undefined,
  }, 'helius-rpc+birdeye-security', 'fresh', observedAt);
  void saveTokenCardEvidence(mint, 'security', {
    creatorAddress: security?.creatorAddress ?? null,
    devHoldingsPct: devPct ?? null,
    top10HoldingsPct: top10Pct ?? null,
    isMintRenounced: authorities.mintRevoked ?? null,
    isFreezeDisabled: authorities.freezeRevoked ?? null,
    isLiquidityLocked: liquidityLocked ?? null,
    lpLockedPct: liquidityLock.lpLockedPct,
    rugRisk,
  }, observedAt, RUG_RISK_VERSION);
  if (security?.creatorAddress) {
    void saveTokenCardEvidence(mint, 'creator', {
      creatorAddress: security.creatorAddress,
      devWalletAge: creator?.age ?? null,
      firstActivityAt: creator?.firstActivityAt ?? null,
      failureReason: creator?.reason ?? null,
    }, observedAt, RUG_RISK_VERSION);
  }
  const liquidityExpiry = Date.parse(liquidityLock.evidence.expiresAt ?? '');
  cache.set(mint, Math.min(
    Date.now() + (authorities.mintRevoked !== undefined && authorities.freezeRevoked !== undefined ? SECURITY_TTL_MS : 60_000),
    Number.isFinite(liquidityExpiry) ? Math.max(Date.now() + 1_000, liquidityExpiry) : Date.now() + 60_000,
  ));
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (pending.length) {
      const mint = pending.shift();
      if (!mint) continue;
      activeMint = mint;
      try { await enrich(mint); }
      catch (error) {
        const observedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : String(error);
        updateTokenCard(mint, {
          securityEvidence: {
            status: 'unavailable',
            source: 'helius-rpc+birdeye-security',
            observedAt,
            reason: message,
          },
        }, 'security-coordinator', 'stale', observedAt);
        logger.debug('[security] enrichment failed', { mint, message });
      }
      finally { queued.delete(mint); activeMint = null; }
      if (Date.now() < circuitOpenUntil && pending.length > 0) {
        const affected = [...pending];
        pending.length = 0;
        const observedAt = new Date().toISOString();
        for (const affectedMint of affected) {
          queued.delete(affectedMint);
          updateTokenCard(affectedMint, {
            securityEvidence: {
              status: 'unavailable',
              source: 'helius-rpc+birdeye-security',
              observedAt,
              reason: 'Security provider circuit breaker is cooling down after repeated failures.',
            },
          }, 'security-coordinator', 'stale', observedAt);
        }
      }
    }
  } finally {
    draining = false;
  }
}

export function setSecurityTargets(mints: string[]): void {
  const now = Date.now();
  targets = new Set(mints.filter(Boolean));
  if (now < circuitOpenUntil) {
    const observedAt = new Date().toISOString();
    for (const mint of targets) {
      updateTokenCard(mint, {
        securityEvidence: {
          status: 'unavailable',
          source: 'helius-rpc+birdeye-security',
          observedAt,
          reason: 'Security provider circuit breaker is cooling down after repeated failures.',
        },
      }, 'security-coordinator', 'stale', observedAt);
    }
    return;
  }
  const previouslyQueued = new Set(queued);
  pending.length = 0;
  queued.clear();
  if (activeMint) queued.add(activeMint);
  for (const mint of targets) {
    if (!mint || mint === activeMint || (cache.get(mint) ?? 0) > now) continue;
    if (pending.length >= MAX_QUEUE) break;
    queued.add(mint);
    pending.push(mint);
    if (!previouslyQueued.has(mint)) {
      updateTokenCard(mint, {
        securityEvidence: {
          status: 'loading',
          source: 'helius-rpc+birdeye-security',
          observedAt: new Date().toISOString(),
        },
      }, 'security-coordinator');
    }
  }
  if (!draining) void drain();
}

/** An on-demand audit must not evict the current visible-card work. */
export function queueSecurityTarget(mint: string): void {
  if (!mint || queued.has(mint) || Date.now() < circuitOpenUntil
    || (cache.get(mint) ?? 0) > Date.now() || pending.length >= MAX_QUEUE) return;
  queued.add(mint);
  pending.push(mint);
  if (!draining) void drain();
}

export function securityStats(): { cached: number; queued: number; draining: boolean; consecutiveFailures: number; circuitOpen: boolean; circuitRetryAfterMs: number } {
  return {
    cached: cache.size,
    queued: queued.size,
    draining,
    consecutiveFailures,
    circuitOpen: Date.now() < circuitOpenUntil,
    circuitRetryAfterMs: Math.max(0, circuitOpenUntil - Date.now()),
  };
}

export function __resetSecurityWorker(): void {
  cache.clear(); creatorCache.clear(); authorityCache.clear(); pending.length = 0; queued.clear(); targets.clear(); activeMint = null; draining = false; consecutiveFailures = 0; circuitOpenUntil = 0;
}
