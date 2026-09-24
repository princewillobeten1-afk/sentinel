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
  private failures = 0;
  private pausedUntil = 0;
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

  /** Helius stays primary; QuickNode is attempted only after a transport/read failure. */
  async read<T>(primaryEndpoint: string, operation: (rpc: Connection) => Promise<T>): Promise<{ value: T; source: RpcSource }> {
    let primaryError: unknown;
    if (primaryEndpoint) {
      try {
        return { value: await operation(this.connection(primaryEndpoint)), source: 'helius' };
      } catch (error) {
        primaryError = error;
      }
    }
    try {
      const rpc = await this.verifiedConnection();
      const value = await operation(rpc);
      this.success();
      return { value, source: 'quicknode' };
    } catch {
      this.failure();
      if (primaryError) throw primaryError;
      throw new Error('No healthy mainnet RPC provider is available.');
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

  /** A WSS failover is allowed only after the paired HTTPS endpoint proves mainnet. */
  async websocketEndpoint(): Promise<string | null> {
    const value = process.env.QUICKNODE_SOLANA_WSS_URL?.trim();
    if (!value || !this.endpoint()) return null;
    try {
      const url = new URL(value);
      const rpcUrl = new URL(this.endpoint()!);
      if (url.protocol !== 'wss:' || !url.hostname || url.hostname !== rpcUrl.hostname) return null;
      await this.verifiedConnection();
      return value;
    } catch {
      return null;
    }
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
    };
  }
}

const globalForQuickNode = globalThis as unknown as { quickNodeService?: QuickNodeService };
export const quickNodeService = globalForQuickNode.quickNodeService ?? new QuickNodeService();
if (process.env.NODE_ENV !== 'production') globalForQuickNode.quickNodeService = quickNodeService;
