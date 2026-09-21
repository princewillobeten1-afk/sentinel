import type { DiscoveryToken } from './types';
import WebSocketImpl from 'ws';

export const DEXSCREENER_BOOSTS_LATEST_WS_URL = 'wss://api.dexscreener.com/token-boosts/latest/v1';
export const DEXSCREENER_BOOSTS_TOP_WS_URL = 'wss://api.dexscreener.com/token-boosts/top/v1';
/** Backward compatibility alias for the latest boosts WebSocket endpoint */
export const DEXSCREENER_BOOSTS_WS_URL = DEXSCREENER_BOOSTS_LATEST_WS_URL;
export const DEXSCREENER_BOOSTS_LATEST_REST = 'https://api.dexscreener.com/token-boosts/latest/v1';
export const DEXSCREENER_BOOSTS_TOP_REST = 'https://api.dexscreener.com/token-boosts/top/v1';

/**
 * How long a boost record survives without being re-observed.
 *
 * **This is not an expiry time, and it must not be presented as one.**
 * DexScreener publishes no expiry: the payload is exactly `url, chainId,
 * tokenAddress, description, icon, header, openGraph, links, totalAmount,
 * amount` — verified against both `/token-boosts/latest/v1` and
 * `/token-boosts/top/v1`, neither of which carries any expiry, duration or
 * end-time field.
 *
 * This value previously drove `expiresAt = now + 24h`, refreshed on every
 * update, which produced a 24-hour countdown on the card derived from nothing
 * but the moment we happened to see the boost. A boost is *observed*, not
 * timed: it appears in the feed and later stops appearing. So this is a
 * staleness window over our own observations — if a mint has not been seen in
 * a successful poll for this long, we stop claiming it is boosted.
 */
export const BOOST_OBSERVATION_TTL_MS = 30 * 60 * 1000;

export interface DexBoostLink {
  type?: string;
  label?: string;
  url: string;
}

export interface DexBoostPayload {
  url?: string;
  chainId?: string;
  tokenAddress: string;
  description?: string;
  icon?: string;
  header?: string;
  openGraph?: string;
  links?: DexBoostLink[];
  totalAmount?: number;
  amount?: number;
}

export interface DexBoostRecord {
  url: string;
  chainId: string;
  tokenAddress: string;
  description?: string;
  icon?: string;
  header?: string;
  openGraph?: string;
  links?: DexBoostLink[];
  /**
   * Boost amounts as reported. Undefined when absent — `/token-boosts/top/v1`
   * omits `amount` entirely, and defaulting it to 10 (as this did) invented a
   * purchase size for every token in that feed.
   */
  totalAmount?: number;
  amount?: number;
  firstSeenAt: number;
  updatedAt: number;
  /** Last time this boost was observed in a feed response. Not an expiry. */
  lastSeenAt: number;
}

export type DexBoostStreamKind = 'latest' | 'top';

export interface DexStreamHealth {
  status: 'connected' | 'connecting' | 'reconnecting' | 'idle' | 'error';
  lastMessageAt: number | null;
  reconnectAttempts: number;
  lastError?: string;
}

export interface DexBoostsHealth {
  status: 'connected' | 'connecting' | 'reconnecting' | 'idle' | 'error';
  totalBoosts: number;
  solanaBoosts: number;
  lastMessageAt: number | null;
  reconnectAttempts: number;
  lastError?: string;
  streams?: {
    latest: DexStreamHealth;
    top: DexStreamHealth;
  };
}

function getWebSocketConstructor(): any {
  if (typeof globalThis.WebSocket !== 'undefined') return globalThis.WebSocket;
  return WebSocketImpl;
}

interface StreamState {
  kind: DexBoostStreamKind;
  url: string;
  socket: any | null;
  status: DexStreamHealth['status'];
  lastMessageAt: number | null;
  reconnectAttempts: number;
  lastError?: string;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  watchdogTimer: ReturnType<typeof setInterval> | null;
}

export class DexScreenerBoostsService {
  private static instance: DexScreenerBoostsService;

