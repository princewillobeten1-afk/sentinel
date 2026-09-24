import 'server-only';

import WebSocketImpl from 'ws';
import { logger } from '@/lib/server/logger';
import type { ConnectionHealth, ConnectionState } from './types';

const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;
/**
 * No frame of any kind — data or pong — within this window ⇒ treat as a dead
 * connection. Pongs count, so a subscription that is quiet because nothing is
 * trading is not mistaken for one that has died.
 */
const SILENT_CONNECTION_TIMEOUT_MS = 60_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const DEGRADED_AFTER_CONSECUTIVE_FAILURES = 5;

export interface ReconnectingWebSocketClientOptions {
  /** Used only in log lines to distinguish providers. */
  name: string;
  url: string;
  headers?: Record<string, string>;
  protocols?: string | string[];
  onMessage: (raw: string) => void;
  /** Called after every successful connect/reconnect — re-issue subscriptions here. */
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  /** Called on every degraded threshold interval so a recovered standby can be retried. */
  onDegraded?: (reason: string) => void;
}

/** Payload size of one inbound frame, whichever shape `ws` delivered it in. */
function rawDataLength(data: WebSocketImpl.RawData): number {
  if (Array.isArray(data)) return data.reduce((sum, chunk) => sum + chunk.length, 0);
  if (data instanceof ArrayBuffer) return data.byteLength;
  return data.length;
}

/**
 * A minimal, dependency-light reconnecting WebSocket wrapper shared by the
 * Birdeye and Helius clients.
 *
 * Reconnect strategy: exponential backoff (1s → 30s cap) with ±20% jitter,
 * infinite retries — this is a background market-data feed, not a one-shot
 * request, so it should never give up on its own. After
 * `DEGRADED_AFTER_CONSECUTIVE_FAILURES` consecutive failed attempts it calls
 * `onDegraded` so the caller can drive `MarketEventPipeline.triggerFailover()`.
 *
 * Liveness: a ping/pong heartbeat catches most dead sockets. A separate
 * "silent connection" watchdog additionally force-reconnects if no message of
 * any kind (not just pong) has arrived recently — covers the case where the
 * transport stays technically alive but the subscription silently stops
 * delivering data.
 */
