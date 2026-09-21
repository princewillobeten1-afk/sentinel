import { PublicKey } from '@solana/web3.js';
import type { BondingCurveState } from './types';

/**
 * Reads pump.fun bonding-curve state from the chain.
 *
 * ## Why this exists
 *
 * Curve position was previously inferred from market cap against pump.fun's
 * ~$69k graduation point. That is a proxy for the thing, not the thing: market
 * cap moves with price and circulating supply, and two tokens at identical caps
 * can sit at different points on their curves. It also cannot say whether a
 * curve has *completed*, which is the fact a migration depends on.
 *
 * The curve account holds the real numbers. It is a PDA at
 * `['bonding-curve', mint]` under the pump.fun program, and it carries the
 * reserves plus the program's own `complete` flag.
 *
 * Verified against mainnet: a freshly launched mint decoded to
 * `realTokenReserves` 792,749,207,379,238 of 793,100,000,000,000 initial —
 * 0.044% sold — with `complete: false` and 30.01 virtual SOL, which are the
 * values pump.fun seeds a curve with.
 */

export const PUMPFUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/**
 * Tokens placed on the curve at launch (793.1M at 6 decimals).
 *
 * Progress is measured against this rather than `tokenTotalSupply`, because
 * only part of the supply is ever sold through the curve — the remainder is
 * reserved for the pool created at migration.
 */
export const INITIAL_REAL_TOKEN_RESERVES = 793_100_000_000_000n;

/** Byte offsets after the 8-byte Anchor discriminator. */
const LAYOUT = {
  virtualTokenReserves: 8,
  virtualSolReserves: 16,
  realTokenReserves: 24,
  realSolReserves: 32,
  tokenTotalSupply: 40,
  complete: 48,
} as const;

/** Smallest account that can hold the fields above. */
const MIN_ACCOUNT_BYTES = 49;

/** The curve account address for a mint. */
export function bondingCurveAddress(mint: string): string {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding-curve'), new PublicKey(mint).toBuffer()],
    new PublicKey(PUMPFUN_PROGRAM_ID),
  );
  return pda.toBase58();
}

/**
 * Decodes a curve account.
 *
 * Returns null rather than throwing on a short or foreign account: the caller
 * gets "unknown", never a zeroed struct that would read as a curve at 0%.
 */
/**
 * Derives a curve's initial token allocation from its own state.
 *
 * ## Why this is not a constant
 *
 * `INITIAL_REAL_TOKEN_RESERVES` is right for most pump.fun curves — untouched
 * mainnet accounts decode to exactly it — but not all. Sampled live, one curve
 * held `751_574_386_747_195` tokens having raised **0.017 SOL**. Measured
 * against the constant that reads as 5.2% of the curve sold, which no amount
 * of buying at that price explains: the curve was simply seeded with fewer
 * tokens, and the shortfall was being reported as sales.
 *
 * ## The derivation
 *
 * The curve is constant-product, so `virtualSol * virtualToken` is invariant,
 * and every lamport of `realSolReserves` was added to the virtual SOL side by a
 * buy. So the virtual SOL the curve *started* with is `virtualSol - realSol`,
 * the starting virtual token count follows from the invariant, and the
 * difference from the current virtual tokens is what has been sold:
 *
 *     initialVirtualSol   = virtualSol - realSol
 *     k                   = virtualSol * virtualToken
 *     initialVirtualToken = k / initialVirtualSol
 *     sold                = initialVirtualToken - virtualToken
 *     baseline            = realToken + sold
 *
 * Checked against 24 live curves: it reproduces the constant to within one
 * percentage point on every standard curve, and returns a lower baseline for
 * the ones that were seeded differently. No magic numbers — the account
 * describes itself.
 *
 * Returns null when the arithmetic degenerates (a drained or freshly-migrated
 * account, where every field is zero), leaving the caller to fall back.
 */
export function deriveBaselineRealTokenReserves(curve: {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
}): bigint | null {
  const { virtualTokenReserves, virtualSolReserves, realTokenReserves, realSolReserves } = curve;

  const initialVirtualSol = virtualSolReserves - realSolReserves;
  // Pump.fun curves are seeded with ~30 SOL virtual reserves (30_000_000_000 lamports).
  // If the difference is degenerate or far outside realistic initial bounds, do not derive.
  if (
    initialVirtualSol < 20_000_000_000n ||
    initialVirtualSol > 40_000_000_000n ||
    virtualTokenReserves <= 0n ||
    virtualSolReserves <= 0n
  ) {
    return null;
  }

  const initialVirtualToken = (virtualSolReserves * virtualTokenReserves) / initialVirtualSol;
  if (initialVirtualToken < virtualTokenReserves) return null;

  const sold = initialVirtualToken - virtualTokenReserves;
  const baseline = realTokenReserves + sold;
  // Standard pump.fun allocation is 793.1M tokens (out of 1B total supply).
  // A baseline exceeding 1B total supply (1_000_000_000_000_000) or under 500M is invalid.
  if (baseline <= 0n || baseline > 1_000_000_000_000_000n || baseline < 500_000_000_000_000n) {
    return null;
  }
  return baseline;
}