  private registry = new Map<string, DexBoostRecord>();
  private listeners = new Set<(boost: DexBoostRecord) => void>();
  private intentionalStop = false;

  private streams: Record<DexBoostStreamKind, StreamState> = {
    latest: {
      kind: 'latest',
      url: DEXSCREENER_BOOSTS_LATEST_WS_URL,
      socket: null,
      status: 'idle',
      lastMessageAt: null,
      reconnectAttempts: 0,
      reconnectTimer: null,
      watchdogTimer: null,
    },
    top: {
      kind: 'top',
      url: DEXSCREENER_BOOSTS_TOP_WS_URL,
      socket: null,
      status: 'idle',
      lastMessageAt: null,
      reconnectAttempts: 0,
      reconnectTimer: null,
      watchdogTimer: null,
    },
  };

  public static getInstance(): DexScreenerBoostsService {
    if (!DexScreenerBoostsService.instance) {
      DexScreenerBoostsService.instance = new DexScreenerBoostsService();
    }
    return DexScreenerBoostsService.instance;
  }

  /**
   * Starts both background WebSocket streams (latest and top) and preloads REST cache.
   * Safe to call multiple times (idempotent).
   */
  start(): void {
    const isAnyActive = Object.values(this.streams).some(
      (s) => s.status === 'connected' || s.status === 'connecting' || s.status === 'reconnecting',
    );
    if (isAnyActive && !this.intentionalStop) {
      return;
    }

    this.intentionalStop = false;
    for (const state of Object.values(this.streams)) {
      state.reconnectAttempts = 0;
    }

    // 1. Asynchronously warm cache via REST without blocking WS connect
    void this.preloadFromRest();

    // 2. Open concurrent WebSocket streams (both latest and top)
    this.connectStream('latest');
    this.connectStream('top');
  }

  /**
   * Stops all active streams and clears reconnect/watchdog timers.
   */
  stop(): void {
    this.intentionalStop = true;
    for (const state of Object.values(this.streams)) {
      this.clearStreamTimers(state);
      if (state.socket) {
        try {
          state.socket.close();
        } catch {
          // Ignore close errors
        }
        state.socket = null;
      }
      state.status = 'idle';
    }
  }

