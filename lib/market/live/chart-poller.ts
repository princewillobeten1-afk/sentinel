import 'server-only';

import { getChartHistory } from '@/lib/market/chart-history';
import { isSolanaMint, isChartTimeframe } from '@/lib/market/chart-model';
import { env } from '@/lib/server/env';
import { logger } from '@/lib/server/logger';
import { publishPolledCandle, type ChartDemand } from './chart-stream';

// One shared, bounded fallback for all viewers. The global Birdeye REST gate
// still controls the actual request rate alongside ownership and enrichment.
const POLL_INTERVAL_MS = 15_000;
const MAX_PER_TICK = 2;

export class ChartPoller {
  private targets: ChartDemand[] = [];
  private cursor = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private busy = false;
  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;
  private published = 0;

  start(): void {
    if (this.active) return;
    this.active = true;
    this.timer = setInterval(() => { void this.tick(); }, POLL_INTERVAL_MS);
    this.timer.unref?.();
    if (this.targets.length) void this.tick();
  }

  stop(): void {
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.targets = [];
    this.cursor = 0;
  }

  setTargets(targets: ChartDemand[]): void {
    const next = [...new Map(targets.filter(target => isSolanaMint(target.mint) && isChartTimeframe(target.timeframe))
      .map(target => [`${target.mint}:${target.timeframe}`, target])).values()].slice(0, 100);
    if (JSON.stringify(next) === JSON.stringify(this.targets)) return;
    this.targets = next;
    this.cursor = 0;
    if (this.active && !this.busy && this.targets.length) void this.tick();
  }

  getHealth() {
    return { active: this.active && Boolean(env.BIRDEYE_API_KEY), targetCount: this.targets.length,
      intervalMs: POLL_INTERVAL_MS, maxPerTick: MAX_PER_TICK, lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError, published: this.published };
  }

  async tick(): Promise<void> {
    if (!this.active || this.busy || !env.BIRDEYE_API_KEY || !this.targets.length) return;
    this.busy = true;
    const count = Math.min(MAX_PER_TICK, this.targets.length);
    const selected = Array.from({ length: count }, () => {
      const target = this.targets[this.cursor % this.targets.length];
      this.cursor += 1;
      return target;
    });
    try {
      for (const target of selected) {
        if (!this.active || !this.targets.some(item => item.mint === target.mint && item.timeframe === target.timeframe)) continue;
        try {
          const snapshot = await getChartHistory(target.mint, target.timeframe, 2);
          if (!this.active) break;
          if (snapshot.status !== 'measured') { this.lastError = snapshot.reason || 'Candle provider is delayed.'; continue; }
          this.lastSuccessAt = new Date(snapshot.observedAt).toISOString();
          this.lastError = null;
          if (publishPolledCandle(snapshot)) this.published += 1;
        } catch (cause) {
          this.lastError = cause instanceof Error ? cause.message : 'Candle poll failed.';
          logger.warn('[chart-poller] provider request failed', { reason: this.lastError });
        }
      }
    } finally { this.busy = false; }
  }
}