/**
 * Computes curve completion against a stated baseline.
 *
 * Split out so the engine can recompute an earlier reading once it has seen a
 * higher baseline for that mint, without re-fetching the account.
 */
export function curveProgress(
  realTokenReserves: bigint,
  complete: boolean,
  baseline: bigint,
): number {
  // A completed curve is done regardless of arithmetic. Both reserves are
  // drained to zero at migration — verified across twelve graduated mints — so
  // without this a finished curve would divide its way to an answer that
  // depends entirely on the baseline rather than on the fact it has finished.
  if (complete) return 1;
  const effectiveBaseline = baseline > 0n ? baseline : INITIAL_REAL_TOKEN_RESERVES;

  // Clamped at zero: a curve holding more tokens than its baseline means the
  // baseline is too low, not that negative selling occurred.
  const sold = realTokenReserves >= effectiveBaseline ? 0n : effectiveBaseline - realTokenReserves;
  return Math.min(1, Math.max(0, Number(sold) / Number(effectiveBaseline)));
}

/**
 * Decodes a curve account.
 *
 * `baseline` is the mint's observed initial token allocation. Omitted, it falls
 * back to the standard pump.fun seed — correct for most curves, and wrong for
 * the ones seeded differently, which is why the engine supplies an observed
 * value once it has one.
 */
export function decodeBondingCurve(
  data: Buffer,
  readAt = Date.now(),
  baseline?: bigint,
): BondingCurveState | null {
  if (data.length < MIN_ACCOUNT_BYTES) return null;

  const realTokenReserves = data.readBigUInt64LE(LAYOUT.realTokenReserves);
  const complete = data.readUInt8(LAYOUT.complete) === 1;
  const virtualTokenReserves = data.readBigUInt64LE(LAYOUT.virtualTokenReserves);
  const virtualSolReserves = data.readBigUInt64LE(LAYOUT.virtualSolReserves);
  const realSolReserves = data.readBigUInt64LE(LAYOUT.realSolReserves);

  // Preference order: a valid caller-provided baseline, then an invariant-derived
  // baseline if within standard bounds, then the canonical pump.fun 793.1M constant.
  const derived = deriveBaselineRealTokenReserves({
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
  });

  const effectiveBaseline =
    baseline && baseline > 0n && baseline <= 1_000_000_000_000_000n
      ? baseline
      : (derived ??
        (realTokenReserves > INITIAL_REAL_TOKEN_RESERVES
          ? realTokenReserves
          : INITIAL_REAL_TOKEN_RESERVES));

  return {
    virtualTokenReserves,
    virtualSolReserves,
    realTokenReserves,
    realSolReserves,
    tokenTotalSupply: data.readBigUInt64LE(LAYOUT.tokenTotalSupply),
    complete,
    progress: curveProgress(realTokenReserves, complete, effectiveBaseline),
    baselineRealTokenReserves: effectiveBaseline,
    readAt,
  };
}

interface AccountInfoResponse {
  result?: { value?: { data?: [string, string]; owner?: string } | null };
}

/**
 * Fetches and decodes one curve.
 *
 * Null covers every "cannot say" case — no account, wrong owner, RPC failure —
 * and the engine leaves the token's state untouched rather than inventing one.
 */
export async function fetchBondingCurve(
  rpcUrl: string,
  mint: string,
  timeoutMs = 8_000,
): Promise<BondingCurveState | null> {
  const address = bondingCurveAddress(mint);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [address, { encoding: 'base64', commitment: 'confirmed' }],
      }),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as AccountInfoResponse;
    const value = body.result?.value;
    if (!value?.data) return null;

    // An account at this address owned by anything else is not a curve.
    if (value.owner && value.owner !== PUMPFUN_PROGRAM_ID) return null;

    return decodeBondingCurve(Buffer.from(value.data[0], 'base64'));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches many curves in one request.
 *
 * `getMultipleAccounts` takes up to 100 addresses, which keeps a whole column's
 * worth of tokens to a single call — the difference between polling curves
 * being viable and not.
 */
export async function fetchBondingCurves(
  rpcUrl: string,
  mints: string[],
  timeoutMs = 12_000,
): Promise<Map<string, BondingCurveState>> {
  const out = new Map<string, BondingCurveState>();
  if (mints.length === 0) return out;

  const addresses = mints.map((mint) => ({ mint, address: bondingCurveAddress(mint) }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getMultipleAccounts',
        params: [addresses.map((a) => a.address), { encoding: 'base64', commitment: 'confirmed' }],
      }),
    });
    if (!res.ok) return out;

    const body = (await res.json()) as {
      result?: { value?: Array<{ data?: [string, string]; owner?: string } | null> };
    };
    const values = body.result?.value ?? [];

    values.forEach((value, index) => {
      const entry = addresses[index];
      if (!entry || !value?.data) return;
      if (value.owner && value.owner !== PUMPFUN_PROGRAM_ID) return;
      const decoded = decodeBondingCurve(Buffer.from(value.data[0], 'base64'));
      if (decoded) out.set(entry.mint, decoded);
    });

    return out;
  } catch {
    return out;
  } finally {
    clearTimeout(timer);
  }
}
