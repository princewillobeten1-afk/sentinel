import { chainEventId } from './event-identity';

export interface TapeTrade {
  eventId?: string;
  signature: string;
  mint: string;
  wallet: string | null;
  side: 'BUY' | 'SELL';
  amountUsd: number | null;
  amountSol: number | null;
  amountTokens: number | null;
  priceUsd: number | null;
  timestamp: string;
  isMev: boolean;
  source: string;
}

/** The captured `amount` is tokens, not USD; derive notional only from two measured legs. */
export function measuredTradeUsd(amount: unknown, price: unknown): number | null {
  const tokens = typeof amount === 'number' ? amount : typeof amount === 'string' && amount.trim() ? Number(amount) : NaN;
  const unitPrice = typeof price === 'number' ? price : typeof price === 'string' && price.trim() ? Number(price) : NaN;
  const notional = tokens * unitPrice;
  return Number.isFinite(notional) && tokens >= 0 && unitPrice >= 0 ? notional : null;
}

const groupKey = (trade: TapeTrade) => `${trade.signature}:${trade.mint}:${trade.side}`;
const identity = (trade: TapeTrade) => trade.eventId ?? chainEventId({
  signature: trade.signature, mint: trade.mint, kind: trade.side,
}) ?? groupKey(trade);

/**
 * An indexed history row without instruction position is an aggregate. A
 * captured exact fill supersedes that aggregate without copying its total
 * amount onto each individual fill.
 */
export function mergeTradeTape(history: TapeTrade[], captured: TapeTrade[]): TapeTrade[] {
  const historicalGroups = new Map<string, TapeTrade>();
  for (const trade of history) {
    const key = groupKey(trade);
    if (!historicalGroups.has(key)) historicalGroups.set(key, { ...trade, eventId: identity(trade) });
  }
  const capturedEvents = new Map<string, TapeTrade>();
  for (const trade of captured) {
    const key = groupKey(trade);
    const historical = historicalGroups.get(key);
    historicalGroups.delete(key);
    const eventId = identity(trade);
    const aggregate = eventId.endsWith(':aggregate');
    const merged = aggregate && historical
      ? { ...historical, ...trade,
        wallet: trade.wallet ?? historical.wallet,
        amountUsd: trade.amountUsd ?? historical.amountUsd,
        amountSol: trade.amountSol ?? historical.amountSol,
        amountTokens: trade.amountTokens ?? historical.amountTokens,
        priceUsd: trade.priceUsd ?? historical.priceUsd,
        eventId }
      : { ...trade, eventId };
    capturedEvents.set(eventId, merged);
  }
  return [...historicalGroups.values(), ...capturedEvents.values()];
}
