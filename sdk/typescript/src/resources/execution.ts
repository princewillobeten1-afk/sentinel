import type { SentinelClient } from '../client';

export interface ExecutionRequestInput {
  wallet?: string;
  chain?: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  side?: 'BUY' | 'SELL';
  orderType?: 'MARKET' | 'LIMIT';
  slippageLimit?: number;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  executionPolicy?: string;
  mevPreference?: string;
}

export interface PrepareTransactionInput {
  quoteId: string;
  inputToken: string;
  outputToken: string;
  amount: string;
  slippage: number;
  walletAddress: string;
}

/**
 * Execution — quotes, preflight simulation and trade submission
 * (`app/api/v1/execution/**`, `app/api/v1/trading/prepare`). All backed by a
 * simulated fill engine this pass, never a real DEX integration — see
 * `docs/api/execution.md`.
 *
 * `quote`, `simulate` and `submit` (and `prepare`) are deliberately separate
 * methods, none calling another internally: a caller must explicitly choose
 * to submit, and the server independently re-enforces the `TRADE` scope on
 * every write regardless of what the SDK does (spec §60 — quoting a trade
 * must never be able to silently execute one).
 */
export class ExecutionResource {
  constructor(private readonly client: SentinelClient) {}

  /** Read-only price discovery — does not execute anything. */
  quote(request: ExecutionRequestInput): Promise<{ quotes: unknown[] }> {
    return this.client.post('/api/v1/execution/quote', request);
  }

  /** Dry-run preflight against a previously fetched quote — does not execute anything. */
  simulate(quote: unknown, wallet?: string): Promise<Record<string, unknown>> {
    return this.client.post('/api/v1/execution/simulate', { quote, wallet });
  }

  /**
   * Actually executes the trade. Requires the dangerous `TRADE` scope (never
   * auto-granted) and an `idempotencyKey` is strongly recommended so a
   * retried submit after a network timeout can't double-execute.
   */
  submit(quote: unknown, request: ExecutionRequestInput, idempotencyKey?: string): Promise<Record<string, unknown>> {
    return this.client.post('/api/v1/execution/submit', { quote, request }, { idempotencyKey });
  }

  /**
   * Prepares an unsigned transaction for the caller's own wallet to sign
   * client-side (`app/api/v1/trading/prepare`) — the web app's own trading
   * panel uses this same endpoint. Requires `TRADE`.
   */
  prepare(input: PrepareTransactionInput, idempotencyKey?: string): Promise<{ preparedTransaction: Record<string, unknown> }> {
    return this.client.post('/api/v1/trading/prepare', input, { idempotencyKey });
  }
}
