'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  planTokenTopics,
  parseTokenTopic,
  topicsToAdd,
  topicsToRemove,
} from '@/lib/ws/topic-plan';
import type { MetricEvidence, RugRiskEvidence } from '@/lib/discovery/types';

/**
 * Live price and trade updates for a set of tokens, over the app WebSocket.
 *
 * The Overview reads its tokens over REST and re-fetches on an interval, so a
 * price could sit unchanged on screen for a full cycle while trades for that
 * token were already flowing through the pipeline. This subscribes to the
 * per-token topics the broadcaster publishes (`ws/broadcaster.ts`) and merges
 * them over the REST snapshot, so a card updates the moment its token trades.
 *
 * ## Deliberate behaviours
 *
 * **It degrades to silence, not to noise.** The upgrade requires a session
 * cookie or API key and a matching Origin (`ws/server.ts#authenticateUpgrade`),
 * so a signed-out visitor cannot connect at all. That is a normal state, not an
 * error: after a few refused attempts the hook stops retrying and reports
 * `unavailable`, and the view keeps showing REST data. Retrying forever would
 * reconnect-loop on every logged-out page load.
 *
 * **It never invents a value.** An update carries only the fields the server
 * actually sent; a token with no live message keeps its REST value rather than
 * being zeroed or blanked.
 *
 * **It subscribes to a plan, not to everything.** See `ws/topic-plan.ts` — a
 * browser session is capped at 30 topics, and 20 tokens wanting price and trade
 * would ask for 40. Past the cap the server drops the excess and those cards
 * would look live while never updating.
 */

export interface LiveTokenUpdate extends Pick<import('@/lib/trading/sidebar-model').TradeSidebarSnapshot, 'activityEvidence' | 'funding' | 'fundingEvidence' | 'devBalanceSol' | 'devBalanceEvidence' | 'imageReuse' | 'liquidityEvidence'> {
  volume5mUsd?: string;
  buyVolume5mUsd?: number | null;
  sellVolume5mUsd?: number | null;
  buysCount5m?: number;
  sellsCount5m?: number;
  txCount5m?: number;
  fieldObservedAt?: import('@/lib/market/live/card-cache').TokenCardPatch['fieldObservedAt'];
  mint: string;
  priceUsd?: number;
  priceChange24h?: number;
  /** Side of the most recent trade seen on this token. */
  lastTradeSide?: 'BUY' | 'SELL';
  /** Client receipt time for a newly streamed trade; omitted on replay. */
  lastTradeUpdatedAt?: number;
  lastTradeAmountUsd?: number;
  marketCapUsd?: string;
  liquidityUsd?: string;
  volume1hUsd?: string;
  volume24hUsd?: string;
  priceChange5m?: number;
  priceChange1h?: number;
  txCount1h?: number;
  txCount24h?: number;
  buysCount?: number;
  sellsCount?: number;
  buysCount1h?: number;
  sellsCount1h?: number;
  buysCount24h?: number;
  sellsCount24h?: number;
  holdersCount?: number;
  top10HoldingsPct?: number;
  devHoldingsPct?: number;
  sniperPercentage?: number;
  insiderHoldingsPct?: number;
  bundlerPercentage?: number;
  proTradersCount?: number;
  kolsCount?: number;
  devAddress?: string;
  devWalletAge?: string;
  devMints?: number;
  devMigrations?: number;
  isMintRenounced?: boolean;
  isFreezeDisabled?: boolean;
  isLiquidityLocked?: boolean;
  lpLockedPct?: number | null;
  rugRisk?: RugRiskEvidence;
  marketEvidence?: MetricEvidence;
  ownershipEvidence?: MetricEvidence;
  securityEvidence?: MetricEvidence;
  creatorEvidence?: MetricEvidence;
  lifecycleEvidence?: MetricEvidence;
  auditPending?: boolean;
  auditVersion?: string;
  migrationSignature?: string;
  migratedPool?: string;
  migratedDex?: string;
  migratedAt?: number;
  bondingCurveProgress?: number;
  lifecycleState?: 'new_pairs' | 'final_stretch' | 'migrating' | 'migrated';
  liquidityPoolAddress?: string;
  isDexPaid?: boolean;
  dexPaidAt?: number;
  isBoosted?: boolean;
  boostAmount?: number;
  observedAt?: string;
  /** When this entry last changed — drives the flash on the card. */
  updatedAt: number;
}

