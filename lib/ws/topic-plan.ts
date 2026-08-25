/**
 * Chooses which WebSocket topics a view subscribes to, within its budget.
 *
 * Subscriptions are per token, not global — there is no firehose topic — and a
 * cookie-authenticated browser session is capped at
 * `SESSION_WS_SUBSCRIPTION_CAP` (30) topics per connection in `ws/server.ts`.
 * The Overview can show 20 trending tokens, and wanting both a price and a
 * trade stream for each would ask for 40. Past the cap the server answers
 * `SUBSCRIPTION_LIMIT` and simply drops the rest, so without planning the
 * tokens that lost the race would sit there looking live and never update.
 *
 * The allocation is deliberate rather than incidental:
 *
 *  - **Price first, for every token.** A visibly stale price is the worst
 *    failure on this screen, so every rendered card gets one before any token
 *    gets a second topic.
 *  - **Trade streams with whatever budget remains**, in display order, so the
 *    tokens nearest the top of the list drive the activity ticker.
 *
 * Pure and order-deterministic, so the caller can compare plans between
 * renders and only send the difference.
 */

export type TokenTopicKind = 'token.price' | 'token.trade';

export interface TopicPlan {
  /** Topics to subscribe to, in priority order. */
  topics: string[];
  /** Mints that got a price stream. */
  pricedMints: string[];
  /** Mints that also got a trade stream. */
  tradedMints: string[];
  /** Mints dropped entirely because the budget ran out. */
  droppedMints: string[];
}

export const SESSION_TOPIC_BUDGET = 30;

/**
 * Reserved headroom under the cap.
 *
 * Leaving a slot or two free means an extra subscription elsewhere in the app
 * (a detail panel opening over the list, say) does not push this view over the
 * limit and silently cost it a price stream.
 */
const HEADROOM = 2;

export function planTokenTopics(
  mints: string[],
  options: { budget?: number; tradeStreams?: number } = {},
): TopicPlan {
  const budget = Math.max(0, (options.budget ?? SESSION_TOPIC_BUDGET) - HEADROOM);
  const wantedTradeStreams = Math.max(0, options.tradeStreams ?? 6);

  // De-duplicate while preserving display order: the same mint can legitimately
  // appear in two lists (trending and top), and subscribing twice would burn a
  // slot for nothing.
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const mint of mints) {
    if (!mint || seen.has(mint)) continue;
    seen.add(mint);
    unique.push(mint);
  }

  const pricedMints = unique.slice(0, budget);
  const droppedMints = unique.slice(budget);

  const remaining = budget - pricedMints.length;
  const tradedMints = pricedMints.slice(0, Math.min(wantedTradeStreams, remaining));

  return {
    topics: [
      ...pricedMints.map((m) => `token.price:${m}`),
      ...tradedMints.map((m) => `token.trade:${m}`),
    ],
    pricedMints,
    tradedMints,
    droppedMints,
  };
}

/** Topics in `next` that `current` does not already hold. */
export function topicsToAdd(current: Set<string>, next: string[]): string[] {
  return next.filter((topic) => !current.has(topic));
}

/** Topics held in `current` that `next` no longer wants. */
export function topicsToRemove(current: Set<string>, next: string[]): string[] {
  const wanted = new Set(next);
  return [...current].filter((topic) => !wanted.has(topic));
}

/** Splits `token.price:<mint>` into its parts; null when it isn't a token topic. */
export function parseTokenTopic(topic: string): { kind: TokenTopicKind; mint: string } | null {
  const separator = topic.indexOf(':');
  if (separator === -1) return null;
  const kind = topic.slice(0, separator);
  const mint = topic.slice(separator + 1);
  if (!mint) return null;
  if (kind !== 'token.price' && kind !== 'token.trade') return null;
  return { kind, mint };
}
