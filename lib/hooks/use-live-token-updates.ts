'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  planTokenTopics,
  parseTokenTopic,
  topicsToAdd,
  topicsToRemove,
} from '@/lib/ws/topic-plan';

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

export interface LiveTokenUpdate {
  mint: string;
  priceUsd?: number;
  priceChange24h?: number;
  /** Side of the most recent trade seen on this token. */
  lastTradeSide?: 'BUY' | 'SELL';
  lastTradeAmountUsd?: number;
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
  const mountedRef = useRef(true);

  // Stable key so the effect re-runs on a genuine change of tokens, not on
  // every render that happens to rebuild the array.
  const mintsKey = mints.join(',');

  const plan = useMemo(() => planTokenTopics(mints), [mintsKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const applyEvent = useCallback((topic: string, data: Record<string, unknown>) => {
    const parsed = parseTokenTopic(topic);
    if (!parsed) return;

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
        if (side === 'BUY' || side === 'SELL') entry.lastTradeSide = side;
        const amount = Number(data.amount);
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
          setStatus('live');
          reconcile(socket, plan.topics);
          return;
        }

        if (payload?.type === 'event' && payload.topic && payload.data) {
          applyEvent(payload.topic, payload.data as Record<string, unknown>);
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
  }, [plan.topics, reconcile, applyEvent]);

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