export class ReconnectingWebSocketClient {
  private readonly options: ReconnectingWebSocketClientOptions;
  private endpoint: string;
  private socket: WebSocketImpl | null = null;
  private state: ConnectionState = 'closed';
  private lastMessageAt: number | null = null;
  private openedAt: number | null = null;
  /** Inbound payload bytes across every socket this client has opened. */
  private bytesReceived = 0;
  private readonly countingSince = Date.now();
  private reconnectAttempts = 0;
  private consecutiveFailures = 0;
  private intentionalClose = false;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ReconnectingWebSocketClientOptions) {
    this.options = options;
    this.endpoint = options.url;
  }

  connect(): void {
    this.intentionalClose = false;
    this.openSocket();
  }

  stop(): void {
    this.intentionalClose = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    this.state = 'closed';
  }

  /** Move the existing subscriptions to a standby provider without opening two sockets. */
  switchEndpoint(endpoint: string): void {
    if (this.endpoint === endpoint) return;
    this.endpoint = endpoint;
    this.clearTimers();
    const old = this.socket;
    this.socket = null;
    old?.close();
    this.reconnectAttempts = 0;
    this.consecutiveFailures = 0;
    if (!this.intentionalClose) this.openSocket();
  }

  send(payload: unknown): void {
    if (this.socket && this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  getHealth(): ConnectionHealth {
    const minutes = Math.max((Date.now() - this.countingSince) / 60_000, 1 / 60);
    return {
      state: this.state,
      lastMessageAt: this.lastMessageAt ? new Date(this.lastMessageAt).toISOString() : null,
      consecutiveFailures: this.consecutiveFailures,
      bytesReceived: this.bytesReceived,
      countingSince: new Date(this.countingSince).toISOString(),
      mbPerMinute: Number((this.bytesReceived / 1024 / 1024 / minutes).toFixed(3)),
    };
  }

  // ── Internal ──

  private openSocket(): void {
    this.state = this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting';

    const socket = new WebSocketImpl(this.endpoint, this.options.protocols, {
      headers: this.options.headers,
    });
    this.socket = socket;

    socket.on('open', () => { if (this.socket === socket) this.handleOpen(); });
    socket.on('message', (data) => { if (this.socket === socket) this.handleMessage(data); });
    socket.on('pong', () => {
      if (this.socket !== socket) return;
      this.clearPongTimeout();
      // A pong is proof of life too. Without this, a healthy but quiet socket
      // tripped the silent-connection watchdog: once subscriptions were scoped
      // to watched mints, a minute without trades on those tokens is ordinary,
      // and Helius was torn down and re-subscribed for it ("no messages for
      // 68952ms"). Birdeye, watching one quiet mint, looped the same way every
      // ~90s.
      this.lastMessageAt = Date.now();
    });
    socket.on('close', (code, reasonBuf) => { if (this.socket === socket) this.handleClose(code, reasonBuf.toString()); });
    socket.on('error', (err) => {
      // Provider error strings can echo credential-bearing WSS URLs.
      logger.warn(`[${this.options.name}] WebSocket error`, { type: err.name });
      // 'close' fires after 'error' for ws; reconnect scheduling happens there.
    });
  }

  private handleOpen(): void {
    logger.info(`[${this.options.name}] WebSocket connected`);
    this.state = 'open';
    this.openedAt = Date.now();
    this.lastMessageAt = this.openedAt;
    this.startHeartbeat();
    this.startWatchdog();
    this.options.onOpen?.();
  }

  private handleMessage(data: WebSocketImpl.RawData): void {
    this.lastMessageAt = Date.now();
    this.bytesReceived += rawDataLength(data);
    // Any inbound frame proves the connection is alive, so it answers the
    // outstanding ping as well as a pong would. Without this a busy socket was
    // killed for being busy: under the program sweep (~460 frames/s) the pong
    // queued behind data frames past the 10s timeout, and Helius was torn down
    // and re-subscribed 30 times in 13 minutes while delivering continuously.
    this.clearPongTimeout();
    try {
      this.options.onMessage(data.toString());
    } catch (err) {
      logger.warn(`[${this.options.name}] onMessage handler threw`, {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private handleClose(code: number, reason: string): void {
    this.clearTimers();
    this.socket = null;

    if (this.intentionalClose) {
      this.state = 'closed';
      return;
    }

    // A TCP handshake alone is not a healthy subscription. Providers can open
    // and immediately close repeatedly (including quota/auth failures).
    if (this.openedAt && Date.now() - this.openedAt > 60_000) {
      this.consecutiveFailures = 0;
      this.reconnectAttempts = 0;
    }
    this.consecutiveFailures += 1;
    this.openedAt = null;
    logger.warn(`[${this.options.name}] WebSocket closed`, { code, consecutiveFailures: this.consecutiveFailures });
    this.options.onClose?.(code, reason ? 'provider closed connection' : '');

    if (this.consecutiveFailures >= DEGRADED_AFTER_CONSECUTIVE_FAILURES
      && this.consecutiveFailures % DEGRADED_AFTER_CONSECUTIVE_FAILURES === 0) {
      this.options.onDegraded?.(`${this.consecutiveFailures} consecutive connection failures (last close code ${code})`);
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.state = 'reconnecting';
    const exponential = Math.min(BASE_BACKOFF_MS * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    const jitterFactor = 0.8 + Math.random() * 0.4; // ±20%
    const delay = Math.round(exponential * jitterFactor);
    this.reconnectAttempts += 1;

    logger.info(`[${this.options.name}] reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.socket || this.socket.readyState !== this.socket.OPEN) return;
      this.socket.ping();
      this.pongTimeoutTimer = setTimeout(() => {
        logger.warn(`[${this.options.name}] pong timeout — forcing reconnect`);
        this.socket?.terminate();
      }, PONG_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  private startWatchdog(): void {
    this.watchdogTimer = setInterval(() => {
      if (!this.lastMessageAt) return;
      const silentFor = Date.now() - this.lastMessageAt;
      if (silentFor > SILENT_CONNECTION_TIMEOUT_MS) {
        logger.warn(`[${this.options.name}] no messages for ${silentFor}ms — forcing reconnect`);
        this.socket?.terminate();
      }
    }, SILENT_CONNECTION_TIMEOUT_MS / 2);
  }

  private clearPongTimeout(): void {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.clearPongTimeout();
    this.heartbeatTimer = null;
    this.watchdogTimer = null;
    this.reconnectTimer = null;
  }
}
