import 'server-only';

import path from 'path';
import { spawn } from 'child_process';
import { logger } from '@/lib/server/logger';

/**
 * Keeps the token catalog fresh without anyone running a script by hand.
 *
 * `realtime_tokens` is filled by two jobs — `db/discover-tokens.js` (Jupiter,
 * finds tokens) and `db/backfill-token-enrichment.js` (DexScreener, refreshes
 * their market data and promotes qualifying ones into the `tokens` registry).
 * Neither had a scheduler, so prices were only ever as current as the last
 * manual run: the Overview could sit on hours-old numbers while presenting
 * them as live.
 *
 * ## Why this shells out instead of importing
 *
 * Those two jobs are standalone CommonJS living outside Next's TypeScript
 * pipeline — the same reasoning as `db/migrate.js` — so they cannot be
 * `import`ed from here. They are also already proven against the live APIs.
 * Re-implementing ~800 lines of their fetch/normalise/promote logic in TS to
 * avoid a `spawn` would add a second copy to keep in step with the first, and
 * the copy would be the untested one.
 *
 * ## Why it starts from the bootstrap route
 *
 * `instrumentation.ts` is additionally bundled for an edge target (see its own
 * header), which cannot carry `pg` or `child_process`. `ws-bootstrap` is an
 * ordinary API route compiled for the Node target, and is already where
 * Node-only startup lives.
 */

function envInt(key: string, fallbackMs: number): number {
  const raw = process.env[key];
  if (!raw) return fallbackMs;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallbackMs;
}

/** Market data goes stale fastest, so it refreshes most often. */
const PRICE_INTERVAL_MS = envInt('TOKEN_REFRESH_PRICE_MS', 5 * 60_000);
/** Finding new tokens is slower-moving and costs more calls. */
const DISCOVERY_INTERVAL_MS = envInt('TOKEN_REFRESH_DISCOVERY_MS', 30 * 60_000);
/** A single run should never outlive its own interval. */
const RUN_TIMEOUT_MS = envInt('TOKEN_REFRESH_TIMEOUT_MS', 4 * 60_000);

export interface RefreshRunResult {
  script: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  /** Last line of output, which is where these scripts put their summary. */
  summary: string;
}

/**
 * Runs one of the db scripts to completion.
 *
 * Output is captured rather than inherited so it lands in the app's logger
 * alongside everything else, instead of vanishing into a detached stdio.
 */
export function runScript(script: string, args: string[]): Promise<RefreshRunResult> {
  const startedAt = Date.now();
  const scriptPath = path.join(process.cwd(), 'db', script);

  return new Promise<RefreshRunResult>((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
    });

    const lines: string[] = [];
    let timedOut = false;

    const capture = (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        const trimmed = line.trim();
        if (trimmed) lines.push(trimmed);
      }
      // Keep only the tail — these scripts are chatty per batch and the
      // summary is what matters.
      if (lines.length > 40) lines.splice(0, lines.length - 40);
    };

    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, RUN_TIMEOUT_MS);

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      resolve({
        script,
        exitCode,
        durationMs: Date.now() - startedAt,
        timedOut,
        summary: lines.slice(-3).join(' | ') || '(no output)',
      });
    };

    child.on('error', (err) => {
      lines.push(`spawn failed: ${err.message}`);
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}

class TokenRefreshWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  /**
   * Run lock. A DexScreener refresh over the whole catalog can outlast the
   * tick interval; without this, ticks would stack up and run the same job
   * against itself.
   */
  private running = false;
  private lastDiscoveryAt = 0;

  start(): void {
    if (this.timer) return;

    if (process.env.TOKEN_REFRESH_ENABLED !== 'true') {
      logger.info(
        '[token-refresh] disabled — set TOKEN_REFRESH_ENABLED=true to refresh token data on a schedule.',
      );
      return;
    }

    this.timer = setInterval(() => void this.tick(), PRICE_INTERVAL_MS);
    logger.info('[token-refresh] worker started', {
      priceIntervalMs: PRICE_INTERVAL_MS,
      discoveryIntervalMs: DISCOVERY_INTERVAL_MS,
    });

    // Don't make the first refresh wait a whole interval.
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  isRunning(): boolean {
    return this.running;
  }

  async tick(): Promise<void> {
    if (this.running) {
      logger.debug('[token-refresh] previous run still in progress — skipping tick');
      return;
    }
    this.running = true;

    try {
      const now = Date.now();
      if (now - this.lastDiscoveryAt >= DISCOVERY_INTERVAL_MS) {
        this.lastDiscoveryAt = now;
        const discovery = await runScript('discover-tokens.js', ['--limit', '100']);
        this.report(discovery);
      }

      const refresh = await runScript('backfill-token-enrichment.js', [
        '--refresh',
        '--stale-minutes',
        String(Math.max(1, Math.floor(PRICE_INTERVAL_MS / 60_000))),
        '--source',
        'dexscreener',
      ]);
      this.report(refresh);

      // A refresh whose batches hit transient network errors marks those rows
      // `enrichment_status='ERROR'`, and `db-trending.ts` only reads rows that
      // are 'OK' — so a blip silently shrinks the trending pool (this happened
      // once already, 150 tokens down to 90). A plain enrich pass picks the
      // failed rows back up.
      if (/failed [1-9]/.test(refresh.summary)) {
        logger.warn('[token-refresh] refresh reported failures — re-enriching affected rows');
        this.report(await runScript('backfill-token-enrichment.js', ['--source', 'dexscreener']));
      }
    } catch (err) {
      logger.error('[token-refresh] tick failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      // Always released: a stuck lock would silently stop every future tick.
      this.running = false;
    }
  }

  private report(result: RefreshRunResult): void {
    const meta = {
      script: result.script,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      summary: result.summary,
    };
    // A bad run is logged and the loop continues — one failure must not end
    // the schedule.
    if (result.timedOut) logger.warn('[token-refresh] run timed out', meta);
    else if (result.exitCode !== 0) logger.warn('[token-refresh] run exited non-zero', meta);
    else logger.info('[token-refresh] run complete', meta);
  }
}

const globalForRefresh = globalThis as unknown as { tokenRefreshWorker?: TokenRefreshWorker };
export const tokenRefreshWorker = globalForRefresh.tokenRefreshWorker ?? new TokenRefreshWorker();
if (process.env.NODE_ENV !== 'production') globalForRefresh.tokenRefreshWorker = tokenRefreshWorker;
