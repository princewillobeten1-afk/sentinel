/**
 * Real holder concentration, from chain state.
 *
 * ## What this replaces
 *
 * `/api/v1/tokens/:chain/:address/holders` returned a hardcoded array for
 * every token ever requested — "Raydium CPMM Pool 18.42%", "Dev Creator
 * (Vested) 8.00%", named whales with exact balances, all denominated in a
 * `$SENT` token that does not exist. It rendered identically on the Wrapped SOL
 * page, styled the same as real data, with no marker.
 *
 * ## How the real figures are obtained
 *
 * Three RPC calls, all standard:
 *
 *  1. `getTokenSupply` — the denominator.
 *  2. `getTokenLargestAccounts` — the top 20 **token accounts** by balance.
 *  3. `getMultipleAccounts` — resolves each token account to its **owner**.
 *
 * Step 3 matters for honesty. `getTokenLargestAccounts` returns token accounts,
 * not people: one owner can hold several, and an AMM pool appears as a holder.
 * Reporting token accounts as "holders" would overstate dispersion.
 *
 * ## What it does not claim
 *
 * The chain does not label anyone. There is no "Dev Creator", "Whale #1" or
 * "Smart Money" here, because nothing on-chain says so — those were invented.
 *
 * Pools are only labelled when the caller supplies a known pool address. A
 * pool's token account is owned by a program-derived address rather than by the
 * program itself, so an owner-program list cannot recognise one — an earlier
 * attempt to do exactly that matched nothing while the API went on advertising
 * a "top 10 excluding pools" figure that excluded none. An unlabelled row now
 * means "not known to be a pool", never "confirmed to be a wallet".
 *
 * Top-20 is also the ceiling this method can see: the RPC returns no more, so
 * `totalHolders` is unknown from this source and reported as null rather than
 * estimated.
 */

/** Owner programs whose accounts are pools/vaults rather than individuals. */
const PROGRAM_OWNERS: Record<string, string> = {
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: 'Raydium CLMM',
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: 'Orca Whirlpool',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun',
  Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB: 'Meteora',
  /** Set by the caller when an account matches a pool address it already knows. */
  KNOWN_POOL: 'Liquidity pool',
};

export interface RawLargestAccount {
  address: string;
  uiAmount?: number | null;
  uiAmountString?: string;
  amount?: string;
}

export interface HolderRow {
  rank: number;
  /** The owning wallet, when it could be resolved; else the token account. */
  address: string;
  /** The token account itself, always present. */
  tokenAccount: string;
  balance: number;
  /** Share of total supply, or null when supply is unknown. */
  percent: number | null;
  /** Set only when the caller positively identified this as a pool account. */
  poolLabel: string | null;
  isPool: boolean;
}

export interface HolderConcentration {
  holders: HolderRow[];
  /**
   * Combined share of the top ten, excluding any account identified as a pool.
   * Identical to `top10IncludingPoolsPct` when no pool was identified — which
   * is the common case, since identification needs a known pool address.
   */
  top10Pct: number | null;
  /** Combined share of the top ten as returned, pools included. */
  top10IncludingPoolsPct: number | null;
  totalSupply: number | null;
  /**
   * Always null from this source: `getTokenLargestAccounts` caps at 20, so the
   * full holder count is not observable here. Estimating it would be invention.
   */
  totalHolders: null;
}

/**
 * Builds the ranked holder table.
 *
 * Pools are ranked and shown — hiding them would misrepresent where supply
 * sits — and excluded from the headline figure when they could be identified,
 * because liquidity in an AMM is not a holder's position. Both numbers are
 * returned so neither reading is hidden, and equal values mean no pool was
 * identified rather than no pool being present.
 */
