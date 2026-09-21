/**
 * Pure mapping from each trade indexer's payload to one trade shape.
 *
 * Split out of `trade-history.ts` because that module carries
 * `import 'server-only'`, which cannot be loaded under the test runner — and
 * these are exactly the lines worth pinning: they are where each provider's
 * field names are interpreted, and a wrong reading (buy/sell, which side the
 * token is on) is silent.
 */

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export interface HistoricalTrade {
  signature: string;
  side: 'BUY' | 'SELL';
  wallet: string | null;
  amountUsd: number | null;
  amountSol: number | null;
  amountTokens: number | null;
  priceUsd: number | null;
  timestamp: string;
  /** Jupiter flags sandwich/MEV legs; they are real trades but not demand. */
  isMev: boolean;
  source: 'jupiter' | 'geckoterminal';
}

export interface JupiterTx {
  type?: string;
  usdVolume?: number;
  traderAddress?: string;
  txHash?: string;
  isMev?: boolean;
  isValidPrice?: boolean;
  nativeVolume?: number;
  timestamp?: string;
  usdPrice?: number;
  amount?: number;
}

/** Exported for tests: the one place Jupiter's field names are interpreted. */
export function mapJupiterTx(tx: JupiterTx): HistoricalTrade | null {
  if (!tx.txHash || !tx.timestamp || (tx.type !== 'buy' && tx.type !== 'sell')) return null;
  return {
    signature: tx.txHash,
    side: tx.type === 'buy' ? 'BUY' : 'SELL',
    wallet: tx.traderAddress ?? null,
    amountUsd: num(tx.usdVolume),
    amountSol: num(tx.nativeVolume),
    amountTokens: num(tx.amount),
    // Jupiter marks prices it could not validate; showing one would be showing
    // a number the source itself does not stand behind.
    priceUsd: tx.isValidPrice === false ? null : num(tx.usdPrice),
    timestamp: tx.timestamp,
    isMev: tx.isMev === true,
    source: 'jupiter',
  };
}

export interface GeckoTrade {
  attributes?: {
    kind?: string;
    tx_hash?: string;
    tx_from_address?: string;
    block_timestamp?: string;
    volume_in_usd?: string;
    from_token_address?: string;
    to_token_address?: string;
    from_token_amount?: string;
    to_token_amount?: string;
    price_from_in_usd?: string;
    price_to_in_usd?: string;
  };
}

/**
 * Exported for tests. Reads which side of the pair the token is on from the
 * addresses, rather than assuming buy means "from SOL".
 */
export function mapGeckoTrade(trade: GeckoTrade, mint: string): HistoricalTrade | null {
  const a = trade.attributes;
  if (!a?.tx_hash || !a.block_timestamp || (a.kind !== 'buy' && a.kind !== 'sell')) return null;

  const tokenIsFrom = a.from_token_address === mint;
  const tokenIsTo = a.to_token_address === mint;
  if (!tokenIsFrom && !tokenIsTo) return null;

  const counterMint = tokenIsFrom ? a.to_token_address : a.from_token_address;
  const counterAmount = num(tokenIsFrom ? a.to_token_amount : a.from_token_amount);

  return {
    signature: a.tx_hash,
    side: a.kind === 'buy' ? 'BUY' : 'SELL',
    wallet: a.tx_from_address ?? null,
    amountUsd: num(a.volume_in_usd),
    // Only a SOL leg is a SOL amount; a USDC-quoted pool leaves this unknown.
    amountSol: counterMint === WSOL_MINT ? counterAmount : null,
    amountTokens: num(tokenIsFrom ? a.from_token_amount : a.to_token_amount),
    priceUsd: num(tokenIsFrom ? a.price_from_in_usd : a.price_to_in_usd),
    timestamp: a.block_timestamp,
    isMev: false,
    source: 'geckoterminal',
  };
}
