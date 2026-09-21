import 'server-only';

/**
 * The ownership audit behind the feed card's risk pills.
 *
 * ## What this replaces
 *
 * Top 10 %, Snipers %, Insiders % and Bundlers % were hardcoded constants —
 * `?? 22`, `?? 4`, `?? 2`, `?? 0` — rendered on every token, and every one of
 * them fell inside the card's own "safe" thresholds, so the entire feed
 * advertised a clean audit that nothing had performed. Pro Traders and KOLs
 * were `holdersCount * 0.12` and `* 0.04`, which is the holder count twice
 * under two labels.
 *
 * ## Why one endpoint
 *
 * Birdeye's `/token/v1/holder-profile` answers all of it in a single call:
 * `token.top10_holder.percent_of_supply`, `holder_summary.total_holder`, and a
 * `tags` array carrying `sniper`, `insider`, `bundler`, `dev`, `smart_trader`
 * and `kol` — each with `holder_count` and `percent_of_supply`.
 *
 * The alternatives were tested and are not available on this key:
 * `/token/v1/first-buyers`, `/token/v1/wallet-tags-tracker` and
 * `/holder/v1/distribution` all return 401 "lacks sufficient permissions".
 * Computing snipers and bundlers ourselves would mean walking every
 * signature from the launch block via `getSignaturesForAddress` — affordable
 * for one token on demand, not for a 50-row feed refreshing every 4 seconds.
 *
 * Note the parameter is `token_address`, not `address` — `address` returns
 * 400, which is what the repo's older wrappers were sending.
 *
 * ## Honesty rules
 *
 * A tag that is absent from the response means Birdeye reported no wallets in
 * that class, which is a real zero. A *failed request* means we do not know,
 * and returns null so the card renders "not measured" rather than a reassuring
 * 0%. Those two must never collapse into the same value.
 */

import { acquireBirdeyeSlot } from './birdeye-limiter';

export const BIRDEYE_BASE = 'https://public-api.birdeye.so';

export interface HolderTagStat {
  tag: string;
  holderCount: number | null;
  percentOfSupply: number | null;
}

export interface HolderProfile {
  mint: string;
  /** Combined share of the ten largest holders, 0-100. */
  top10Pct: number | null;
  /** Real total holder count — not the top-20 cap an RPC scan is limited to. */
  totalHolders: number | null;
  snipersPct: number | null;
  insidersPct: number | null;
  bundlersPct: number | null;
  devPct: number | null;
  proTraders: number | null;
  kols: number | null;
  fetchedAt: number;
}

function num(value: unknown): number | null {
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Reduces the raw payload to the fields the card renders.
 *
 * Exported for tests: the shape is nested and the numeric fields arrive as a
 * mix of strings and numbers, so the parsing is worth pinning independently of
 * the network.
 */
export function parseHolderProfile(mint: string, body: unknown): HolderProfile | null {
  if ((body as { success?: unknown })?.success === false) return null;
  const data = (body as { data?: Record<string, unknown> })?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const token = data.token as { top10_holder?: { percent_of_supply?: unknown } } | undefined;
  const summary = data.holder_summary as { total_holder?: unknown } | undefined;
  const hasTags = Array.isArray(data.tags);
  const rawTags = hasTags ? data.tags as unknown[] : [];
  const percent = (value: unknown): number | null => {
    const parsed = num(value);
    return parsed !== null && parsed <= 100 ? parsed : null;
  };
  const integer = (value: unknown): number | null => {
    const parsed = num(value);
    return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
  };

  const byTag = new Map<string, HolderTagStat>();
  let tagsValid = hasTags;
  for (const raw of rawTags) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { tagsValid = false; continue; }
    const entry = raw as Record<string, unknown>;
    const tag = typeof entry.tag === 'string' ? entry.tag : null;
    if (!tag || byTag.has(tag)) { tagsValid = false; continue; }
    byTag.set(tag, {
      tag,
      holderCount: integer(entry.holder_count),
      percentOfSupply: percent(entry.percent_of_supply),
    });
  }

  // An absent tag is a real zero: Birdeye returns the class only when it found
  // wallets in it. A failed request never reaches here — it returns null above.
  // Omission is meaningful only in a valid tags collection. A missing or
  // malformed collection (or a present tag with a missing field) is unknown.
  const pct = (tag: string): number | null => !tagsValid ? null : byTag.has(tag) ? byTag.get(tag)!.percentOfSupply : 0;
  const count = (tag: string): number | null => !tagsValid ? null : byTag.has(tag) ? byTag.get(tag)!.holderCount : 0;

  return {
    mint,
    top10Pct: percent(token?.top10_holder?.percent_of_supply),
    totalHolders: integer(summary?.total_holder),
    snipersPct: pct('sniper'),
    insidersPct: pct('insider'),
    bundlersPct: pct('bundler'),
    devPct: pct('dev'),
    proTraders: count('smart_trader'),
    kols: count('kol'),
    fetchedAt: Date.now(),
  };
}

