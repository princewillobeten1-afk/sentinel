import 'server-only';

import { isSolanaMint } from './chart-model';
import { acquireBitquerySlot } from './bitquery-limiter';
import { getTokenCardPatch, updateTokenCard, type TokenCardFields } from './live/card-cache';

const ENDPOINT = 'https://streaming.bitquery.io/graphql';
const REFRESH_MS = 30_000;
const BATCH_SIZE = 30;
const MAX_PENDING = 120;
const requestedAt = new Map<string, number>();
const pending = new Set<string>();
let draining = false;
let pausedUntil = 0;
let lastError: string | null = null;

type Activity = {
  mint: string;
  buys5: number; sells5: number; buys1: number; sells1: number;
  buys24: number; sells24: number;
  volume5: number; volume1: number; volume24: number;
  buyVolume5: number; sellVolume5: number;
};

function nonnegative(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function parseBitqueryActivity(body: unknown, requested: string[]): Activity[] | null {
  const data = body as { data?: { Solana?: { DEXTradeByTokens?: unknown } }; errors?: unknown[] };
  if (data?.errors?.length || !Array.isArray(data?.data?.Solana?.DEXTradeByTokens)) return null;
  const allowed = new Set(requested);
  const seen = new Set<string>();
  const parsed: Activity[] = [];
  for (const raw of data.data.Solana.DEXTradeByTokens) {
    const row = raw as Record<string, any>;
    const mint = row?.Trade?.Currency?.MintAddress;
    if (typeof mint !== 'string' || !allowed.has(mint) || seen.has(mint)) return null;
    const keys = ['buys5', 'sells5', 'buys1', 'sells1', 'buys24', 'sells24',
      'volume5', 'volume1', 'volume24', 'buyVolume5', 'sellVolume5'] as const;
    const values = keys.map(key => nonnegative(row[key]));
    if (values.some(value => value === null) || values.slice(0, 6).some(value => !Number.isSafeInteger(value))) return null;
    seen.add(mint);
    parsed.push({ mint, ...Object.fromEntries(keys.map((key, index) => [key, values[index]])) } as Activity);
  }
  // No row is not a measured zero: the index may not cover this token/pool.
  return parsed;
}

function queryFor(mints: string[], now: number): string {
  const t5 = JSON.stringify(new Date(now - 5 * 60_000).toISOString());
  const t1 = JSON.stringify(new Date(now - 60 * 60_000).toISOString());
  const t24 = JSON.stringify(new Date(now - 24 * 60 * 60_000).toISOString());
  const at = (time: string) => `Block: { Time: { after: ${time} } }`;
  const count = (side: 'buy' | 'sell', time?: string) =>
    `count(if: { Trade: { Side: { Type: { is: ${side} } } }${time ? `, ${at(time)}` : ''} })`;
  const sum = (time?: string, side?: 'buy' | 'sell') =>
    `sum(of: Trade_Side_AmountInUSD${time || side ? ` if: { ${side ? `Trade: { Side: { Type: { is: ${side} } } }` : ''}${side && time ? ', ' : ''}${time ? at(time) : ''} }` : ''})`;
  return `query SentinelVisibleActivity {
    Solana(dataset: realtime) {
      DEXTradeByTokens(
        where: { Trade: { Currency: { MintAddress: { in: ${JSON.stringify(mints)} } } },
          Block: { Time: { since: ${t24} } }, Transaction: { Result: { Success: true } } }
        limit: { count: ${mints.length} }
      ) {
        Trade { Currency { MintAddress } }
        buys5: ${count('buy', t5)} sells5: ${count('sell', t5)}
        buys1: ${count('buy', t1)} sells1: ${count('sell', t1)}
        buys24: ${count('buy')} sells24: ${count('sell')}
        volume5: ${sum(t5)} volume1: ${sum(t1)} volume24: ${sum()}
        buyVolume5: ${sum(t5, 'buy')} sellVolume5: ${sum(t5, 'sell')}
      }
    }
  }`;
}

function shouldFill(value: unknown, source: string | undefined): boolean {
  return value === undefined || value === null || value === ''
    || source === 'bitquery-dex-activity' || source === 'dexscreener-batch-rest';
}

function evidenceSource(primary: string | undefined): string {
  if (!primary) return 'bitquery-dex-activity';
  const sources = primary.split('+');
  return sources.includes('bitquery-dex-activity') ? primary : `${primary}+bitquery-dex-activity`;
}

export function applyBitqueryActivity(rows: Activity[], observedAt = new Date().toISOString()): void {
  for (const row of rows) {
    const patch = getTokenCardPatch(row.mint);
    const current = patch?.changedFields;
    const next: TokenCardFields = {};
    const activitySource = current?.activityEvidence?.source;
    const marketSource = current?.marketEvidence?.source;
    const put = <K extends keyof TokenCardFields>(key: K, value: TokenCardFields[K], groupSource: string | undefined) => {
      if (shouldFill(current?.[key], patch?.fieldSources?.[key] ?? groupSource)) (next as any)[key] = value;
    };
    put('volume5mUsd', String(row.volume5), activitySource);
    put('buyVolume5mUsd', row.buyVolume5, activitySource);
    put('sellVolume5mUsd', row.sellVolume5, activitySource);
    put('buysCount5m', row.buys5, activitySource);
    put('sellsCount5m', row.sells5, activitySource);
    put('txCount5m', row.buys5 + row.sells5, activitySource);
    put('volume1hUsd', String(row.volume1), marketSource);
    put('volume24hUsd', String(row.volume24), marketSource);
    put('buysCount1h', row.buys1, marketSource);
    put('sellsCount1h', row.sells1, marketSource);
    put('txCount1h', row.buys1 + row.sells1, marketSource);
    put('buysCount24h', row.buys24, marketSource);
    put('sellsCount24h', row.sells24, marketSource);
    put('txCount24h', row.buys24 + row.sells24, marketSource);
    if (Object.keys(next).some(key => key.endsWith('5mUsd') || key.endsWith('Count5m'))) {
      next.activityEvidence = { status: 'measured',
        source: evidenceSource(activitySource), observedAt,
        expiresAt: new Date(Date.parse(observedAt) + REFRESH_MS).toISOString() };
    }
    if (Object.keys(next).some(key => key.endsWith('1hUsd') || key.endsWith('24hUsd') || key.endsWith('Count1h') || key.endsWith('Count24h'))) {
      next.marketEvidence = { status: 'measured',
        source: evidenceSource(marketSource),
        observedAt, expiresAt: new Date(Date.parse(observedAt) + REFRESH_MS).toISOString() };
    }
    if (Object.keys(next).length) updateTokenCard(row.mint, next, 'bitquery-dex-activity', 'fresh', observedAt);
  }
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (pending.size && Date.now() >= pausedUntil) {
      const mints = [...pending].slice(0, BATCH_SIZE);
      mints.forEach(mint => pending.delete(mint));
      const token = process.env.BITQUERY_ACCESS_TOKEN?.trim();
      if (!token) break;
      try {
        await acquireBitquerySlot('activity', AbortSignal.timeout(5_000));
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query: queryFor(mints, Date.now()) }),
          signal: AbortSignal.timeout(10_000), cache: 'no-store',
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          const reason = /too many sessions|simultaneous queries/i.test(detail) ? 'session limit'
            : /points limit|usage quota|active billing period/i.test(detail) ? 'account quota'
              : /rate limit|too many requests/i.test(detail) ? 'request rate' : 'provider rejected request';
          lastError = `Bitquery activity HTTP ${response.status} (${reason})`;
          if ([401, 402, 403, 429].includes(response.status)) {
            const retry = Number(response.headers.get('retry-after'));
            pausedUntil = Date.now() + (response.status === 429 && Number.isFinite(retry) && retry > 0
              ? Math.min(retry * 1_000, 15 * 60_000) : 60_000);
          }
          continue;
        }
        const parsed = parseBitqueryActivity(await response.json(), mints);
        if (!parsed) { lastError = 'Bitquery returned malformed activity data.'; pausedUntil = Date.now() + 60_000; continue; }
        applyBitqueryActivity(parsed);
        lastError = null;
      } catch {
        lastError = 'Bitquery activity request failed or timed out.';
        pausedUntil = Date.now() + 30_000;
      }
    }
  } finally { draining = false; }
}

