import 'server-only';

import { logger } from '@/lib/server/logger';
import { PublicKey } from '@solana/web3.js';
import { quickNodeService } from '@/lib/server/quicknode';
import { bondingCurveAddress, decodeBondingCurve, PUMPFUN_PROGRAM_ID } from './bonding-curve';
import { fetchConfirmedSignatures, fetchMigrationWithFailover } from './migration-rpc';
import { MigrationHistory } from './migration-history';
import { fetchJupiterFeed, hasReadableCurve, type JupiterToken } from '@/lib/discovery/jupiter-feed';
import {
  applyCurveReading,
  evictStale,
  getAllByState,
  getLifecycle,
  lifecycleSize,
  onLifecycleChange,
  recordMigration,
  recordPairCreated,
  CURVE_FRESHNESS_MS,
} from './lifecycle-engine';
import { updateTokenCard } from '@/lib/market/live/card-cache';
import type { TokenLifecycle } from './types';
import { resolveLaunchpad } from './launchpads';

/**
 * Keeps the lifecycle engine current.
 *
 * ## Two transports, deliberately
 *
 * **Events lead.** A pair creation or a migration seen in the pump.fun program
 * logs is applied the moment it arrives, so a token leaves Final Stretch and
 * appears under Migrated without waiting for a poll — and without a page
 * refresh, since the engine notifies its subscribers.
 *
 * **Polling reconciles.** Log delivery can drop frames, the socket can
 * reconnect, and the server can restart with an empty map. A periodic sweep of
 * bonding-curve accounts re-derives the truth from chain state, so a missed
 * event costs freshness rather than correctness.
 *
 * Neither path uses market cap, price, age, or a timer to decide a state. The
 * only inputs are curve readings and observed migration events.
 *
 * ## Cost
 *
 * Curve reads batch through `getMultipleAccounts` at 100 addresses per call, so
 * a sweep of every tracked pre-migration token is one request. Migration
 * resolution costs one `getTransaction` per actual migration — a handful an
 * hour, not per trade.
 */

const SWEEP_INTERVAL_MS = Number(process.env.LIFECYCLE_SWEEP_MS ?? 15_000);
const MAX_CURVES_PER_SWEEP = 100;
const MAX_QUICKNODE_CURVES_PER_SWEEP = 25;
const MAX_HISTORICAL_MIGRATIONS_PER_SWEEP = 3;
const HISTORICAL_MIGRATION_RETRY_MS = 30 * 60_000;

/**
 * Prefer a dedicated lifecycle RPC, then the configured Helius RPC/key.
 * Public RPC is the last fallback when no provider is configured.
 */