  /**
   * Preload boosts from DexScreener REST endpoints.
   */
  async preloadFromRest(): Promise<void> {
    const urls = [DEXSCREENER_BOOSTS_LATEST_REST, DEXSCREENER_BOOSTS_TOP_REST];

    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 0 },
          } as RequestInit);

          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data)) {
            this.ingestBoosts(data, false);
          } else if (data && Array.isArray(data.data)) {
            this.ingestBoosts(data.data, false);
          }
        } catch (err) {
          // Preload errors are non-fatal, WS stream will supply data
        }
      }),
    );
  }

  /**
   * Look up a boost record by mint or address (case-insensitive).
   */
  getBoost(mintOrAddress: string): DexBoostRecord | undefined {
    if (!mintOrAddress) return undefined;
    const direct = this.registry.get(mintOrAddress);
    if (direct) return direct;
    return this.registry.get(mintOrAddress.toLowerCase());
  }

  /**
   * True while the token has been seen in a boost feed recently enough to
   * still claim it is boosted.
   */
  isBoosted(mintOrAddress: string): boolean {
    const boost = this.getBoost(mintOrAddress);
    if (!boost) return false;
    return Date.now() - boost.lastSeenAt < BOOST_OBSERVATION_TTL_MS;
  }

  /**
   * How long this boost has been observed, in seconds.
   *
   * Deliberately **not** a countdown. There was a `getBoostCountdown()` here
   * returning `(expiresAt - now) / 1000` against an `expiresAt` we made up, so
   * the card showed a confident timer ticking toward an end DexScreener never
   * published. Elapsed time is something we actually measured.
   */
  getBoostAgeSeconds(mintOrAddress: string): number | null {
    const boost = this.getBoost(mintOrAddress);
    if (!boost) return null;
    return Math.max(0, Math.floor((Date.now() - boost.firstSeenAt) / 1000));
  }

  /**
   * Returns all currently active boosted tokens.
   */
  getAllBoosts(filterChain?: string): DexBoostRecord[] {
    const now = Date.now();
    const unique = new Set<DexBoostRecord>();

    for (const record of this.registry.values()) {
      if (now - record.lastSeenAt < BOOST_OBSERVATION_TTL_MS) {
        if (!filterChain || record.chainId.toLowerCase() === filterChain.toLowerCase()) {
          unique.add(record);
        }
      }
    }

    // Unreported amounts sort last rather than being treated as zero.
    return Array.from(unique).sort((a, b) => (b.totalAmount ?? -1) - (a.totalAmount ?? -1));
  }

  /**
   * Enriches a DiscoveryToken with active boost data, Dex Paid status, and social links.
   */
  enrichToken(token: DiscoveryToken): DiscoveryToken {
    const mint = token.mint || token.id;
    if (!mint) return token;

    const boost = this.getBoost(mint);
    if (!boost || Date.now() - boost.lastSeenAt >= BOOST_OBSERVATION_TTL_MS) {
      return token;
    }

    const enriched: DiscoveryToken = {
      ...token,
      isBoosted: true,
      boostAmount: boost.totalAmount ?? boost.amount,
      // `isDexPaid` is deliberately NOT set here.
      //
      // It used to be hardcoded `true` for anything boosted, but they are two
      // different purchases: a boost is paid promotion, while "Dex Paid" is the
      // token-profile listing, reported separately by
      // `/orders/v1/solana/<mint>` with its own approval status and payment
      // timestamp. Conflating them meant every boosted token claimed a listing
      // nobody had checked. See `dexscreener-orders.ts`.
    };

    // Backfill social links from boost metadata if absent on the token
    if (boost.links && boost.links.length > 0) {
      if (!enriched.twitterUrl) {
        const tw = boost.links.find(
          (l) => l.type === 'twitter' || l.url?.includes('x.com') || l.url?.includes('twitter.com'),
        );
        if (tw?.url) {
          enriched.twitterUrl = tw.url;
          const match = tw.url.match(/(?:x\.com|twitter\.com)\/([^/?#]+)/i);
          if (match && match[1] && !enriched.twitterHandle) {
            enriched.twitterHandle = `@${match[1]}`;
          }
        }
      }

      if (!enriched.telegramUrl) {
        const tg = boost.links.find((l) => l.type === 'telegram' || l.url?.includes('t.me'));
        if (tg?.url) enriched.telegramUrl = tg.url;
      }

      if (!enriched.websiteUrl) {
        const web = boost.links.find(
          (l) =>
            l.type === 'website' ||
            (!l.type &&
              !l.url?.includes('t.me') &&
              !l.url?.includes('x.com') &&
              !l.url?.includes('twitter.com') &&
              !l.url?.includes('discord')),
        );
        if (web?.url) enriched.websiteUrl = web.url;
      }
    }

    return enriched;
  }

  /**
   * Batch enriches an array of DiscoveryTokens.
   */
  enrichTokens(tokens: DiscoveryToken[]): DiscoveryToken[] {
    return tokens.map((token) => this.enrichToken(token));
  }

  /**
   * Subscribes to live boost events. Returns an unsubscribe callback.
   */
  onBoost(listener: (boost: DexBoostRecord) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns current service diagnostic and health metrics.
   */
  getHealth(): DexBoostsHealth {
    let solanaBoosts = 0;
    const now = Date.now();
    const seen = new Set<string>();

    for (const record of this.registry.values()) {
      if (now - record.lastSeenAt < BOOST_OBSERVATION_TTL_MS && !seen.has(record.tokenAddress)) {
        seen.add(record.tokenAddress);
        if (record.chainId.toLowerCase() === 'solana') {
          solanaBoosts++;
        }
      }
    }

    const latestStream = this.streams.latest;
    const topStream = this.streams.top;

    let aggregateStatus: DexBoostsHealth['status'] = 'idle';
    if (latestStream.status === 'connected' || topStream.status === 'connected') {
      aggregateStatus = 'connected';
    } else if (latestStream.status === 'connecting' || topStream.status === 'connecting') {
      aggregateStatus = 'connecting';
    } else if (latestStream.status === 'reconnecting' || topStream.status === 'reconnecting') {
      aggregateStatus = 'reconnecting';
    } else if (latestStream.status === 'error' && topStream.status === 'error') {
      aggregateStatus = 'error';
    }

    const lastMessageAt = Math.max(latestStream.lastMessageAt ?? 0, topStream.lastMessageAt ?? 0) || null;
    const totalReconnectAttempts = latestStream.reconnectAttempts + topStream.reconnectAttempts;
    const lastError = latestStream.lastError || topStream.lastError;

    return {
      status: aggregateStatus,
      totalBoosts: seen.size,
      solanaBoosts,
      lastMessageAt,
      reconnectAttempts: totalReconnectAttempts,
      lastError,
      streams: {
        latest: {
          status: latestStream.status,
          lastMessageAt: latestStream.lastMessageAt,
          reconnectAttempts: latestStream.reconnectAttempts,
          lastError: latestStream.lastError,
        },
        top: {
          status: topStream.status,
          lastMessageAt: topStream.lastMessageAt,
          reconnectAttempts: topStream.reconnectAttempts,
          lastError: topStream.lastError,
        },
      },
    };
  }

  /**
   * Ingests a raw payload from WebSocket or REST into the boost registry.
   */
  ingestBoost(raw: DexBoostPayload, emit = true): DexBoostRecord | null {
    if (!raw || !raw.tokenAddress) return null;

    const tokenAddress = raw.tokenAddress.trim();
    const now = Date.now();
    const existing = this.getBoost(tokenAddress);

    const record: DexBoostRecord = {
      url: raw.url || existing?.url || `https://dexscreener.com/${raw.chainId || 'solana'}/${tokenAddress}`,
      chainId: raw.chainId || existing?.chainId || 'solana',
      tokenAddress,
      description: raw.description || existing?.description,
      icon: raw.icon || existing?.icon,
      header: raw.header || existing?.header,
      openGraph: raw.openGraph || existing?.openGraph,
      links: raw.links && raw.links.length > 0 ? raw.links : (existing?.links || []),
      // No `|| 10`: an unreported amount stays unreported.
      totalAmount: raw.totalAmount ?? existing?.totalAmount,
      amount: raw.amount ?? existing?.amount,
      firstSeenAt: existing?.firstSeenAt || now,
      updatedAt: now,
      lastSeenAt: now,
    };

    // Index by exact address and lowercase address
    this.registry.set(tokenAddress, record);
    this.registry.set(tokenAddress.toLowerCase(), record);

    if (emit) {
      this.notifyListeners(record);
    }

    return record;
  }

  /**
   * Ingests an array of boost items.
   */
  ingestBoosts(items: DexBoostPayload[], emit = true): DexBoostRecord[] {
    const records: DexBoostRecord[] = [];
    for (const item of items) {
      const rec = this.ingestBoost(item, emit);
      if (rec) records.push(rec);
    }
    return records;
  }

  /**
   * Directly parses incoming WebSocket raw string message.
   * Useful for testing and wire handling.
   */
  handleRawMessage(dataStr: string, streamKind?: DexBoostStreamKind): void {
    const now = Date.now();
    if (streamKind && this.streams[streamKind]) {
      this.streams[streamKind].lastMessageAt = now;
    } else {
      this.streams.latest.lastMessageAt = now;
      this.streams.top.lastMessageAt = now;
    }

    try {
      const parsed = JSON.parse(dataStr);

      // Heartbeat frame from DexScreener
      if (parsed && parsed.type === 'heartbeat') {
        return;
      }

      // Initial snapshot frame: { limit: 90, data: [...] }
      if (parsed && Array.isArray(parsed.data)) {
        this.ingestBoosts(parsed.data, false);
        return;
      }

      // Realtime update frame: array of boost objects
      if (Array.isArray(parsed)) {
        this.ingestBoosts(parsed, true);
        return;
      }

      // Single boost object
      if (parsed && parsed.tokenAddress) {
        this.ingestBoost(parsed, true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (streamKind && this.streams[streamKind]) {
        this.streams[streamKind].lastError = msg;
      } else {
        this.streams.latest.lastError = msg;
      }
    }
  }

  // ── Private Connection Management ──

  private connectStream(kind: DexBoostStreamKind): void {
    if (this.intentionalStop) return;

    const state = this.streams[kind];
    const WS = getWebSocketConstructor();
    if (!WS) {
      state.status = 'error';
      state.lastError = 'No WebSocket implementation available in runtime';
      return;
    }

    state.status = state.reconnectAttempts === 0 ? 'connecting' : 'reconnecting';

    try {
      const ws = new WS(state.url);
      state.socket = ws;

      ws.onopen = () => {
        state.status = 'connected';
        state.reconnectAttempts = 0;
        state.lastMessageAt = Date.now();
        this.startStreamWatchdog(kind);
      };

      ws.onmessage = (event: { data: any }) => {
        const raw = typeof event.data === 'string' ? event.data : event.data?.toString();
        if (raw) {
          this.handleRawMessage(raw, kind);
        }
      };

      ws.onerror = (err: any) => {
        state.lastError = err?.message || `WebSocket error on ${kind}`;
      };

      ws.onclose = () => {
        state.socket = null;
        this.clearStreamWatchdog(state);

        if (this.intentionalStop) {
          state.status = 'idle';
          return;
        }

        this.scheduleStreamReconnect(kind);
      };
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err);
      this.scheduleStreamReconnect(kind);
    }
  }

  private scheduleStreamReconnect(kind: DexBoostStreamKind): void {
    if (this.intentionalStop) return;

    const state = this.streams[kind];
    state.status = 'reconnecting';
    state.reconnectAttempts++;

    const baseDelay = 1000;
    const maxDelay = 30000;
    const exponential = Math.min(baseDelay * 2 ** Math.min(state.reconnectAttempts, 5), maxDelay);
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.round(exponential * jitter);

    this.clearStreamReconnectTimer(state);
    state.reconnectTimer = setTimeout(() => {
      this.connectStream(kind);
    }, delay);
  }

  private startStreamWatchdog(kind: DexBoostStreamKind): void {
    const state = this.streams[kind];
    this.clearStreamWatchdog(state);
    // DexScreener emits heartbeats ~10s. If silent for 60s, reconnect.
    state.watchdogTimer = setInterval(() => {
      if (!state.lastMessageAt) return;
      const silentFor = Date.now() - state.lastMessageAt;
      if (silentFor > 60_000) {
        if (state.socket) {
          try {
            state.socket.close();
          } catch {
            // Ignore
          }
        }
      }
    }, 30_000);
  }

  private clearStreamWatchdog(state: StreamState): void {
    if (state.watchdogTimer) {
      clearInterval(state.watchdogTimer);
      state.watchdogTimer = null;
    }
  }

  private clearStreamReconnectTimer(state: StreamState): void {
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
  }

  private clearStreamTimers(state: StreamState): void {
    this.clearStreamWatchdog(state);
    this.clearStreamReconnectTimer(state);
  }

  private notifyListeners(record: DexBoostRecord): void {
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // Prevent listener failures from breaking pipeline
      }
    }
  }

  /**
   * Test seam: reset state and in-memory registry.
   */
  __resetForTesting(): void {
    this.stop();
    this.registry.clear();
    this.listeners.clear();
    for (const state of Object.values(this.streams)) {
      state.status = 'idle';
      state.lastMessageAt = null;
      state.reconnectAttempts = 0;
      state.lastError = undefined;
    }
  }
}

const globalForDexBoosts = globalThis as unknown as { dexScreenerBoostsService?: DexScreenerBoostsService };
export const dexScreenerBoostsService = globalForDexBoosts.dexScreenerBoostsService ?? DexScreenerBoostsService.getInstance();
if (process.env.NODE_ENV !== 'production') globalForDexBoosts.dexScreenerBoostsService = dexScreenerBoostsService;
