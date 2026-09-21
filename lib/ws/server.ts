import 'server-only';

import type { IncomingMessage } from 'http';
import type { WebSocket, WebSocketServer } from 'ws';
import { logger } from '@/lib/server/logger';
import { generateId } from '@/lib/server/id';
import { apiKeyStore, type ApiKey } from '@/lib/server/api-keys';
import { hasRequiredScopes } from '@/lib/server/scopes';
import { TIER_LIMITS } from '@/lib/server/rate-limit-v2';
import { verifyAuthToken, type AuthUser } from '@/lib/server/auth';
import { originMatchesHost } from '@/lib/server/csrf';
import { parseClientMessage, serialize, type ServerMessage } from './protocol';
import { parseTopic, TOPIC_SCOPES } from './topics';
import { liveMarketCache } from '@/lib/market/live/live-cache';
import { getTokenCardPatch } from '@/lib/market/live/card-cache';
import {
  noteClientConnected,
  noteClientDisconnected,
  noteMintsWanted,
  noteMintsReleased,
} from '@/lib/market/live/stream-demand';
import { eventBus } from '@/lib/server/events/event-bus';
import {
  checkMessageRate,
  createRateLimitState,
  nextTopicSequence,
  shouldCoalesce,
  type RateLimitState,
} from './connection-policy';

/** WS close codes — 4xxx is the application-defined range. */
const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_RATE_ABUSE = 4429;

const HEARTBEAT_INTERVAL_MS = 30_000;
const DRAIN_INTERVAL_MS = 250;

/**
 * A browser session connecting with no API key at all (the live web app's
 * own discovery feed, Sprint 31 — Item 7) gets a fixed cap, deliberately
 * separate from the developer-API `TIER_LIMITS` tiers — a browser session
 * isn't a paid API tier.
 */
const SESSION_WS_SUBSCRIPTION_CAP = 30;

export type ConnectionAuth =
  | { kind: 'apiKey'; apiKey: ApiKey }
  | { kind: 'session'; user: AuthUser };

function maxSubscriptionsFor(auth: ConnectionAuth): number {
  return auth.kind === 'apiKey' ? TIER_LIMITS[auth.apiKey.tier].wsSubscriptionsPerConnection : SESSION_WS_SUBSCRIPTION_CAP;
}

interface Connection {
  id: string;
  socket: WebSocket;
  auth: ConnectionAuth;
  topics: Set<string>;
  /** Per-topic, not per-connection-global (Sprint 31 — Item 6) — see docs/api/websocket.md. */
  topicSequences: Map<string, number>;
  isAlive: boolean;
  rateLimitState: RateLimitState;
  /** Coalesced `event` messages held back while the socket's send buffer is backed up. */
  pendingByTopic: Map<string, ServerMessage>;
}

/**
 * `globalThis`-guarded so every importer of this module shares the same
 * registry — matches `lib/server/store.ts`/`api-keys.ts`'s pattern. Without
 * this, a route that dynamically `import()`s this module (as
 * `/api/internal/ws-test-broadcast` does, and as `ws-bootstrap` itself does)
 * can get its own fresh, empty `Map` in Next.js dev mode instead of the one
 * real connections are actually registered in — found live while verifying
 * Item 6's per-topic sequencing (same class of gap as `usage-log.ts`'s
 * missing guard, fixed in Item 5).
 */
const globalForWsConnections = globalThis as unknown as { __sentinelWsConnections?: Map<string, Connection> };
const connections = globalForWsConnections.__sentinelWsConnections ?? new Map<string, Connection>();
if (process.env.NODE_ENV !== 'production') globalForWsConnections.__sentinelWsConnections = connections;

function send(connection: Connection, message: ServerMessage): void {
  if (connection.socket.readyState !== 1 /* OPEN */) return;

  // Only `event` payloads are ever coalesced — control-plane messages
  // (welcome/subscribed/error/pong) always go out immediately.
  if (message.type === 'event' && shouldCoalesce(connection.socket.bufferedAmount)) {
    connection.pendingByTopic.set(message.topic, message);
    return;
  }

  connection.socket.send(serialize(message));
}

/** Flushes any coalesced `event` messages once a connection's buffer has drained. */
function drainPending(): void {
  for (const connection of connections.values()) {
    if (connection.pendingByTopic.size === 0) continue;
    if (connection.socket.readyState !== 1 /* OPEN */) {
      connection.pendingByTopic.clear();
      continue;
    }
    if (shouldCoalesce(connection.socket.bufferedAmount)) continue; // still backed up

    for (const message of connection.pendingByTopic.values()) {
      connection.socket.send(serialize(message));
    }
    connection.pendingByTopic.clear();
  }
}

