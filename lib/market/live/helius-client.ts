import 'server-only';

import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import type { RawMarketEvent } from '@/lib/market/event-pipeline';
import { ReconnectingWebSocketClient } from './ws-client';
import { matchLogsAnyProgram } from './helius-log-matchers';
import { normalizeHeliusLogMatch } from './normalizers';
import { enrichSignature } from './transaction-enricher';
import { classifyLifecycleLogs, QUOTE_MINTS, PUMPFUN_MIGRATION_AUTHORITY } from '@/lib/market/lifecycle/migration-detector';
import { lifecycleWorker } from '@/lib/market/lifecycle/lifecycle-worker';
import type { ConnectionHealth, HeliusLogsNotification, HeliusMessage, HeliusSubscribeResponse } from './types';

function isSubscribeResponse(message: HeliusMessage): message is HeliusSubscribeResponse {
  return typeof (message as HeliusSubscribeResponse).id === 'number' && typeof (message as HeliusSubscribeResponse).result === 'number';
}

function isLogsNotification(message: HeliusMessage): message is HeliusLogsNotification {
  return (message as HeliusLogsNotification).method === 'logsNotification';
}

/** A JSON-RPC error answering one of our requests — e.g. a refused subscribe. */
function asErrorResponse(message: HeliusMessage): { id: number; error: unknown } | null {
  const candidate = message as { id?: unknown; error?: unknown };
  return typeof candidate.id === 'number' && candidate.error !== undefined
    ? { id: candidate.id, error: candidate.error }
    : null;
}

/**
 * pump.fun's migration authority.
 *
 * Found rather than assumed: it is one of the accounts common to every recent
 * pump.fun migration transaction (checked against six real `MigrateV2`
 * signatures from the Migrated column, with three different fee payers). It is
 * the only such account that appears in nothing *but* migrations — measured
 * over 120s, a `mentions` subscription on it delivered 1 frame (10 KB) and that
 * frame was the one migration in the window. The other shared accounts are
 * program-wide and ran 0.9-5.9 MB/min.
 *
 * This replaces the pump.fun program sweep as the migration trigger.
 */
export { PUMPFUN_MIGRATION_AUTHORITY } from '@/lib/market/lifecycle/migration-detector';

/**
 * A Solana address: 32-44 base58 characters.
 *
 * Checked before a mint becomes a `mentions` subscription, because the watched
 * set is built from client topic names and a client can name anything. A live
 * client subscribed to `token.price:*`; the `*` became `mentions:['*']`, Helius
 * refused it (`-32602 Invalid mentions provided`), and every reconcile retried
 * the refusal.
 */
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const MIGRATIONS_LABEL = 'migrations';
const MINT_LABEL_PREFIX = 'mint:';

/**
 * Upper bound on concurrent per-mint subscriptions.
 *
 * A browser session is capped at 30 topics, so one tab wants at most ~30 mints
 * and a few tabs a few dozen. The bound only matters if many distinct clients
 * watch disjoint sets, and there it keeps the upstream cost bounded rather than
 * proportional to the number of viewers.
 */
const MAX_MINT_SUBSCRIPTIONS = Number(process.env.HELIUS_MAX_MINT_SUBSCRIPTIONS ?? 100);

/**
 * Data budget for any single mint subscription.
 *
 * `mentions:[account]` costs whatever that account's traffic is, and some
 * accounts are the whole market in disguise: measured, `mentions:[wSOL]` ran at
 * 124 MB/min and USDC at 42.5 MB/min, against ~0.07 MB/min for a typical
 * Discover token. The known quote mints are excluded outright; this catches the
 * ones nobody listed — a pool, a stablecoin, a token in a frenzy. A mint that
 * spends its budget inside the window is unsubscribed and barred for a while,
 * and its card falls back to the REST poll instead of streaming.
 */
const MINT_BUDGET_BYTES_PER_MIN = Number(process.env.HELIUS_MINT_BUDGET_MB_PER_MIN ?? 2) * 1024 * 1024;
const BUDGET_WINDOW_MS = 30_000;
const OVER_BUDGET_BAR_MS = 15 * 60_000;

export interface HeliusClientOptions {
  onRawEvent: (event: RawMarketEvent) => void;
  onDegraded: (reason: string) => void;
}

