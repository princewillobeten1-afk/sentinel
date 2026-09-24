import 'server-only';
import { ApiError } from '@/lib/server/errors';

export const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export interface TradingRpcConfig { primary: string; fallback?: string }
export function tradingRpcConfig(): TradingRpcConfig {
  const primary = process.env.SOLANA_TRADING_RPC_URL?.trim() || process.env.HELIUS_RPC_URL?.trim()
    || (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(process.env.HELIUS_API_KEY.trim())}` : '');
  if (!primary || process.env.SOLANA_TRADING_ENABLED !== 'true')
    throw new ApiError('Solana swap broadcasting is not configured or is disabled.', 503, 'TRADING_NOT_CONFIGURED');
  const fallback = process.env.SOLANA_TRADING_FALLBACK_RPC_URL?.trim()
    || process.env.QUICKNODE_SOLANA_RPC_URL?.trim() || undefined;
  for (const endpoint of [primary, fallback].filter(Boolean) as string[]) {
    try { if (new URL(endpoint).protocol !== 'https:') throw new Error(); }
    catch { throw new ApiError('Trading RPC must be a valid HTTPS endpoint.', 503, 'TRADING_NOT_CONFIGURED'); }
  }
  return { primary, fallback: fallback === primary ? undefined : fallback };
}

/** Never propagate provider URLs/error bodies: they may contain credentials. */
export class TradingRpcError extends Error {
  constructor(public code: string, message: string, public definitive = false) { super(message); }
}
const verified = new Map<string, number>();
async function rpc<T>(endpoint: string, method: string, params: unknown[] = []): Promise<T> {
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (!response.ok) throw new TradingRpcError('RPC_UNAVAILABLE', `Trading provider unavailable (HTTP ${response.status}).`);
    const body = await response.json();
    if (body?.error) {
      // Only explicit preflight/signature rejection proves this attempt did not land.
      const rejected = method === 'sendTransaction' && [-32002, -32003, -32602].includes(body.error.code);
      throw new TradingRpcError(rejected ? 'PREFLIGHT_REJECTED' : 'RPC_UNAVAILABLE',
        rejected ? 'The signed transaction failed provider preflight.' : 'Trading provider could not complete the request.', rejected);
    }
    if (body?.jsonrpc !== '2.0' || !Object.prototype.hasOwnProperty.call(body, 'result'))
      throw new TradingRpcError('RPC_INVALID_RESPONSE', 'Trading provider returned an invalid response.');
    return body.result as T;
  } catch (error) {
    if (error instanceof TradingRpcError) throw error;
    throw new TradingRpcError('RPC_UNAVAILABLE', 'Trading provider timed out or is unreachable.');
  }
}
async function assertMainnet(endpoint: string) {
  if ((verified.get(endpoint) ?? 0) > Date.now()) return;
  if (await rpc<string>(endpoint, 'getGenesisHash') !== MAINNET_GENESIS)
    throw new TradingRpcError('WRONG_NETWORK', 'Swap provider is not Solana mainnet. No transaction was sent.', true);
  verified.set(endpoint, Date.now() + 60_000);
}
export async function tradingRpc<T>(method: 'getBlockHeight' | 'isBlockhashValid' | 'simulateTransaction' | 'getFeeForMessage' | 'getSignatureStatuses' | 'getTransaction', params: unknown[] = []): Promise<T> {
  const config = tradingRpcConfig();
  let lastError: unknown;
  for (const endpoint of [config.primary, config.fallback].filter(Boolean) as string[]) {
    try { await assertMainnet(endpoint); return await rpc<T>(endpoint, method, params); }
    catch (error) { lastError = error; }
  }
  throw lastError;
}
export async function checkTradingRpc(): Promise<void> {
  const height = await tradingRpc<number>('getBlockHeight', [{ commitment: 'confirmed' }]);
  if (!Number.isSafeInteger(height) || height <= 0) throw new TradingRpcError('RPC_INVALID_RESPONSE', 'Invalid provider block height.');
}

/** A fallback resends IDENTICAL signed bytes. Never rebuild or re-sign after an uncertain send. */
export async function broadcastSignedTransaction(base64: string, expectedSignature: string): Promise<{ accepted: boolean; reason?: string }> {
  const config = tradingRpcConfig();
  let attempted = false;
  for (const endpoint of [config.primary, config.fallback].filter(Boolean) as string[]) {
    try {
      await assertMainnet(endpoint);
      attempted = true;
      const signature = await rpc<string>(endpoint, 'sendTransaction', [base64, {
        encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3,
      }]);
      if (signature !== expectedSignature) return { accepted: false, reason: 'Provider returned a different signature. Check the original transaction status.' };
      return { accepted: true };
    } catch (error) {
      // Even a later provider's preflight rejection cannot disprove an earlier ambiguous submission.
      if (error instanceof TradingRpcError && error.definitive && !config.fallback) throw error;
    }
  }
  if (!attempted) throw new TradingRpcError('RPC_UNAVAILABLE', 'No verified mainnet provider is available.');
  return { accepted: false, reason: 'Broadcast result is uncertain. Track the existing signature; do not create another trade.' };
}
export function resetTradingRpcForTests() { verified.clear(); }