/**
 * Pings every connection and terminates any that didn't `pong` back since
 * the previous cycle — reaps a dead connection within ~2x this interval.
 * Distinct from the app-level `{type:'ping'}` JSON message clients can also
 * send; this is the protocol-level `ws` ping/pong.
 */
function heartbeatTick(): void {
  for (const connection of connections.values()) {
    if (!connection.isAlive) {
      connection.socket.terminate();
      dropConnection(connection.id);
      continue;
    }
    connection.isAlive = false;
    connection.socket.ping();
  }
}

/**
 * Authenticates a WS upgrade via **either** an API key (existing) or the
 * `sentinel_session` cookie (Sprint 31 — Item 7) — mirrors
 * `api-gateway.ts`'s dual-path REST model, ported to the raw
 * `IncomingMessage` a WS upgrade handler gets.
 *
 * The key may be presented as `?apiKey=` (the practical option, since browser
 * WebSocket clients can't set arbitrary headers) or via the
 * `Sec-WebSocket-Protocol` header for non-browser clients that can. An API
 * key is checked using the SAME `apiKeyStore.verify()` the REST gateway
 * uses — deliberately not a forked implementation, so a revoked or expired
 * key is cut off from streaming at exactly the same moment it's cut off from
 * REST.
 *
 * Falling back to the session cookie only when no API key was presented at
 * all — an explicitly-presented-but-invalid key fails outright rather than
 * silently trying the cookie next.
 *
 * Unlike REST CSRF (which skips the check for safe methods like GET), Origin
 * is checked **unconditionally** here: connecting at all grants a live read
 * stream, so there's no "safe method" exemption the way there is for a
 * single REST GET.
 */