/**
 * Helius `logsSubscribe` client, scoped to what is actually being watched.
 *
 * ## What it subscribes to
 *
 * - **One migration subscription, always.** `mentions:[migration authority]`
 *   delivers every pump.fun migration and nothing else, at ~0.01 MB/min. It
 *   stays open with no clients connected, so the Migrated column keeps
 *   accumulating while nobody is looking — which the program sweep only did
 *   at 2.2 GB/hour.
 * - **One subscription per watched mint.** The union of the mints connected
 *   clients hold `token.*` topics for, plus a focused mint if a token page has
 *   asked for one. Reconciled by diff, so a Discover refresh that swaps three
 *   rows costs three unsubscribes and three subscribes, not a rebuild.
 *
 * ## What it replaced
 *
 * `logsSubscribe` on three entire DEX programs, from boot, forever: 36.7 MB/min
 * measured, ~460 frames a second, of which a browser could ever receive the
 * few touching its 30 subscribed tokens. See `stream-demand.ts`.
 */
export class HeliusClient {
  private readonly client: ReconnectingWebSocketClient;
  private readonly onRawEvent: (event: RawMarketEvent) => void;

  /** Request id → label, for subscribes awaiting their subscription id. */
  private pendingRequests = new Map<number, string>();
  /** Subscription id (from the RPC response) → label. */
  private subscriptions = new Map<number, string>();
  /** Label → subscription id, so one mint can be unsubscribed on its own. */
  private subscriptionByLabel = new Map<string, number>();
  private nextRequestId = 1;

  /** Mints connected clients are watching, as reported by `stream-demand`. */
  private watchedMints: string[] = [];

  /**
   * A mint a token page has asked to be watched, whether or not a client holds
   * a topic for it. Always first in line for a subscription slot.
   */
  private focusedMint: string | null = null;

  /** Bytes each mint subscription has delivered in its current budget window. */
  private usage = new Map<string, { bytes: number; since: number }>();
  /** Mints dropped for exceeding their budget → when they may be tried again. */
  private barredUntil = new Map<string, number>();

  constructor(options: HeliusClientOptions) {
    this.onRawEvent = options.onRawEvent;

    const apiKey = env.getRequiredEnv('HELIUS_API_KEY');
    const wsUrl = env.HELIUS_WS_URL.includes('api-key=')
      ? env.HELIUS_WS_URL
      : `${env.HELIUS_WS_URL.replace(/\/+$/, '')}/?api-key=${apiKey}`;

    this.client = new ReconnectingWebSocketClient({
      name: 'helius',
      url: wsUrl,
      onOpen: () => this.handleOpen(),
      onMessage: (raw) => this.handleMessage(raw),
      onDegraded: options.onDegraded,
    });
  }

  connect(): void {
    this.client.connect();
  }

  stop(): void {
    this.client.stop();
  }

  getHealth(): ConnectionHealth {
    return this.client.getHealth();
  }

  getFocusedMint(): string | null {
    return this.focusedMint;
  }

  /** Live per-mint subscriptions, and whether the migration watch is held. */
  getSubscriptionCounts(): { mints: number; migrations: boolean } {
    let mints = 0;
    for (const label of this.subscriptionByLabel.keys()) {
      if (label.startsWith(MINT_LABEL_PREFIX)) mints += 1;
    }
    return { mints, migrations: this.subscriptionByLabel.has(MIGRATIONS_LABEL) };
  }

  /**
   * Guarantees this mint a subscription while its token page is open.
   *
   * Previously this swapped the whole program sweep out for one mint, because
   * the enricher could not keep up with both. With every subscription already
   * scoped to a mint there is nothing to swap out: focusing now only makes sure
   * the page's token is watched even if no socket holds a topic for it yet.
   */
  focusMint(mint: string): void {
    if (this.focusedMint === mint) return;
    this.focusedMint = mint;
    logger.info('[helius] focusing stream on mint', { mint });
    this.reconcile();
  }

  clearFocus(): void {
    if (this.focusedMint === null) return;
    logger.info('[helius] releasing mint focus', { mint: this.focusedMint });
    this.focusedMint = null;
    this.reconcile();
  }

  /** Replaces the set of client-watched mints and subscribes to the difference. */
  setWatchedMints(mints: string[]): void {
    this.watchedMints = mints;
    this.reconcile();
  }

  // ── Internal ──