function apiKey(): string | null {
  const key = process.env.BIRDEYE_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

/**
 * The outcome of one lookup.
 *
 * `rate-limited` is separated from `failed` because the correct response
 * differs: a 429 means slow down and retry, while a 401 or a parse failure
 * means this call will keep failing at any speed. Collapsing them into null
 * had the worker burn its whole queue against a limit it could have waited out
 * — observed as 11 of 15 tokens silently unresolved.
 */
export type HolderProfileResult =
  | { kind: 'ok'; profile: HolderProfile }
  | { kind: 'rate-limited'; retryAfterMs?: number }
  /**
   * The account's compute-unit budget is spent. Every subsequent call fails
   * the same way until the quota resets or is topped up.
   *
   * Distinct from both other outcomes because the right response is different
   * again: slowing down does not help, and neither does moving to the next
   * mint. Birdeye reports this as **HTTP 400** with
   * `"Compute units usage limit exceeded"` — not 402 or 429 — so without
   * inspecting the body it is indistinguishable from a malformed request, and
   * the worker will grind through its whole queue re-failing on every token.
   */
  | { kind: 'quota-exhausted' }
  | { kind: 'failed'; status?: number };

/** Birdeye's wording when the compute-unit budget is gone. */
function isQuotaExhausted(body: string): boolean {
  return /compute\s*units?\s*usage\s*limit\s*exceeded/i.test(body);
}

/**
 * Fetches one token's ownership audit.
 *
 * Never throws. A non-`ok` result means "unknown" and the caller must render it
 * as such — it must never be cached as a clean 0%.
 */
export async function fetchHolderProfileResult(
  mint: string,
  chain = 'solana',
  timeoutMs = 10_000,
): Promise<HolderProfileResult> {
  const key = apiKey();
  if (!key || !mint) return { kind: 'failed' };

  // Every Birdeye call in the process shares one gate — see birdeye-limiter.
  // Pacing this worker alone was not enough: the market-enrichment worker runs
  // off the event stream at 250ms and saturated the key regardless.
  await acquireBirdeyeSlot('audit');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${BIRDEYE_BASE}/token/v1/holder-profile?token_address=${encodeURIComponent(mint)}`,
      {
        headers: { 'X-API-KEY': key, 'x-chain': chain, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      },
    );

    if (res.status === 429) {
      const header = res.headers.get('retry-after');
      const seconds = header?.trim() ? Number(header) : NaN;
      const retryAfterMs = Number.isFinite(seconds) ? Math.max(0, seconds * 1_000)
        : header ? Math.max(0, Date.parse(header) - Date.now()) : NaN;
      return { kind: 'rate-limited', retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined };
    }

    // The body has to be read to tell quota exhaustion apart from a genuine
    // bad request — both arrive as 400.
    const text = await res.text();
    if (isQuotaExhausted(text)) return { kind: 'quota-exhausted' };
    if (!res.ok) return { kind: 'failed', status: res.status };

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { kind: 'failed', status: res.status };
    }

    const profile = parseHolderProfile(mint, body);
    return profile ? { kind: 'ok', profile } : { kind: 'failed', status: res.status };
  } catch {
    return { kind: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience wrapper for callers that only care whether it worked. */
export async function fetchHolderProfile(
  mint: string,
  chain = 'solana',
  timeoutMs = 10_000,
): Promise<HolderProfile | null> {
  const result = await fetchHolderProfileResult(mint, chain, timeoutMs);
  return result.kind === 'ok' ? result.profile : null;
}