export type LiveStatus = 'connecting' | 'live' | 'unavailable';

/** Refused upgrades are cheap to retry, but not worth retrying forever. */
const MAX_REFUSED_ATTEMPTS = 3;
const BASE_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
/** Server closes with this when the connection is unauthenticated. */
const CLOSE_UNAUTHORIZED = 4401;

export function useLiveTokenUpdates(mints: string[]): {
  updates: Map<string, LiveTokenUpdate>;
  status: LiveStatus;
  /** Mints that had no budget left for a subscription. */
  droppedMints: string[];
} {
  const [updates, setUpdates] = useState<Map<string, LiveTokenUpdate>>(new Map());
  const [status, setStatus] = useState<LiveStatus>('connecting');

  const socketRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(BASE_RETRY_MS);
  const refusedRef = useRef(0);
  /**
   * Whether the current socket has sent `welcome`.
   *
   * Being OPEN is not enough to subscribe: the server attaches its message
   * listener only after sending `welcome`, so anything sent before that is
   * discarded silently. A reconnected socket can be OPEN while the token list
   * changes, and without this guard the resubscribe effect would fire into
   * that gap and the new topics would never be delivered.
   */
  const welcomedRef = useRef(false);
  const sequenceRef = useRef<Map<string, number>>(new Map());
  const mountedRef = useRef(true);

  // Stable key so the effect re-runs on a genuine change of tokens, not on
  // every render that happens to rebuild the array.
  const mintsKey = mints.join(',');

  const plan = useMemo(() => planTokenTopics(mints), [mintsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const planRef = useRef(plan);
  planRef.current = plan;

  /** Sends the difference between what we hold and what the plan wants. */
  const reconcile = useCallback((socket: WebSocket, wanted: string[]) => {
    if (socket.readyState !== WebSocket.OPEN) return;

    const held = subscribedRef.current;
    const add = topicsToAdd(held, wanted);
    const remove = topicsToRemove(held, wanted);

    if (remove.length > 0) {
      socket.send(JSON.stringify({ type: 'unsubscribe', topics: remove }));
      for (const topic of remove) held.delete(topic);
    }
    if (add.length > 0) {
      socket.send(JSON.stringify({ type: 'subscribe', topics: add }));
      for (const topic of add) held.add(topic);
    }
  }, []);

  const applyEvent = useCallback((topic: string, data: Record<string, unknown>, envelopeSequence?: number) => {
    const parsed = parseTokenTopic(topic);
    if (!parsed) return;

    if (typeof envelopeSequence === 'number') {
      const previousSequence = sequenceRef.current.get(topic) ?? 0;
      if (envelopeSequence <= previousSequence) return;
      sequenceRef.current.set(topic, envelopeSequence);
    }

    setUpdates((previous) => {
      const next = new Map(previous);
      const current = next.get(parsed.mint);
      const entry: LiveTokenUpdate = {
        mint: parsed.mint,
        // Spread the previous entry first so a trade message does not erase a
        // price learned a moment ago, and vice versa.
        ...(current ?? {}),
        updatedAt: Date.now(),
      };

      if (parsed.kind === 'token.card') {
        const changed = data.changedFields;
        if (changed && typeof changed === 'object') {
          Object.assign(entry, changed as Partial<LiveTokenUpdate>);
          // The server cache stores decimal market values as strings so REST
          // and Redis never lose precision. The browser contract exposes a
          // numeric price, so normalise this one field at the boundary instead
          // of leaking a string through a TypeScript-only assertion.
          if ('priceUsd' in changed) {
            const price = Number((changed as Record<string, unknown>).priceUsd);
            if (Number.isFinite(price) && price >= 0) entry.priceUsd = price;
            else entry.priceUsd = current?.priceUsd;
          }
          if (
            data.snapshot !== true
            && ((changed as Record<string, unknown>).lastTradeSide === 'BUY'
              || (changed as Record<string, unknown>).lastTradeSide === 'SELL')
          ) {
            entry.lastTradeUpdatedAt = Date.now();
          }
        }
        if (typeof data.observedAt === 'string') entry.observedAt = data.observedAt;
        if (data.fieldObservedAt && typeof data.fieldObservedAt === 'object') entry.fieldObservedAt = { ...current?.fieldObservedAt, ...data.fieldObservedAt as LiveTokenUpdate['fieldObservedAt'] };
        next.set(parsed.mint, entry);
        return next;
      }

      if (parsed.kind === 'token.price') {
        // On subscribe the server replays the cached value, and that snapshot
        // uses `lastPriceUsd` where live events use `priceUsd`. Reading only
        // the live field left every card waiting for its first trade before it
        // showed anything.
        const price = Number(data.priceUsd ?? data.lastPriceUsd);
        if (Number.isFinite(price) && price > 0) entry.priceUsd = price;
        const change = Number(data.change24h);
        if (Number.isFinite(change)) entry.priceChange24h = change;
      } else {
        const side = data.side;
        if (side === 'BUY' || side === 'SELL') {
          entry.lastTradeSide = side;
          entry.lastTradeUpdatedAt = Date.now();
        }
        const amount = Number(data.amountUsd);
        if (Number.isFinite(amount) && amount > 0) entry.lastTradeAmountUsd = amount;
        // A trade message carries a price too when the leg could be priced.
        const price = Number(data.priceUsd);
        if (Number.isFinite(price) && price > 0) entry.priceUsd = price;
      }

      next.set(parsed.mint, entry);
      return next;
    });
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    if (refusedRef.current >= MAX_REFUSED_ATTEMPTS) {
      setStatus('unavailable');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      if (!mountedRef.current) return;
      // Deliberately does NOT subscribe here.
      //
      // The client's `open` fires as soon as the handshake completes, which is
      // before the server's connection handler has run. That handler sends
      // `welcome` and only then attaches its `message` listener, so a
      // subscribe sent on `open` lands in the gap and is dropped — silently:
      // no error, no `subscribed`, no events, just a socket that looks
      // connected forever. Verified against the running server: subscribing on
      // `open` produced 0 events, subscribing on `welcome` produced 32.
      retryDelayRef.current = BASE_RETRY_MS;
      refusedRef.current = 0;
      welcomedRef.current = false;
      subscribedRef.current.clear();
    };

    socket.onmessage = (message) => {
      if (!mountedRef.current) return;
      try {
        const payload = JSON.parse(message.data);

        // The server's handshake. Safe to subscribe from here on.
        if (payload?.type === 'welcome') {
          welcomedRef.current = true;
          sequenceRef.current.clear();
          setStatus('live');
          reconcile(socket, planRef.current.topics);
          return;
        }

        if (payload?.type === 'event' && payload.topic && payload.data) {
          applyEvent(payload.topic, payload.data as Record<string, unknown>, payload.sequence);
        }
      } catch {
        // A malformed frame must not take the socket down.
      }
    };

    socket.onclose = (event) => {
      if (!mountedRef.current) return;
      socketRef.current = null;
      welcomedRef.current = false;
      subscribedRef.current.clear();
      sequenceRef.current.clear();

      // Signed out, or an Origin the server would not accept. Count it, and
      // stop after a few rather than reconnect-looping for the whole session.
      if (event.code === CLOSE_UNAUTHORIZED || event.code === 1006) {
        refusedRef.current += 1;
        if (refusedRef.current >= MAX_REFUSED_ATTEMPTS) {
          setStatus('unavailable');
          return;
        }
      }

      setStatus('connecting');
      retryTimerRef.current = setTimeout(connect, retryDelayRef.current);
      retryDelayRef.current = Math.min(MAX_RETRY_MS, retryDelayRef.current * 2);
    };

    socket.onerror = () => {
      // `onclose` always follows; retry logic lives there so it runs once.
    };
  }, [reconcile, applyEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      const socket = socketRef.current;
      socketRef.current = null;
      // Detach before closing: an onclose firing during teardown would
      // schedule a reconnect for a component that no longer exists.
      if (socket) {
        socket.onclose = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onopen = null;
        socket.close();
      }
    };
    // `connect` closes over the plan, and is recreated when the plan changes;
    // depending on it here would tear the socket down on every token change.
    // The separate effect below reconciles instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Token list changed — adjust subscriptions without dropping the connection.
  useEffect(() => {
    const socket = socketRef.current;
    // `welcomedRef` and not merely OPEN — see its declaration.
    if (socket && welcomedRef.current && socket.readyState === WebSocket.OPEN) {
      reconcile(socket, plan.topics);
    }
  }, [plan.topics, reconcile]);

  return { updates, status, droppedMints: plan.droppedMints };
}