function curveRpcUrl(): string {
  return process.env.LIFECYCLE_RPC_URL?.trim()
    || process.env.HELIUS_RPC_URL?.trim()
    || (process.env.HELIUS_API_KEY?.trim()
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY.trim()}`
      : 'https://api.mainnet-beta.solana.com');
}

class LifecycleWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;
  private pendingMigrations = new Set<string>();
  private unsubscribeLifecycle: (() => void) | null = null;
  private historicalMigrationCheckedAt = new Map<string, number>();
  private curveAttemptedAt = new Map<string, number>();
  private migrationHistory = new MigrationHistory();

  /**
   * Recovers a missed migration after reconnect/restart from the confirmed
   * destination pool's transaction history. The pool itself is the lookup
   * key, but the normal migration decoder must still prove both mint and pool;
   * a Jupiter graduation flag alone never creates a Migrated row.
   */
  private async reconcileHistoricalMigration(mint: string, poolAddress: string): Promise<void> {
    const checkedAt = this.historicalMigrationCheckedAt.get(mint) ?? 0;
    if (Date.now() - checkedAt < HISTORICAL_MIGRATION_RETRY_MS) return;
    this.historicalMigrationCheckedAt.set(mint, Date.now());

    try {
      const signatures = await fetchConfirmedSignatures(curveRpcUrl(), poolAddress, 8);
      if (!signatures) {
        // Provider outage is not a completed lookup. Retry on the next sweep.
        this.historicalMigrationCheckedAt.delete(mint);
        return;
      }
      for (const row of signatures) {
        if (!row.signature || row.err) continue;
        const resolved = await fetchMigrationWithFailover(curveRpcUrl(), row.signature);
        if (!resolved || resolved.mint !== mint || resolved.poolAddress !== poolAddress) continue;
        recordMigration(mint, {
          signature: resolved.signature,
          migratedAt: resolved.migratedAt,
          dex: resolved.dex,
          poolAddress: resolved.poolAddress,
        });
        return;
      }
    } catch (error) {
      logger.debug('[lifecycle] historical migration reconciliation failed', {
        mint,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private publishLifecycle(mint: string, record: TokenLifecycle): void {
    const migrated = record.state === 'MIGRATED';
    const observedAt = new Date(migrated ? record.stateChangedAt : record.curve?.readAt ?? record.stateChangedAt).toISOString();
    const lifecycleState = record.state === 'NEW_PAIR'
      ? 'new_pairs'
      : record.state === 'FINAL_STRETCH'
        ? 'final_stretch'
        : record.state === 'MIGRATING'
          ? 'migrating'
          : 'migrated';
    updateTokenCard(mint, {
      lifecycleState,
      bondingCurveProgress: record.curve && record.state !== 'MIGRATED'
        ? Number((record.curve.progress * 100).toFixed(2))
        : undefined,
      migrationSignature: record.migration?.signature,
      migratedPool: record.migration?.poolAddress,
      migratedDex: record.migration?.dex,
      migratedAt: record.migration?.migratedAt,
      liquidityPoolAddress: record.migration?.poolAddress,
      lifecycleEvidence: {
        status: record.curve || migrated ? 'measured' : 'loading',
        source: record.source === 'migration-event' ? 'helius-confirmed-migration' : 'solana-bonding-curve',
        observedAt,
        expiresAt: !migrated && record.curve ? new Date(record.curve.readAt + CURVE_FRESHNESS_MS).toISOString() : undefined,
      },
    }, record.source === 'migration-event' ? 'helius-confirmed-migration' : 'solana-bonding-curve', 'fresh', observedAt);
  }

  start(): void {
    if (this.timer) return;
    this.unsubscribeLifecycle = onLifecycleChange((mint, record) => this.publishLifecycle(mint, record));
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    logger.info('[lifecycle] worker started', {
      sweepIntervalMs: SWEEP_INTERVAL_MS,
      rpc: curveRpcUrl().replace(/api-key=[^&]+/, 'api-key=***'),
    });
    void this.sweep();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribeLifecycle?.();
    this.unsubscribeLifecycle = null;
  }

  /** A new pair was seen in the program logs. */
  onPairCreated(mint: string, launchpad?: TokenLifecycle['launchpad']): void {
    const pad = resolveLaunchpad(launchpad);
    recordPairCreated(mint, pad.id);
  }

  /**
   * A migration instruction was seen. Resolves the destination pool, then
   * confirms.
   *
   * Deduplicated by signature: the same transaction can arrive under more than
   * one subscription, and resolving it twice would spend a second RPC call to
   * reach the same answer.
   */
  async onMigrationDetected(signature: string): Promise<void> {
    if (this.pendingMigrations.has(signature)) return;
    this.pendingMigrations.add(signature);

    try {
      const resolved = await fetchMigrationWithFailover(curveRpcUrl(), signature);
      if (!resolved) {
        // Unresolvable means unconfirmed. The token stays where it is rather
        // than being moved to Migrated with no pool to point at.
        logger.debug('[lifecycle] migration seen but not resolvable', { signature });
        return;
      }

      recordMigration(resolved.mint, {
        signature: resolved.signature,
        migratedAt: resolved.migratedAt,
        dex: resolved.dex,
        poolAddress: resolved.poolAddress,
        originLaunchpad: resolved.originLaunchpad,
        lpHandling: resolved.lpHandling,
      }, resolved.originLaunchpad ?? 'pump.fun');

      logger.info('[lifecycle] migration confirmed', {
        mint: resolved.mint,
        dex: resolved.dex,
        pool: resolved.poolAddress,
        originLaunchpad: resolved.originLaunchpad,
      });
    } finally {
      // Kept briefly so a burst of duplicate notifications collapses, then
      // released so a genuine retry of the same signature can be re-resolved.
      setTimeout(() => this.pendingMigrations.delete(signature), 60_000);
    }
  }

  /**
   * Registers newly launched pairs and discovers active on-curve tokens
   * across multiple Jupiter feeds (recent, trending, traded).
   *
   * Multi-feed discovery ensures we don't only see 10-second-old 0% curve tokens,
   * but also capture active tokens advancing through the 75%-99% final stretch.
   * Jupiter graduation hints only schedule proof recovery; they never classify a row.
   */
  private async seedNewPairs(): Promise<void> {
    try {
      const results = await Promise.allSettled([
        fetchJupiterFeed('recent', { limit: 100 }),
        fetchJupiterFeed('toptrending', { limit: 100, window: '5m' }),
        fetchJupiterFeed('toptrending', { limit: 100, window: '1h' }),
        fetchJupiterFeed('toptrending', { limit: 100, window: '6h' }),
        fetchJupiterFeed('toptraded', { limit: 100, window: '5m' }),
        fetchJupiterFeed('toptraded', { limit: 100, window: '1h' }),
        fetchJupiterFeed('toptraded', { limit: 100, window: '6h' }),
        fetchJupiterFeed('toporganicscore', { limit: 100, window: '5m' }),
        fetchJupiterFeed('toporganicscore', { limit: 100, window: '1h' }),
      ]);

      const historicalCandidates: Array<{ mint: string; pool: string }> = [];
      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        const rows: JupiterToken[] = result.value;

        for (const row of rows) {
          if (!row.id) continue;
          const isPump = hasReadableCurve(row) || row.id.endsWith('pump');
          if (!isPump) continue;

          // Jupiter can indicate that graduation happened, but it does not
          // supply the confirmed transaction signature needed as proof. Keep
          // it out of Migrated until the Helius decoder resolves that event.
          if (row.graduatedPool || row.graduatedAt) {
            if (row.graduatedPool && !getLifecycle(row.id)?.migration) {
              historicalCandidates.push({ mint: row.id, pool: row.graduatedPool });
            }
            continue;
          }

          // Idempotent — an already-tracked token keeps its state.
          const pad = resolveLaunchpad(row);
          recordPairCreated(row.id, pad.id);
        }
      }

      // Supplementary discovery: DexScreener boosted and trending Solana tokens on Pump.fun
      try {
        const dexUrls = [
          'https://api.dexscreener.com/token-boosts/top/v1',
          'https://api.dexscreener.com/token-boosts/latest/v1',
          'https://api.dexscreener.com/token-profiles/latest/v1',
        ];
        const dexResults = await Promise.allSettled(
          dexUrls.map((url) =>
            fetch(url, { signal: AbortSignal.timeout(4_000), headers: { accept: 'application/json' } })
              .then((r) => (r.ok ? r.json() : []))
              .catch(() => []),
          ),
        );
        for (const res of dexResults) {
          if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
          for (const item of res.value) {
            const address = item?.tokenAddress;
            if (item?.chainId === 'solana' && typeof address === 'string' && (address.endsWith('pump') || (typeof item.url === 'string' && item.url.includes('pump')))) {
              if (!getLifecycle(address)) {
                recordPairCreated(address, 'pump.fun');
              }
            }
          }
        }
      } catch {
        // DexScreener supplementary discovery is best effort
      }

      const uniqueCandidates = [...new Map(historicalCandidates.map((candidate) => [candidate.mint, candidate])).values()]
        .filter((candidate) => Date.now() - (this.historicalMigrationCheckedAt.get(candidate.mint) ?? 0) >= HISTORICAL_MIGRATION_RETRY_MS)
        .slice(0, MAX_HISTORICAL_MIGRATIONS_PER_SWEEP);
      for (const candidate of uniqueCandidates) {
        // Historical proof recovery is deliberately off the curve-sweep
        // critical path. Awaiting up to eight transaction decodes per pool
        // delayed every bonding-curve read, leaving Final Stretch empty while
        // migration history was still being searched.
        void this.reconcileHistoricalMigration(candidate.mint, candidate.pool);
      }
    } catch {
      // Reconciliation is best-effort; the next sweep retries.
    }
  }

  /** Re-reads curve state for everything not yet migrated. */
  async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;

    try {
      // Recovery runs beside, not ahead of, the curve sweep. Popular migrated
      // pools have hundreds of swaps: their last eight transactions rarely
      // contain pool creation, whereas this authority history contains events.
      void this.migrationHistory.reconcile(curveRpcUrl(), (resolved) => {
        recordMigration(resolved.mint, {
          signature: resolved.signature, migratedAt: resolved.migratedAt,
          dex: resolved.dex, poolAddress: resolved.poolAddress,
        });
      }).catch(() => logger.debug('[lifecycle] migration catch-up unavailable'));
      evictStale();
      await this.seedNewPairs();
      const tracked = [
        ...getAllByState('NEW_PAIR'),
        ...getAllByState('FINAL_STRETCH'),
        ...getAllByState('MIGRATING'),
      ];
      if (tracked.length === 0) return;

      // Prioritize tokens in FINAL_STRETCH and MIGRATING so near-graduation curves
      // update with lowest latency, followed by unread candidates (curve === null),
      // followed by oldest reading first.
      const due = tracked
        .sort((a, b) => {
          const priorityA = a.state === 'FINAL_STRETCH' ? 3 : a.state === 'MIGRATING' ? 4 : a.curve === null ? 2 : 1;
          const priorityB = b.state === 'FINAL_STRETCH' ? 3 : b.state === 'MIGRATING' ? 4 : b.curve === null ? 2 : 1;
          if (priorityA !== priorityB) return priorityB - priorityA;
          const attemptedA = a.curve?.readAt ?? this.curveAttemptedAt.get(a.mint) ?? 0;
          const attemptedB = b.curve?.readAt ?? this.curveAttemptedAt.get(b.mint) ?? 0;
          if (attemptedA !== attemptedB) return attemptedA - attemptedB;
          // Among unread curves, scan newer launches first so the visible
          // launch feed is not stuck behind a backlog of old, absent accounts.
          return b.firstSeenAt - a.firstSeenAt;
        })
        .slice(0, MAX_CURVES_PER_SWEEP)
        .map((record) => record.mint);

      // One bounded getMultipleAccounts read. A failed Helius read is retried
      // against verified QuickNode mainnet; absent accounts remain absent.
      const addresses = due.map(mint => new PublicKey(bondingCurveAddress(mint)));
      const { value: sweep } = await quickNodeService.read(curveRpcUrl(), async (rpc, source) => {
        // QuickNode Discover plans cap getMultipleAccounts at five accounts.
        // Its RPC is healthy, but a 100-address fallback returns HTTP 413.
        const batchSize = source === 'quicknode' ? 5 : 100;
        const budget = source === 'quicknode' ? MAX_QUICKNODE_CURVES_PER_SWEEP : addresses.length;
        const accounts: Array<Awaited<ReturnType<typeof rpc.getAccountInfo>>> = [];
        for (let offset = 0; offset < Math.min(addresses.length, budget); offset += batchSize) {
          try {
            accounts.push(...await rpc.getMultipleAccountsInfo(addresses.slice(offset, offset + batchSize), 'confirmed'));
          } catch (error) {
            // A later quota error must not throw away earlier confirmed reads.
            // The unread remainder stays due for the next sweep.
            if (accounts.length === 0) throw error;
            break;
          }
        }
        const readings = new Map<string, NonNullable<ReturnType<typeof decodeBondingCurve>>>();
        accounts.forEach((account, index) => {
          if (!account || !account.owner.equals(new PublicKey(PUMPFUN_PROGRAM_ID))) return;
          const curve = decodeBondingCurve(account.data);
          if (curve) readings.set(due[index], curve);
        });
        return { readings, attempted: due.slice(0, accounts.length) };
      });
      for (const mint of sweep.attempted) this.curveAttemptedAt.set(mint, Date.now());
      for (const [mint, curve] of sweep.readings) {
        applyCurveReading(mint, curve);
      }

      const evicted = evictStale();
      if (evicted > 0) {
        logger.debug('[lifecycle] evicted stalled tokens', { evicted, tracking: lifecycleSize() });
      }
    } catch (err) {
      logger.warn('[lifecycle] sweep failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.sweeping = false;
    }
  }

  /** Snapshot for the status endpoint. */
  stats() {
    return {
      tracking: lifecycleSize(),
      newPair: getAllByState('NEW_PAIR').length,
      finalStretch: getAllByState('FINAL_STRETCH').length,
      migrating: getAllByState('MIGRATING').length,
      migrated: getAllByState('MIGRATED').length,
      sweepIntervalMs: SWEEP_INTERVAL_MS,
      running: this.timer !== null,
      historicalMigrationChecks: this.historicalMigrationCheckedAt.size,
    };
  }

  /** Whether a mint is already known, so callers can skip redundant work. */
  knows(mint: string): boolean {
    return getLifecycle(mint) !== null;
  }
}

const globalForLifecycle = globalThis as unknown as { lifecycleWorker?: LifecycleWorker };
export const lifecycleWorker = globalForLifecycle.lifecycleWorker ?? new LifecycleWorker();
if (process.env.NODE_ENV !== 'production') globalForLifecycle.lifecycleWorker = lifecycleWorker;