export function buildHolderConcentration(
  accounts: RawLargestAccount[],
  totalSupply: number | null,
  ownerByTokenAccount: Record<string, string | undefined> = {},
  ownerProgramByTokenAccount: Record<string, string | undefined> = {},
): HolderConcentration {
  const rows: HolderRow[] = accounts.map((account, index) => {
    const balance = Number(account.uiAmountString ?? account.uiAmount ?? 0);
    const owner = ownerByTokenAccount[account.address];
    const ownerProgram = ownerProgramByTokenAccount[account.address];
    const poolLabel = ownerProgram ? (PROGRAM_OWNERS[ownerProgram] ?? null) : null;

    return {
      rank: index + 1,
      address: owner ?? account.address,
      tokenAccount: account.address,
      balance: Number.isFinite(balance) ? balance : 0,
      percent:
        totalSupply && totalSupply > 0 && Number.isFinite(balance)
          ? (balance / totalSupply) * 100
          : null,
      poolLabel,
      isPool: poolLabel !== null,
    };
  });

  const sumPct = (list: HolderRow[]) => {
    const known = list.filter((r) => r.percent !== null);
    if (known.length === 0) return null;
    return known.reduce((total, r) => total + (r.percent ?? 0), 0);
  };

  return {
    holders: rows,
    top10Pct: sumPct(rows.filter((r) => !r.isPool).slice(0, 10)),
    top10IncludingPoolsPct: sumPct(rows.slice(0, 10)),
    totalSupply,
    totalHolders: null,
  };
}

interface RpcResult<T> {
  result?: T;
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as RpcResult<T>;
    return body.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches concentration for a mint, or null when the chain could not answer.
 *
 * Null is a real outcome and the caller must render it as unknown. The previous
 * implementation could not fail, because it never asked anything.
 */
export async function fetchHolderConcentration(
  rpcUrl: string,
  mint: string,
  /**
   * Known pool addresses for this token, when the caller has them (Jupiter
   * reports `firstPool.id`). Only accounts matching these are labelled as
   * pools — nothing is inferred, so an unlabelled account means "not known to
   * be a pool", never "confirmed to be a wallet".
   */
  poolAddresses: string[] = [],
): Promise<HolderConcentration | null> {
  const [supplyResult, largestResult] = await Promise.all([
    rpc<{ value?: { uiAmountString?: string; uiAmount?: number } }>(rpcUrl, 'getTokenSupply', [mint]),
    rpc<{ value?: RawLargestAccount[] }>(rpcUrl, 'getTokenLargestAccounts', [mint]),
  ]);

  const accounts = largestResult?.value ?? [];
  if (accounts.length === 0) return null;

  const supplyRaw = Number(supplyResult?.value?.uiAmountString ?? supplyResult?.value?.uiAmount);
  const totalSupply = Number.isFinite(supplyRaw) && supplyRaw > 0 ? supplyRaw : null;

  // One call resolves every owner, rather than twenty.
  const owners = await rpc<{
    value?: Array<{ owner?: string; data?: { parsed?: { info?: { owner?: string } } } } | null>;
  }>(rpcUrl, 'getMultipleAccounts', [accounts.map((a) => a.address), { encoding: 'jsonParsed' }]);

  const ownerByTokenAccount: Record<string, string | undefined> = {};
  const ownerProgramByTokenAccount: Record<string, string | undefined> = {};

  (owners?.value ?? []).forEach((entry, index) => {
    const tokenAccount = accounts[index]?.address;
    if (!tokenAccount || !entry) return;
    // `info.owner` is the wallet that owns the token account. Both maps were
    // previously filled from this same field, so the pool check compared a
    // wallet against a list of program ids and never matched — meaning
    // "top 10 excluding pools" silently excluded nothing while claiming to.
    //
    // A pool's token account is owned by a program-derived address, not by the
    // program itself, so a program-id list cannot identify one either. Pool
    // attribution therefore needs the token's known pool address, which this
    // call does not have — see `poolAddresses` on fetchHolderConcentration.
    ownerByTokenAccount[tokenAccount] = entry.data?.parsed?.info?.owner;
  });

  // Label only what the caller could positively identify.
  const pools = new Set(poolAddresses);
  for (const account of accounts) {
    const owner = ownerByTokenAccount[account.address];
    if (pools.has(account.address) || (owner && pools.has(owner))) {
      ownerProgramByTokenAccount[account.address] = 'KNOWN_POOL';
    }
  }

  return buildHolderConcentration(
    accounts,
    totalSupply,
    ownerByTokenAccount,
    ownerProgramByTokenAccount,
  );
}