/** Complements Birdeye/DexScreener; requests only mints whose rolling activity is absent or already Bitquery-sourced. */
export function queueBitqueryActivity(mints: string[]): void {
  if (!process.env.BITQUERY_ACCESS_TOKEN?.trim() || Date.now() < pausedUntil) return;
  for (const mint of mints) {
    if (!isSolanaMint(mint) || pending.size >= MAX_PENDING) continue;
    const patch = getTokenCardPatch(mint);
    const current = patch?.changedFields;
    const due = (['volume5mUsd', 'buysCount5m', 'sellsCount5m', 'txCount5m',
      'volume1hUsd', 'buysCount1h', 'sellsCount1h', 'txCount1h',
      'volume24hUsd', 'buysCount24h', 'sellsCount24h', 'txCount24h'] as const).some(key =>
      shouldFill(current?.[key], patch?.fieldSources?.[key]
        ?? (key.endsWith('5m') || key.endsWith('5mUsd') ? current?.activityEvidence?.source : current?.marketEvidence?.source)));
    if (!due || Date.now() - (requestedAt.get(mint) ?? 0) < REFRESH_MS) continue;
    requestedAt.set(mint, Date.now());
    pending.add(mint);
  }
  if (pending.size && !draining) void drain();
}

export function bitqueryActivityHealth() {
  return { configured: Boolean(process.env.BITQUERY_ACCESS_TOKEN?.trim()), queued: pending.size,
    draining, pausedUntil, lastError };
}

export function resetBitqueryActivityForTests() {
  requestedAt.clear(); pending.clear(); draining = false; pausedUntil = 0; lastError = null;
}
