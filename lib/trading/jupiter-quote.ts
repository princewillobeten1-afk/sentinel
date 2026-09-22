/**
 * Real swap quotes from Jupiter's public quote API.
 *
 * ## What this replaces
 *
 * `lib/quote/router.ts` applied a **single hardcoded exchange rate** to every
 * pair it was asked about:
 *
 *     const rate = isBuySol ? new Decimal('41.304347826086956521') : ...
 *
 * That constant is why the trade panel offered to take 0.5 SOL and return
 * "20.6522 SOL" — 0.5 x 41.3043 — a quote that paid SOL to receive SOL, at a
 * rate belonging to a token called SENTINEL that does not exist on-chain.
 *
 * Jupiter's `/swap/v1/quote` is keyless, answers in about two seconds, and
 * returns the route it would actually take. Verified during implementation:
 * 0.1 SOL quoted to 9.603429 USDC at a SOL price near $96.
 *
 * ## Amounts are atomic, and that matters
 *
 * The API takes and returns **raw** amounts — lamports for SOL, and the token's
 * own decimals otherwise. Passing a UI amount straight through would quote a
 * billion-fold error, so conversion goes through `toAtomic`/`fromAtomic` and
 * uses BigInt, never floating point, for the integer side.
 */

const JUPITER_QUOTE_URL = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_URL = 'https://lite-api.jup.ag/swap/v1/swap';
const TOKEN_LOOKUP_URL = 'https://lite-api.jup.ag/tokens/v2/search';
const REQUEST_TIMEOUT_MS = 10_000;

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface JupiterQuoteRoute {
  swapInfo?: { label?: string; ammKey?: string };
  percent?: number;
}

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct?: string;
  routePlan?: JupiterQuoteRoute[];
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  /** UI-scale amounts, as decimal strings. */
  inputAmount: string;
  outputAmount: string;
  /** Worst-case output at the requested slippage. */
  minimumReceived: string;
  /** Price impact as a percentage, or null when Jupiter did not report one. */
  priceImpactPct: number | null;
  slippageBps: number;
  /** Venue labels along the route, e.g. ["Raydium CLMM"]. */
  route: string[];
  /** Implied unit price of the input token in output-token terms. */
  rate: string;
  fetchedAt: string;
  providerQuote: JupiterQuoteResponse;
}

/** UI amount -> atomic units, without floating-point drift. */
export function toAtomic(amount: string | number, decimals: number): bigint {
  const text = typeof amount === 'number' ? amount.toFixed(decimals) : amount.trim();
  if (!/^\d*\.?\d*$/.test(text) || text === '' || text === '.') {
    throw new Error(`Not a valid amount: ${String(amount)}`);
  }
  const [whole = '0', frac = ''] = text.split('.');
  // Pad or truncate the fraction to exactly `decimals` digits. Truncation is
  // correct here: quoting more precision than the mint supports would be
  // rejected on-chain anyway.
  const scaled = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(scaled || '0');
}

/** Atomic units -> UI amount string, trimmed of trailing zeros. */
export function fromAtomic(raw: string | bigint, decimals: number): string {
  const value = typeof raw === 'bigint' ? raw : BigInt(raw);
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === 0n) return whole.toString();
  const fracText = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracText}`;
}

/** Turns Jupiter's raw response into UI-scale figures. */
export function toSwapQuote(
  raw: JupiterQuoteResponse,
  inputDecimals: number,
  outputDecimals: number,
): SwapQuote {
  const inputAmount = fromAtomic(raw.inAmount, inputDecimals);
  const outputAmount = fromAtomic(raw.outAmount, outputDecimals);

  const impact = Number(raw.priceImpactPct);
  const inNum = Number(inputAmount);
  const outNum = Number(outputAmount);

  return {
    inputMint: raw.inputMint,
    outputMint: raw.outputMint,
    inputAmount,
    outputAmount,
    minimumReceived: fromAtomic(raw.otherAmountThreshold, outputDecimals),
    // Absent stays null rather than becoming 0 — "no impact measured" and
    // "zero impact" are different claims, and the second is a strong one.
    priceImpactPct: Number.isFinite(impact) ? impact : null,
    slippageBps: raw.slippageBps,
    route: (raw.routePlan ?? [])
      .map((leg) => leg.swapInfo?.label)
      .filter((label): label is string => Boolean(label)),
    rate: inNum > 0 && Number.isFinite(outNum) ? String(outNum / inNum) : '0',
    fetchedAt: new Date().toISOString(),
    providerQuote: raw,
  };
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Jupiter responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getSwapTransaction(params: {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
}): Promise<{ swapTransaction: string; lastValidBlockHeight: number; prioritizationFeeLamports?: number }> {
  const response = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });
  const body = await response.json().catch(() => null) as {
    swapTransaction?: string;
    lastValidBlockHeight?: number;
    prioritizationFeeLamports?: number;
    error?: string;
  } | null;
  if (!response.ok || !body?.swapTransaction || !Number.isFinite(body.lastValidBlockHeight)) {
    throw new Error(body?.error || `Jupiter swap preparation failed (${response.status})`);
  }
  return {
    swapTransaction: body.swapTransaction,
    lastValidBlockHeight: body.lastValidBlockHeight as number,
    prioritizationFeeLamports: body.prioritizationFeeLamports,
  };
}

const decimalsCache = new Map<string, number>();

/**
 * A mint's decimals, needed before any amount can be converted.
 *
 * Guessing 9 (SOL's) for an unknown mint would misquote by orders of magnitude
 * on the many SPL tokens that use 6, so an unresolvable mint is an error rather
 * than a default.
 */
export async function getMintDecimals(mint: string): Promise<number> {
  if (mint === SOL_MINT) return 9;
  const cached = decimalsCache.get(mint);
  if (cached !== undefined) return cached;

  const body = (await getJson(`${TOKEN_LOOKUP_URL}?query=${encodeURIComponent(mint)}`)) as
    | Array<{ id?: string; decimals?: number }>
    | { tokens?: Array<{ id?: string; decimals?: number }> };

  const list = Array.isArray(body) ? body : (body?.tokens ?? []);
  const match = list.find((t) => t.id === mint) ?? list[0];
  if (!match || typeof match.decimals !== 'number') {
    throw new Error(`Could not resolve decimals for mint ${mint}`);
  }
  decimalsCache.set(mint, match.decimals);
  return match.decimals;
}

/**
 * Quotes a swap. Throws rather than returning a fabricated fallback — a wrong
 * quote on the screen where money is committed is worse than no quote.
 */
export async function getSwapQuote(params: {
  inputMint: string;
  outputMint: string;
  /** UI-scale amount of the input token. */
  amount: string | number;
  slippageBps?: number;
}): Promise<SwapQuote> {
  const { inputMint, outputMint, amount, slippageBps = 50 } = params;

  if (inputMint === outputMint) {
    // The old router happily quoted this, which is how "0.5 SOL -> 20.65 SOL"
    // reached the screen.
    throw new Error('Input and output mints are the same');
  }

  const [inputDecimals, outputDecimals] = await Promise.all([
    getMintDecimals(inputMint),
    getMintDecimals(outputMint),
  ]);

  const atomic = toAtomic(amount, inputDecimals);
  if (atomic <= 0n) throw new Error('Amount must be greater than zero');

  const url =
    `${JUPITER_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${atomic.toString()}&slippageBps=${slippageBps}`;

  const raw = (await getJson(url)) as JupiterQuoteResponse;
  if (!raw?.outAmount) throw new Error('Jupiter returned no route for this pair');

  return toSwapQuote(raw, inputDecimals, outputDecimals);
}
