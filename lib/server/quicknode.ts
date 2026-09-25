import 'server-only';

import { Connection } from '@solana/web3.js';
import { MAINNET_GENESIS } from '@/lib/trading/solana-rpc';

type RpcSource = 'helius' | 'quicknode';
const VERIFY_TTL_MS = 60_000;
const COOLDOWN_MS = 30_000;

/** Only server code may import this service; endpoint URLs are never returned in health. */
export class QuickNodeService {
  private verifiedUntil = 0;
  private verifiedUrl = '';
  private lastVerifiedAt = 0;
  private failures = 0;
  private pausedUntil = 0;
  private primaryPausedUntil = 0;
  private lastSuccessAt: string | null = null;
  private lastFailureAt: string | null = null;

  private endpoint(): string | null {
    const value = process.env.QUICKNODE_SOLANA_RPC_URL?.trim();
    if (!value) return null;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname) return value;
    } catch { /* Invalid configuration is unavailable, never sent to fetch. */ }
    return null;
  }

  private connection(endpoint: string): Connection {
    return new Connection(endpoint, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
    });
  }

  private async verifiedConnection(): Promise<Connection> {
    const endpoint = this.endpoint();
    if (!endpoint) throw new Error('QuickNode mainnet RPC is not configured.');
    if (Date.now() < this.pausedUntil) throw new Error('QuickNode RPC is temporarily unavailable.');
    const rpc = this.connection(endpoint);
    if (this.verifiedUrl !== endpoint || Date.now() >= this.verifiedUntil) {
      try {
        if (await rpc.getGenesisHash() !== MAINNET_GENESIS) {
          throw new Error('QuickNode RPC is not connected to Solana mainnet.');
        }
        this.verifiedUrl = endpoint;
        this.lastVerifiedAt = Date.now();
        this.verifiedUntil = Date.now() + VERIFY_TTL_MS;
      } catch (error) {
        throw error instanceof Error && error.message.includes('not connected to Solana mainnet')
          ? error : new Error('QuickNode mainnet verification failed.');
      }
    }
    return rpc;
  }

  private failure(): void {
    this.failures += 1;
    this.lastFailureAt = new Date().toISOString();
    if (this.failures >= 3) this.pausedUntil = Date.now() + COOLDOWN_MS;
  }

  private success(): void {
    this.failures = 0;
    this.pausedUntil = 0;
    this.lastSuccessAt = new Date().toISOString();
  }

  private pausePrimary(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (/429|max usage reached|rate.?limit|quota/i.test(message)) {
      this.primaryPausedUntil = Date.now() + (/max usage reached|quota/i.test(message) ? 5 * 60_000 : 60_000);
    }
  }

  /** Helius stays primary; QuickNode is attempted after a transport/read failure. */
  async read<T>(primaryEndpoint: string, operation: (rpc: Connection, source: RpcSource) => Promise<T>): Promise<{ value: T; source: RpcSource }> {
    let primaryError: unknown;
    if (primaryEndpoint && Date.now() >= this.primaryPausedUntil) {
      try {
        return { value: await operation(this.connection(primaryEndpoint), 'helius'), source: 'helius' };
      } catch (error) {
        primaryError = error;
        this.pausePrimary(error);
      }
    }
    const wasPaused = Date.now() < this.pausedUntil;
    try {
      const rpc = await this.verifiedConnection();
      const value = await operation(rpc, 'quicknode');
      this.success();
      return { value, source: 'quicknode' };
    } catch {
      // A cooldown is a refusal to try, not another provider failure. Counting
      // it as one extended the cooldown forever under a 15-second worker poll.
      if (!wasPaused) this.failure();
      if (primaryError) throw primaryError;
      throw new Error('No healthy mainnet RPC provider is available.');
    }
  }


  /** Small JSON-RPC reads used by migration proof recovery. Null results are
   * retried on the other mainnet provider; a quota-paused primary is skipped. */
  async rpcResult<T>(primaryEndpoint: string, method: string, params: unknown[], timeoutMs = 8_000): Promise<T | null> {
    const payload = { jsonrpc: '2.0', id: 1, method, params };
    if (primaryEndpoint && Date.now() >= this.primaryPausedUntil) {
      try {
        const response = await fetch(primaryEndpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(timeoutMs), cache: 'no-store',
        });
        const parsed = await response.json() as { result?: T | null; error?: { message?: string } };
        if (!response.ok || parsed?.error) {
          this.pausePrimary(new Error(`${response.status} ${parsed?.error?.message ?? ''}`));
        } else if (parsed?.result != null) {
          return parsed.result;
        }
      } catch (error) {
        this.pausePrimary(error);
      }
    }
    try {
      const { status, body } = await this.request(payload, timeoutMs);
      const parsed = body as { result?: T | null; error?: unknown } | null;
      return status >= 200 && status < 300 && !parsed?.error ? parsed?.result ?? null : null;
    } catch {
      return null;
    }
  }

  /** Used only to retry the existing bounded getTransaction batch on transport/quota failure. */
  async request(body: unknown, timeoutMs = 8_000): Promise<{ status: number; body: unknown }> {
    await this.verifiedConnection();
    // The Connection was used for the mainnet genesis check; use the same
    // endpoint for the existing JSON-RPC batch request shape.
    const endpoint = this.endpoint();
    if (!endpoint) throw new Error('QuickNode mainnet RPC is not configured.');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: 'no-store',
      });
      const parsed = await response.json().catch(() => null);
      if (!response.ok || (parsed && typeof parsed === 'object' && 'error' in parsed)) {
        this.failure();
      } else {
        this.success();
      }
      return { status: response.status, body: parsed };
    } catch {
      this.failure();
      throw new Error('QuickNode RPC request failed.');
    }
  }

  /** The chart socket is independent of RPC read cooldowns. Verify its paired
   * endpoint on mainnet once a day, even if other RPC callers are paused. */
  async websocketEndpoint(): Promise<string | null> {
    const value = process.env.QUICKNODE_SOLANA_WSS_URL?.trim();
    const endpoint = this.endpoint();
    if (!value || !endpoint) return null;
    try {
      const url = new URL(value);
      const rpcUrl = new URL(endpoint);
      if (url.protocol !== 'wss:' || !url.hostname || url.hostname !== rpcUrl.hostname) return null;
      if (this.verifiedUrl !== endpoint || Date.now() - this.lastVerifiedAt >= 86_400_000) {
        if (await this.connection(endpoint).getGenesisHash() !== MAINNET_GENESIS) return null;
        this.verifiedUrl = endpoint;
        this.lastVerifiedAt = Date.now();
        this.verifiedUntil = Date.now() + VERIFY_TTL_MS;
      }
      return value;
    } catch {
      return null;
    }
  }

  /** Bounded chart reads are governed by the chart coordinator, not the
   * general-purpose RPC failover cooldown. The endpoint must already have
   * passed the paired mainnet check before any transaction is retrieved. */
  async chartTransaction(signature: string): Promise<unknown | null> {
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) return null;
    const endpoint = this.endpoint();
    if (!endpoint || (this.verifiedUrl !== endpoint || Date.now() - this.lastVerifiedAt >= 86_400_000)
      && !await this.websocketEndpoint()) return null;
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [signature,
        { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 1 }] }),
      signal: AbortSignal.timeout(8_000), cache: 'no-store',
    });
    if (response.status === 429) throw new Error('QuickNode chart RPC is rate-limited.');
    if (!response.ok) throw new Error(`QuickNode chart RPC returned HTTP ${response.status}.`);
    const body = await response.json() as { result?: unknown; error?: { message?: string } };
    if (body.error) throw new Error('QuickNode chart RPC returned an error.');
    return body.result ?? null;
  }

  getHealth() {
    return {
      configured: Boolean(this.endpoint()),
      websocketConfigured: Boolean(process.env.QUICKNODE_SOLANA_WSS_URL?.trim()),
      rpcState: !this.endpoint() ? 'unconfigured' : Date.now() < this.pausedUntil ? 'paused'
        : this.verifiedUrl === this.endpoint() && this.verifiedUntil > Date.now() ? 'verified' : 'unverified',
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      consecutiveFailures: this.failures,
      primaryPaused: Date.now() < this.primaryPausedUntil,
    };
  }
}

const globalForQuickNode = globalThis as unknown as { quickNodeService?: QuickNodeService };
export const quickNodeService = globalForQuickNode.quickNodeService ?? new QuickNodeService();
if (process.env.NODE_ENV !== 'production') globalForQuickNode.quickNodeService = quickNodeService;