  /** Every label that should hold a subscription right now. */
  private wantedLabels(): Set<string> {
    const labels = new Set<string>([MIGRATIONS_LABEL]);
    const ordered = this.focusedMint ? [this.focusedMint, ...this.watchedMints] : this.watchedMints;
    for (const mint of ordered) {
      if (labels.size - 1 >= MAX_MINT_SUBSCRIPTIONS) break;
      // A quote mint is never subscribed by `mentions`. Wrapped SOL and USDC
      // sit on one side of nearly every swap on Solana, so `mentions:[wSOL]`
      // is not "SOL's trades" — it is the whole DEX market again, worse than
      // the program sweep this replaced. Measured live: a client watching SOL
      // alongside 20 tokens drove the stream to 214 MB/min. Their prices come
      // from the canonical price source, not from logs.
      if (!SOLANA_ADDRESS.test(mint)) continue;
      if (QUOTE_MINTS.has(mint)) continue;
      if (this.isBarred(mint)) continue;
      labels.add(`${MINT_LABEL_PREFIX}${mint}`);
    }
    return labels;
  }

  /**
   * Brings live subscriptions in line with `wantedLabels()`.
   *
   * Safe to call while disconnected: a send on a closed socket goes nowhere,
   * and `handleOpen` discards all bookkeeping and rebuilds from scratch.
   */
  private reconcile(): void {
    const wanted = this.wantedLabels();

    let removed = 0;
    for (const [label, subscriptionId] of this.subscriptionByLabel) {
      if (wanted.has(label)) continue;
      this.client.send({
        jsonrpc: '2.0',
        id: this.nextRequestId++,
        method: 'logsUnsubscribe',
        params: [subscriptionId],
      });
      this.subscriptionByLabel.delete(label);
      this.subscriptions.delete(subscriptionId);
      this.usage.delete(label);
      removed += 1;
    }

    const pending = new Set(this.pendingRequests.values());
    let added = 0;
    for (const label of wanted) {
      if (this.subscriptionByLabel.has(label) || pending.has(label)) continue;
      this.subscribe(label);
      added += 1;
    }

    if (added > 0 || removed > 0) {
      logger.debug('[helius] subscriptions reconciled', {
        added,
        removed,
        mints: wanted.size - 1,
      });
    }
  }

  private subscribe(label: string): void {
    const target = label === MIGRATIONS_LABEL ? PUMPFUN_MIGRATION_AUTHORITY : label.slice(MINT_LABEL_PREFIX.length);
    const id = this.nextRequestId++;
    this.pendingRequests.set(id, label);
    this.client.send({
      jsonrpc: '2.0',
      id,
      method: 'logsSubscribe',
      params: [{ mentions: [target] }, { commitment: 'confirmed' }],
    });
  }

  /** A new socket carries no subscriptions: forget the old ones and rebuild. */
  private handleOpen(): void {
    this.pendingRequests.clear();
    this.subscriptions.clear();
    this.subscriptionByLabel.clear();
    this.reconcile();
    logger.info('[helius] subscribed', {
      migrations: true,
      mints: this.wantedLabels().size - 1,
    });
  }

  private handleMessage(raw: string): void {
    let message: HeliusMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      logger.warn('[helius] failed to parse message', { rawLength: raw.length });
      return;
    }

    if (isSubscribeResponse(message)) {
      const label = this.pendingRequests.get(message.id);
      if (!label) return;
      this.pendingRequests.delete(message.id);

      // Demand can move while a subscribe is in flight. If this label stopped
      // being wanted in the meantime, release it now rather than hold a
      // subscription nothing will ever unsubscribe.
      if (!this.wantedLabels().has(label)) {
        this.client.send({
          jsonrpc: '2.0',
          id: this.nextRequestId++,
          method: 'logsUnsubscribe',
          params: [message.result],
        });
        return;
      }

      this.subscriptions.set(message.result, label);
      this.subscriptionByLabel.set(label, message.result);
      return;
    }

    const failure = asErrorResponse(message);
    if (failure) {
      const label = this.pendingRequests.get(failure.id);
      if (label) {
        // Dropped from pending so the next reconcile retries it, instead of
        // treating a refused subscribe as one still on its way.
        this.pendingRequests.delete(failure.id);
        logger.warn('[helius] subscribe refused', { label, error: failure.error });
      }
      return;
    }