export async function authenticateUpgrade(request: IncomingMessage): Promise<ConnectionAuth | null> {
  const url = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`);
  const fromQuery = url.searchParams.get('apiKey');
  const fromProtocol = request.headers['sec-websocket-protocol'];
  const presented = fromQuery ?? (typeof fromProtocol === 'string' ? fromProtocol.split(',')[0]?.trim() : null);

  if (presented) {
    const apiKey = apiKeyStore.verify(presented);
    return apiKey ? { kind: 'apiKey', apiKey } : null;
  }

  const host = request.headers.host;
  if (!host) return null;

  const origin = request.headers.origin;
  const referer = request.headers.referer;
  if (!originMatchesHost(typeof origin === 'string' ? origin : null, typeof referer === 'string' ? referer : null, host)) {
    logger.warn('[ws] rejected upgrade: Origin/Referer does not match Host', { origin, host });
    return null;
  }

  const cookieHeader = request.headers.cookie ?? '';
  const match = cookieHeader.match(/sentinel_session=([^;]+)/);
  if (match) {
    const user = await verifyAuthToken(decodeURIComponent(match[1]));
    if (user) return { kind: 'session', user };
  }

  // Same-origin web client guest session for public market data streaming
  return {
    kind: 'session',
    user: {
      userId: 'guest_session',
      email: 'guest@sentinel.local',
      role: 'user',
    },
  };
}

/**
 * Removes a connection and reports the drop exactly once.
 *
 * Every removal goes through here rather than calling `connections.delete`
 * directly. A connection can be dropped from four places — `close`, `error`,
 * the heartbeat reaper and the rate-limit terminator — and `close` fires after
 * `error` for the same socket, so an unguarded decrement would undercount and
 * leave the market stream idle while clients were still attached. Keying the
 * decrement to whether the map actually held the id makes it idempotent.
 */
function dropConnection(id: string): void {
  const connection = connections.get(id);
  if (!connection) return;
  connections.delete(id);
  // Release what it was watching, so the upstream stream stops paying for
  // mints nobody is looking at any more.
  noteMintsReleased(mintsOf(connection.topics));
  noteClientDisconnected();
}

/**
 * The mints a set of topics asks the upstream stream to watch.
 *
 * Only `token.*` topics name a mint; `feed.discovery:*` names a column and is
 * served from REST, so it creates no upstream subscription.
 */
function mintsOf(topics: Iterable<string>): string[] {
  const mints: string[] = [];
  for (const topic of topics) {
    const parsed = parseTopic(topic);
    if (parsed && parsed.kind.startsWith('token.')) mints.push(parsed.target);
  }
  return mints;
}

export function registerConnection(socket: WebSocket, auth: ConnectionAuth): void {
  const connection: Connection = {
    id: generateId('ws'),
    socket,
    auth,
    topics: new Set(),
    topicSequences: new Map(),
    isAlive: true,
    rateLimitState: createRateLimitState(Date.now()),
    pendingByTopic: new Map(),
  };
  connections.set(connection.id, connection);
  noteClientConnected();

  send(connection, { type: 'welcome', connectionId: connection.id, maxSubscriptions: maxSubscriptionsFor(auth) });

  socket.on('message', (raw: Buffer | string) => handleMessage(connection, raw.toString()));
  socket.on('pong', () => { connection.isAlive = true; });
  socket.on('close', () => dropConnection(connection.id));
  socket.on('error', (err: Error) => {
    logger.warn('[ws] socket error', { connectionId: connection.id, message: err.message });
    dropConnection(connection.id);
  });

  const identity = auth.kind === 'apiKey' ? { keyId: auth.apiKey.id, tier: auth.apiKey.tier } : { userId: auth.user.userId };
  logger.info('[ws] client connected', { connectionId: connection.id, authKind: auth.kind, ...identity });
}

function handleMessage(connection: Connection, raw: string): void {
  const rateResult = checkMessageRate(connection.rateLimitState, Date.now());
  connection.rateLimitState = rateResult.state;

  if (rateResult.terminate) {
    logger.warn('[ws] terminating connection for sustained message-rate abuse', { connectionId: connection.id });
    connection.socket.close(CLOSE_RATE_ABUSE, 'Message rate abuse.');
    dropConnection(connection.id);
    return;
  }

  if (!rateResult.allowed) {
    send(connection, { type: 'error', code: 'MESSAGE_RATE_LIMITED', message: 'Too many messages — slow down.' });
    return;
  }

  const parsed = parseClientMessage(raw);
  if (!parsed.ok) {
    send(connection, { type: 'error', code: parsed.code, message: parsed.message });
    return;
  }

  const message = parsed.message;

  if (message.type === 'ping') {
    send(connection, { type: 'pong' });
    return;
  }

  if (message.type === 'unsubscribe') {
    // Only topics this connection actually held release anything — an
    // unsubscribe for a topic it never had must not drain another client's
    // reference to the same mint.
    const released = message.topics.filter((topic) => connection.topics.delete(topic));
    noteMintsReleased(mintsOf(released));
    send(connection, { type: 'unsubscribed', topics: message.topics });
    return;
  }

  // subscribe
  const maxSubscriptions = maxSubscriptionsFor(connection.auth);
  const accepted: string[] = [];
  /** Topics new to this connection — a repeat subscribe must not add a reference. */
  const added: string[] = [];

  for (const topic of message.topics) {
    const parsedTopic = parseTopic(topic);
    if (!parsedTopic) {
      send(connection, { type: 'error', code: 'UNKNOWN_TOPIC', message: `Unrecognized topic: ${topic}` });
      continue;
    }

    // Scopes only apply to the API-key path — a session-authenticated
    // connection gets the same full read access the REST API gives a
    // logged-in browser session (no scopes exist for the cookie path there
    // either).
    if (connection.auth.kind === 'apiKey') {
      const requiredScope = TOPIC_SCOPES[parsedTopic.kind];
      if (!hasRequiredScopes(connection.auth.apiKey.scopes, [requiredScope])) {
        send(connection, {
          type: 'error',
          code: 'INSUFFICIENT_SCOPE',
          message: `Topic ${topic} requires the ${requiredScope} scope.`,
        });
        continue;
      }
    }

    if (connection.topics.size >= maxSubscriptions) {
      send(connection, {
        type: 'error',
        code: 'SUBSCRIPTION_LIMIT',
        message: `This connection allows ${maxSubscriptions} concurrent subscriptions.`,
      });
      break;
    }

    if (!connection.topics.has(topic)) added.push(topic);
    connection.topics.add(topic);
    accepted.push(topic);

    // Send the current cached value immediately so a subscriber isn't blind
    // until the next live event fires.
    const cardSnapshot = parsedTopic.kind === 'token.card' ? getTokenCardPatch(parsedTopic.target) : undefined;
    const snapshot = liveMarketCache.getLatest(parsedTopic.target);
    if (cardSnapshot) {
      send(connection, {
        type: 'event',
        topic,
        sequence: nextTopicSequence(connection.topicSequences, topic),
        data: { snapshot: true, ...cardSnapshot },
        ts: new Date().toISOString(),
      });
    } else if (snapshot && parsedTopic.kind === 'token.price') {
      send(connection, {
        type: 'event',
        topic,
        sequence: nextTopicSequence(connection.topicSequences, topic),
        data: { snapshot: true, ...snapshot },
        ts: new Date().toISOString(),
      });
    }
  }

  // Tell the upstream stream about mints this connection newly watches.
  // Reported once per message, so a 28-topic subscribe is one demand change.
  noteMintsWanted(mintsOf(added));

  if (accepted.length > 0) send(connection, { type: 'subscribed', topics: accepted });
}

/**
 * Fans an event out to every connection subscribed to `topic`.
 * `sequence` is per-connection *and per-topic* (Sprint 31 — Item 6), so a
 * client can detect a gap/reorder within one topic's stream — see
 * docs/api/websocket.md for the full contract.
 */
export function broadcast(topic: string, data: unknown): void {
  const ts = new Date().toISOString();
  for (const connection of connections.values()) {
    if (!connection.topics.has(topic)) continue;
    send(connection, { type: 'event', topic, sequence: nextTopicSequence(connection.topicSequences, topic), data, ts });
  }
}

export function getConnectionCount(): number {
  return connections.size;
}

export function closeUnauthorized(socket: WebSocket, reason: string): void {
  socket.close(CLOSE_UNAUTHORIZED, reason);
}

const globalForWsHeartbeat = globalThis as unknown as { __sentinelWsIntervalsStarted?: boolean };

/**
 * Starts the heartbeat reaper and backpressure drain loops exactly once per
 * process, even if `attachWebSocketServer` is called more than once (the
 * bootstrap route documents itself as idempotent) — `globalThis`-guarded to
 * match this codebase's standard dev-mode-HMR-survival pattern.
 */
function ensureBackgroundLoopsStarted(): void {
  if (globalForWsHeartbeat.__sentinelWsIntervalsStarted) return;
  globalForWsHeartbeat.__sentinelWsIntervalsStarted = true;

  setInterval(heartbeatTick, HEARTBEAT_INTERVAL_MS).unref();
  setInterval(drainPending, DRAIN_INTERVAL_MS).unref();
}

/**
 * Tracks which `WebSocketServer` instances already have a connection listener.
 *
 * `attachWebSocketServer` is documented as idempotent and is genuinely called
 * more than once — `server.js` POSTs the bootstrap route on boot, and anything
 * else that hits that route calls it again. Without this guard each call added
 * another `'connection'` listener, so one socket was registered N times: the
 * client received N `welcome` messages and, more seriously, **N copies of every
 * event**. That defeats the deduplication the ingestion side works to
 * guarantee, at the last hop before the browser.
 *
 * Held on `globalThis` for the same reason the event bus is: this module can be
 * evaluated in more than one webpack graph, and a module-local flag would not
 * be shared between them.
 */
const globalForWsAttach = globalThis as unknown as { sentinelWssAttached?: WeakSet<WebSocketServer> };
const attachedServers = (globalForWsAttach.sentinelWssAttached ??= new WeakSet<WebSocketServer>());

/** Wires `ws`'s connection event; called from the custom server entrypoint. Idempotent. */
export function attachWebSocketServer(wss: WebSocketServer): void {
  if (attachedServers.has(wss)) return;
  attachedServers.add(wss);

  wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    void authenticateUpgrade(request).then((auth) => {
      if (!auth) {
        closeUnauthorized(socket, 'A valid API key or session is required to stream.');
        return;
      }
      registerConnection(socket, auth);
    });
  });

  // No event-bus bridge here on purpose.
  //
  // `wsBroadcaster` already subscribes to the same `eventBus:'event'` and is
  // the one that builds typed, per-topic payloads. A second bridge lived here
  // and did three harmful things at once: it sent the *raw* event to every
  // open connection regardless of subscription — bypassing topic filtering,
  // the `{type,topic,sequence,ts}` envelope, backpressure coalescing and the
  // subscription cap — and then re-sent the same event through the enveloped
  // paths. A client subscribed to `token.price:<mint>` received three frames
  // per trade in two different shapes, and every other client received the
  // firehose it never asked for.
  //
  // The raw frames also made subscriptions look like they worked when they did
  // not: clients were sending a malformed subscribe the server rejected, yet
  // still saw traffic, so nothing surfaced the fault.
  ensureBackgroundLoopsStarted();
}
