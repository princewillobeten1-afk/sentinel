import { isCreationTransaction, nativeSolDeltas, pickTrader, traderDeltasByMint,
  WSOL_MINT, STABLE_MINTS, type TokenBalanceEntry } from './trade-derivation';
import { isSolanaMint } from '@/lib/market/chart-model';

export interface QuickNodeChartTrade {
  mint: string;
  poolAddress: string;
  signature: string;
  slot: number;
  observedAt: number;
  priceUsd: number;
}

/** Ignore the many pool-touching account setups and fee transfers before
 * spending an RPC read on a candidate trade. Final balance checks remain the
 * authority; an instruction name alone never becomes a candle. */
export function isChartSwapLog(logs: unknown): boolean {
  return Array.isArray(logs) && logs.some(line => typeof line === 'string'
    && /^Program log: Instruction: (?:Buy|Sell|Swap|Trade)[A-Za-z0-9_]*\s*$/i.test(line));
}

function amount(entry: TokenBalanceEntry): number | null {
  const raw = entry.uiTokenAmount?.amount;
  const decimals = entry.uiTokenAmount?.decimals;
  if (typeof raw === 'string' && /^\d+$/.test(raw) && Number.isInteger(decimals) && decimals! >= 0 && decimals! <= 18) {
    const value = Number(raw) / 10 ** decimals!;
    return Number.isFinite(value) ? value : null;
  }
  const value = entry.uiTokenAmount?.uiAmount;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function balances(value: unknown): TokenBalanceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is TokenBalanceEntry => entry && typeof entry === 'object')
    .map(entry => ({ ...entry, uiTokenAmount: { ...entry.uiTokenAmount, uiAmount: amount(entry) } }));
}

/** A confirmed, parsed QuickNode transaction can price a direct pool trade.
 * Complex multi-asset routes, unpriced quotes and missing balance evidence are skipped. */
export function parseQuickNodeChartTrade(
  message: unknown, mint: string, poolAddress: string, quoteMint: string,
  solPriceUsd: number | null, observedAt: number,
): QuickNodeChartTrade | null {
  if (!isSolanaMint(mint) || !isSolanaMint(poolAddress) || !isSolanaMint(quoteMint)
    || quoteMint === mint || !Number.isFinite(observedAt) || observedAt <= 0) return null;
  const result = (message as any)?.params?.result;
  const value = result?.value;
  const tx = value?.transaction?.transaction;
  const meta = value?.transaction?.meta;
  const keys = tx?.message?.accountKeys as Array<{ pubkey?: string; signer?: boolean } | string> | undefined;
  const signature = value?.signature;
  const slot = value?.slot ?? result?.context?.slot;
  if (typeof signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)
    || !Number.isInteger(slot) || slot <= 0
    || value?.err || meta?.err || !meta || !Array.isArray(keys)
    || !keys.some(key => (typeof key === 'string' ? key : key.pubkey) === poolAddress)
    || isCreationTransaction(meta.logMessages)) return null;
  const pre = balances(meta.preTokenBalances);
  const post = balances(meta.postTokenBalances);
  if (!pre.length && !post.length) return null;
  // PumpSwap and similar pools expose both token vaults with the pool as the
  // token-account owner. These deltas price the actual pool fill even when a
  // router/relayer holds the trader's counter-asset in intermediate accounts.
  const poolDeltas = traderDeltasByMint(pre, post, poolAddress);
  const poolSubject = poolDeltas.get(mint);
  const poolQuote = poolDeltas.get(quoteMint);
  if (poolSubject && poolQuote && Math.sign(poolSubject) !== Math.sign(poolQuote)) {
    const quoteUsd = STABLE_MINTS.has(quoteMint) ? Math.abs(poolQuote)
      : quoteMint === WSOL_MINT && solPriceUsd !== null && solPriceUsd > 0
        ? Math.abs(poolQuote) * solPriceUsd : null;
    const priceUsd = quoteUsd === null ? null : quoteUsd / Math.abs(poolSubject);
    if (priceUsd !== null && Number.isFinite(priceUsd) && priceUsd > 0)
      return { mint, poolAddress, signature, slot, observedAt, priceUsd };
  }
  const trader = pickTrader(keys, pre, post);
  if (!trader) return null;
  const deltas = traderDeltasByMint(pre, post, trader);
  const subject = deltas.get(mint);
  if (!subject || !Number.isFinite(subject)) return null;
  // A routed transaction can trade several non-quote assets. Without a
  // per-instruction pool fill, attributing its net wallet price to this pool
  // would be misleading.
  if ([...deltas].some(([asset, delta]) => delta !== 0 && asset !== mint && asset !== WSOL_MINT && !STABLE_MINTS.has(asset))) return null;
  let quoteUsd: number | null = null;
  const quoteDelta = deltas.get(quoteMint);
  if (quoteMint !== WSOL_MINT && STABLE_MINTS.has(quoteMint) && quoteDelta && Math.sign(quoteDelta) !== Math.sign(subject)) {
    quoteUsd = Math.abs(quoteDelta);
  } else if (quoteMint === WSOL_MINT && solPriceUsd !== null && solPriceUsd > 0) {
    let solAmount = quoteDelta && Math.sign(quoteDelta) !== Math.sign(subject) ? Math.abs(quoteDelta) : 0;
    if (!solAmount) {
      const native = nativeSolDeltas(keys, meta.preBalances, meta.postBalances, trader);
      const poolDelta = native.get(poolAddress);
      if (poolDelta && Math.sign(poolDelta) === Math.sign(subject)) solAmount = Math.abs(poolDelta);
    }
    if (solAmount > 0) quoteUsd = solAmount * solPriceUsd;
  }
  if (quoteUsd === null || !Number.isFinite(quoteUsd) || quoteUsd <= 0) return null;
  const priceUsd = quoteUsd / Math.abs(subject);
  return Number.isFinite(priceUsd) && priceUsd > 0
    ? { mint, poolAddress, signature, slot, observedAt, priceUsd } : null;
}