    if (isLogsNotification(message)) {
      const label = this.subscriptions.get(message.params.subscription);
      if (label && this.overBudget(label, raw.length)) return;
      this.handleLogsNotification(message);
    }
  }

  private isBarred(mint: string): boolean {
    const until = this.barredUntil.get(mint);
    if (until === undefined) return false;
    if (Date.now() < until) return true;
    this.barredUntil.delete(mint);
    return false;
  }

  /**
   * Meters one notification against its subscription's budget, and drops the
   * subscription the moment the budget for the window is spent.
   *
   * Returns true when the frame belongs to a subscription just dropped, so the
   * caller does not spend work decoding traffic it has decided not to pay for.
   */
  private overBudget(label: string, bytes: number): boolean {
    if (!label.startsWith(MINT_LABEL_PREFIX)) return false;

    const now = Date.now();
    let window = this.usage.get(label);
    if (!window || now - window.since > BUDGET_WINDOW_MS) {
      window = { bytes: 0, since: now };
      this.usage.set(label, window);
    }
    window.bytes += bytes;

    const budget = MINT_BUDGET_BYTES_PER_MIN * (BUDGET_WINDOW_MS / 60_000);
    if (window.bytes <= budget) return false;

    const mint = label.slice(MINT_LABEL_PREFIX.length);
    this.usage.delete(label);
    this.barredUntil.set(mint, now + OVER_BUDGET_BAR_MS);
    logger.warn('[helius] mint subscription over its data budget — dropped', {
      mint,
      bytesInWindow: window.bytes,
      windowMs: now - window.since,
      budgetMbPerMin: MINT_BUDGET_BYTES_PER_MIN / 1024 / 1024,
      barredForMs: OVER_BUDGET_BAR_MS,
    });
    this.reconcile();
    return true;
  }

  private handleLogsNotification(message: HeliusLogsNotification): void {
    const { subscription, result } = message.params;
    const label = this.subscriptions.get(subscription);
    if (!label) return;

    const { signature, logs, err } = result.value;
    if (err) return; // Only classify successful transactions.

    // A migration resolves its destination pool before the token is moved — a
    // completed curve alone is never reported as migrated. The same migration
    // can arrive twice (the authority watch, and the mint's own watch); the
    // worker collapses duplicate signatures.
    const lifecycleEvent = classifyLifecycleLogs(signature, logs);
    if (lifecycleEvent?.kind === 'MIGRATION') {
      void lifecycleWorker.onMigrationDetected(signature);
    }

    // The migration watch exists for lifecycle only.
    if (label === MIGRATIONS_LABEL) return;

    // A mint subscription's notifications can come from any venue, so there is
    // no program label to pick a matcher with.
    const match = matchLogsAnyProgram(logs);
    if (!match) return;

    // One id per signature, not per subscription: a swap between two watched
    // tokens arrives on both subscriptions and must still be one trade.
    const sourceLabel = 'scoped';

    const event = normalizeHeliusLogMatch(signature, sourceLabel, match);
    if (event) {
      this.onRawEvent(event);
      return;
    }

    // No mint in the log text — the normal case, since `logsNotification`
    // carries no instruction data. Rather than drop the match (which left
    // `realtime_trades` empty while the socket looked healthy), fetch the
    // parsed transaction and read the mint and amounts out of its token
    // balance deltas.
    //
    // Fire-and-forget: this callback is driven by the socket and must not wait
    // on an RPC round-trip. The enricher is queue-bounded and rate-limited, so
    // a burst of matches cannot become a burst of requests — it drops rather
    // than queues without limit, and reports what it dropped.
    void enrichSignature(signature)
      .then((trade) => {
        if (!trade) return;
        this.onRawEvent({
          eventId: `helius_${signature}_${sourceLabel}`,
          providerId: `helius_logs_${sourceLabel}`,
          mint: trade.mint,
          eventType: match.eventType,
          priceUsd: trade.priceUsd,
          volumeUsd: trade.volumeUsd,
          // Measured from which way the token crossed the transaction
          // boundary, not assumed.
          side: match.eventType === 'SWAP' ? (trade.isBuy ? 'BUY' : 'SELL') : undefined,
          signature,
          wallet: trade.wallet,
          tokenAmount: trade.tokenAmount,
          amountSol: trade.amountSol,
          timestamp: new Date().toISOString(),
        });
      })
      .catch((err) => {
        logger.debug('[helius] enrichment failed', {
          signature,
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }
}
