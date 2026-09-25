import 'server-only';

import WebSocket from 'ws';
import { getGeckoPool, type GeckoPool } from '@/lib/market/geckoterminal-chart';
import { isSolanaMint } from '@/lib/market/chart-model';
import { getTokenPriceUsd, SOL_MINT } from '@/lib/market/canonical-price';
import { quickNodeService } from '@/lib/server/quicknode';
import { logger } from '@/lib/server/logger';
import { STABLE_MINTS, WSOL_MINT } from './trade-derivation';
import { publishQuickNodeTrade, type ChartDemand } from './chart-stream';
import { isChartSwapLog, parseQuickNodeChartTrade } from './quicknode-chart-trade';

interface Target { mint: string; pool: GeckoPool }
const MAX_CHART_MINTS = 4;
const RECONCILE_MS = 30_000;
const RETRY_MS = 5_000;
const MAX_PENDING_TRADES = 8;
const TX_FETCH_GAP_MS = 500;
function byteBudget(name: string, fallbackMb: number, minimum: number): number {
  const parsed = Number(process.env[name]);
  return Math.max(minimum, (Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMb) * 1024 * 1024);
}
const MAX_BYTES_PER_MIN = byteBudget('QUICKNODE_CHART_MAX_MB_PER_MIN', 2, 100_000);
const MAX_BYTES_PER_DAY = byteBudget('QUICKNODE_CHART_DAILY_MB', 50, 1_000_000);

/** A separate, tightly budgeted transaction stream for visible charts. It
 * never sends transactions and does not replace the Helius lifecycle stream. */
export class QuickNodeChartClient {
  private active = false;
  private ws: WebSocket | null = null;
  private desiredMints: string[] = [];
  private targets = new Map<string, Target>();
  private subscriptions = new Map<string, number>();
  private subscribedIds = new Map<number, string>();
  private pending = new Map<number, string>();
  private nextId = 1;
  private generation = 0;
  private reconcileTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private seen = new Map<string, number>();
  private tradeQueue: Array<{ target: Target; pool: string; signature: string; slot: number; observedAt: number }> = [];
  private draining = false;
  private lastFetchAt = 0;
  private minuteStarted = Date.now();
  private minuteBytes = 0;
  private day = new Date().toISOString().slice(0, 10);
  private dayBytes = 0;
  private pausedUntil = 0;
  private lastTradeAt: string | null = null;
  private lastError: string | null = null;
  private acceptedTrades = 0;
  private skippedTrades = 0;
  private skippedByReason = { transactionUnavailable: 0, mintAbsent: 0, quoteUnavailable: 0,
    unpricedFill: 0, duplicateOrOld: 0 };

  start(): void {
    if (this.active) return;
    this.active = true;
    this.reconcileTimer = setInterval(() => { void this.refreshTargets(); }, RECONCILE_MS);
    this.reconcileTimer.unref?.();
    void this.refreshTargets();
  }

  stop(): void {
    this.active = false;
    this.generation += 1;
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.reconcileTimer = this.reconnectTimer = this.heartbeatTimer = null;
    this.ws?.removeAllListeners();
    this.ws?.close();
    this.ws = null;
    this.targets.clear(); this.subscriptions.clear(); this.subscribedIds.clear(); this.pending.clear();
    this.tradeQueue = [];
  }

  setTargets(demand: ChartDemand[]): void {
    const mints = [...new Set(demand.map(item => item.mint).filter(isSolanaMint))].slice(0, MAX_CHART_MINTS);
    if (mints.join(',') === this.desiredMints.join(',')) return;
    this.desiredMints = mints;
    void this.refreshTargets();
  }

  getHealth() {
    return { active: this.active, connected: this.ws?.readyState === WebSocket.OPEN,
      targetCount: this.targets.size, subscriptionCount: this.subscriptions.size,
      lastTradeAt: this.lastTradeAt, lastError: this.lastError,
      pausedUntil: this.pausedUntil > Date.now() ? new Date(this.pausedUntil).toISOString() : null,
      acceptedTrades: this.acceptedTrades, skippedTrades: this.skippedTrades,
      skippedByReason: { ...this.skippedByReason },
      pendingTrades: this.tradeQueue.length,
      bytesToday: this.dayBytes, dailyByteLimit: MAX_BYTES_PER_DAY };
  }

