import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { marketStreamManager } from '@/lib/market/live/stream-manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/market/live/status
 *
 * Debug/smoke-test surface for the Birdeye + Helius streaming integration.
 * Importing `marketStreamManager` here also guarantees `start()` has run at
 * least once (defense-in-depth alongside instrumentation.ts's boot-time call
 * — start() is idempotent, so this never opens a second connection).
 */
/**
 * Current slot, cached.
 *
 * The footer displayed a hardcoded `289,104,912` as the block height. One
 * `getSlot` every 15 seconds is 0.07 calls/second against the enrichment
 * budget — negligible — and makes the number true. Unknown returns null so the
 * footer can show a dash instead of a literal.
 */
let slotCache: { slot: number; at: number } | null = null;
const SLOT_TTL_MS = 15_000;

async function getCurrentSlot(): Promise<number | null> {
  const now = Date.now();
  if (slotCache && now - slotCache.at < SLOT_TTL_MS) return slotCache.slot;

  const url = process.env.HELIUS_RPC_URL?.trim();
  if (!url) return slotCache?.slot ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot' }),
    });
    if (!res.ok) return slotCache?.slot ?? null;
    const body = (await res.json()) as { result?: number };
    if (typeof body.result !== 'number') return slotCache?.slot ?? null;
    slotCache = { slot: body.result, at: now };
    return body.result;
  } catch {
    return slotCache?.slot ?? null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  try {
    marketStreamManager.start();
    const slot = await getCurrentSlot();
    return jsonResponse({ ...marketStreamManager.getHealth(), slot });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to read stream status', 500));
  }
}