  private async refreshTargets(): Promise<void> {
    if (!this.active) return;
    const generation = ++this.generation;
    const mints = [...this.desiredMints];
    if (!mints.length) {
      this.targets.clear();
      this.closeIdle();
      return;
    }
    const resolved = await Promise.all(mints.map(async mint => {
      const pool = await getGeckoPool(mint);
      return pool && (pool.quoteMint === WSOL_MINT || STABLE_MINTS.has(pool.quoteMint))
        ? { mint, pool } : null;
    }));
    if (!this.active || generation !== this.generation) return;
    this.targets = new Map(resolved.filter((item): item is Target => item !== null).map(item => [item.pool.address, item]));
    if (!this.targets.size) { this.closeIdle(); return; }
    if (Date.now() < this.pausedUntil) return;
    if (this.ws?.readyState === WebSocket.OPEN) { this.reconcileSubscriptions(); return; }
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) void this.connect();
  }

  private async connect(): Promise<void> {
    if (!this.active || !this.targets.size || Date.now() < this.pausedUntil || this.ws) return;
    const endpoint = await quickNodeService.websocketEndpoint();
    if (!this.active || !this.targets.size || this.ws) return;
    if (!endpoint) { this.lastError = 'QuickNode mainnet WebSocket is unavailable or unverified.'; return; }
    const ws = new WebSocket(endpoint);
    this.ws = ws;
    let lastPong = Date.now();
    ws.on('open', () => {
      if (this.ws !== ws) return;
      this.lastError = null;
      this.heartbeatTimer = setInterval(() => {
        if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - lastPong > 60_000) { ws.terminate(); return; }
        ws.ping();
      }, 30_000);
      this.heartbeatTimer.unref?.();
      this.reconcileSubscriptions();
    });
    ws.on('pong', () => { lastPong = Date.now(); });
    ws.on('message', raw => {
      if (this.ws !== ws) return;
      const body = raw.toString();
      void this.handleMessage(body, Buffer.byteLength(body));
    });
    ws.on('error', error => {
      if (this.ws === ws) this.lastError = error.message;
    });
    ws.on('close', () => {
      if (this.ws !== ws) return;
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.ws = null;
      this.subscriptions.clear(); this.subscribedIds.clear(); this.pending.clear();
      if (this.active && this.targets.size && !this.reconnectTimer) {
        const delay = Math.max(RETRY_MS, this.pausedUntil - Date.now());
        this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; void this.connect(); }, delay);
        this.reconnectTimer.unref?.();
      }
    });
  }

  private reconcileSubscriptions(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    for (const [pool, id] of this.subscriptions) {
      if (this.targets.has(pool)) continue;
      this.send('logsUnsubscribe', [id]);
      this.subscriptions.delete(pool); this.subscribedIds.delete(id);
    }
    for (const [pool] of this.targets) {
      if (this.subscriptions.has(pool) || [...this.pending.values()].includes(pool)) continue;
      // Log envelopes are far smaller than full transaction notifications.
      // Fetch parsed balances only after a likely swap instruction appears.
      const id = this.send('logsSubscribe', [{ mentions: [pool] }, { commitment: 'confirmed' }]);
      if (id !== null) this.pending.set(id, pool);
    }
  }

  private send(method: string, params: unknown[]): number | null {
    if (this.ws?.readyState !== WebSocket.OPEN) return null;
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    return id;
  }

  private async handleMessage(raw: string, bytes: number): Promise<void> {
    const now = Date.now();
    if (now < this.pausedUntil) return;
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== this.day) { this.day = day; this.dayBytes = 0; }
    if (now - this.minuteStarted >= 60_000) { this.minuteStarted = now; this.minuteBytes = 0; }
    this.minuteBytes += bytes; this.dayBytes += bytes;
    if (this.minuteBytes > MAX_BYTES_PER_MIN || this.dayBytes > MAX_BYTES_PER_DAY) {
      this.lastError = 'QuickNode chart data budget reached; using REST reconciliation.';
      this.pausedUntil = this.dayBytes > MAX_BYTES_PER_DAY
        ? Date.parse(`${this.day}T00:00:00.000Z`) + 86_400_000 : now + 15 * 60_000;
      logger.warn('[quicknode-chart] budget paused', { bytesToday: this.dayBytes, minuteBytes: this.minuteBytes });
      this.ws?.close();
      return;
    }
    let message: any;
    try { message = JSON.parse(raw); } catch { return; }
    if (typeof message.id === 'number' && this.pending.has(message.id)) {
      const pool = this.pending.get(message.id)!;
      this.pending.delete(message.id);
      if (typeof message.result === 'number' && this.targets.has(pool)) {
        this.subscriptions.set(pool, message.result);
        this.subscribedIds.set(message.result, pool);
      } else {
        this.lastError = typeof message.error?.message === 'string'
          ? `QuickNode rejected chart subscription: ${message.error.message.slice(0, 120)}`
          : 'QuickNode rejected chart subscription.';
      }
      return;
    }
    if (message.method !== 'logsNotification') return;
    const pool = this.subscribedIds.get(message.params?.subscription);
    const target = pool ? this.targets.get(pool) : null;
    if (!target) return;
    const value = message.params?.result?.value;
    const signature = value?.signature;
    const slot = message.params?.result?.context?.slot;
    if (value?.err || typeof signature !== 'string' || !Number.isInteger(slot) || slot <= 0
      || !isChartSwapLog(value?.logs)) return;
    const identity = `${pool}:${signature}`;
    if (this.seen.has(identity)) return;
    this.seen.set(identity, now);
    if (this.seen.size > 2_000) {
      for (const [key, at] of this.seen) if (now - at > 120_000) this.seen.delete(key);
      if (this.seen.size > 2_000) this.seen.delete(this.seen.keys().next().value!);
    }
    // Prioritize the newest price when an extremely active pool exceeds the
    // bounded RPC read rate. REST OHLCV reconciles the omitted intrabar range.
    if (this.tradeQueue.length >= MAX_PENDING_TRADES) {
      this.tradeQueue.shift(); this.skippedTrades += 1;
    }
    this.tradeQueue.push({ target, pool: pool!, signature, slot, observedAt: now });
    void this.drainTrades();
  }

  private async drainTrades(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.active && this.tradeQueue.length) {
        const item = this.tradeQueue.shift()!;
        if (this.targets.get(item.pool) !== item.target) continue;
        const wait = TX_FETCH_GAP_MS - (Date.now() - this.lastFetchAt);
        if (wait > 0) await new Promise<void>(resolve => setTimeout(resolve, wait));
        if (!this.active || this.targets.get(item.pool) !== item.target) continue;
        this.lastFetchAt = Date.now();
        let transaction: any;
        try { transaction = await quickNodeService.chartTransaction(item.signature); }
        catch (error) {
          this.lastError = error instanceof Error ? error.message : 'QuickNode chart RPC is unavailable.';
          this.pausedUntil = Date.now() + 60_000;
          this.tradeQueue = [];
          this.ws?.close();
          break;
        }
        if (!transaction?.meta || !transaction?.transaction) {
          this.skippedTrades += 1; this.skippedByReason.transactionUnavailable += 1; continue;
        }
        const pre = Array.isArray(transaction.meta.preTokenBalances) ? transaction.meta.preTokenBalances : [];
        const post = Array.isArray(transaction.meta.postTokenBalances) ? transaction.meta.postTokenBalances : [];
        if (![...pre, ...post].some((entry: { mint?: string }) => entry?.mint === item.target.mint)) {
          this.skippedTrades += 1; this.skippedByReason.mintAbsent += 1; continue;
        }
        let solPrice: number | null = null;
        if (item.target.pool.quoteMint === WSOL_MINT) {
          const measured = await getTokenPriceUsd(SOL_MINT);
          if (measured && measured.ageMs <= 120_000) solPrice = measured.usdPrice;
          if (solPrice === null) {
            this.skippedTrades += 1; this.skippedByReason.quoteUnavailable += 1; continue;
          }
        }
        if (this.targets.get(item.pool) !== item.target) continue;
        const envelope = { params: { result: { value: { signature: item.signature,
          slot: transaction.slot ?? item.slot, transaction: { transaction: transaction.transaction, meta: transaction.meta } } } } };
        const trade = parseQuickNodeChartTrade(envelope, item.target.mint, item.pool,
          item.target.pool.quoteMint, solPrice, item.observedAt);
        if (!trade) { this.skippedTrades += 1; this.skippedByReason.unpricedFill += 1; continue; }
        if (publishQuickNodeTrade(trade.mint, trade.poolAddress, trade.priceUsd, trade.observedAt)) {
          this.lastTradeAt = new Date(item.observedAt).toISOString();
          this.acceptedTrades += 1;
        } else {
          this.skippedTrades += 1; this.skippedByReason.duplicateOrOld += 1;
        }
      }
    } finally { this.draining = false; }
  }

  private closeIdle(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws?.readyState === WebSocket.CONNECTING) this.ws.terminate();
    else this.ws?.close();
  }
}
