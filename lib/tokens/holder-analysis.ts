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
export const PROGRAM_OWNERS: Record<string, string> = {
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: 'Raydium CLMM',
  CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C: 'Raydium CPMM',
  '5Q544f49q3yBo65jCEX2FsD1VQr6V92hr1ip2mVi3FPp': 'Raydium Authority',
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: 'Orca Whirlpool',
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun Curve',
  Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1: 'Pump.fun Migration',
  Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB: 'Meteora Dynamic',
  '24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi': 'Meteora Pool',
  PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY: 'Phoenix DEX',
  /** Set by the caller when an account matches a pool address it already knows. */
  KNOWN_POOL: 'Liquidity Pool',
};

/** Known exchange hot wallets and burn addresses in the Solana ecosystem. */
export const KNOWN_ENTITIES: Record<string, string> = {
  // Binance
  '51yZyDSnec4xnUv7XLRVYcDyV4x3wUtzrDcRaYbmQU5j': 'Binance',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM': 'Binance',
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S': 'Binance',
  DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy: 'Binance',
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mB72z9ErHzTMRy': 'Binance',
  // Bybit
  AC5RDfQFmDS1deWZos921qbhirGLCMPKdYC4rxMDCgok: 'Bybit',
  // Coinbase
  H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS: 'Coinbase',
  '2AQdpHJ2JpcEggnATmTmxdMv976DScJQdMp2WnZ6EscU': 'Coinbase',
  GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE: 'Coinbase',
  // OKX
  '5VCwKtCXgCJ6kit5FybXjvriW3xJMsFD8wCWDcXJxzkB': 'OKX',
  // Kraken
  FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5: 'Kraken',
  // Gate.io
  u6PJ8DtQuPFnfmwHbGFULQ4u4Egsv226AJfHA1MwxV6: 'Gate.io',
  // MEXC
  ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ: 'MEXC',
  // Burn / Inactive
  '11111111111111111111111111111111': 'Burn 🔥',
  '1nc1nerator11111111111111111111111111111111': 'Incinerator 🔥',
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
  /** Set only when the caller positively identified this as a pool account or known entity. */
  poolLabel: string | null;
  isPool: boolean;
}

export interface HolderConcentration {
  holders: HolderRow[];
  /**
   * Combined share of the top ten, excluding any account identified as a pool or burn.
   */
  top10Pct: number | null;
  /** Combined share of the top ten as returned, pools included. */
  top10IncludingPoolsPct: number | null;
  totalSupply: number | null;
  totalHolders: null;
}

/**
 * Builds the ranked holder table, aggregating token accounts by unique owning wallet.
 */
export function buildHolderConcentration(
  accounts: RawLargestAccount[],
  totalSupply: number | null,
  ownerByTokenAccount: Record<string, string | undefined> = {},
  ownerProgramByTokenAccount: Record<string, string | undefined> = {},
): HolderConcentration {
  // Aggregate multiple token accounts belonging to the same wallet owner
  const walletMap = new Map<string, {
    owner: string;
    tokenAccounts: string[];
    totalBalance: number;
    poolLabel: string | null;
    isPool: boolean;
    firstIndex: number;
  }>();

  accounts.forEach((account, idx) => {
    const rawBal = Number(account.uiAmountString ?? account.uiAmount ?? 0);
    const balance = Number.isFinite(rawBal) ? Math.max(0, rawBal) : 0;
    const owner = ownerByTokenAccount[account.address] || account.address;

    const programId = ownerProgramByTokenAccount[account.address];
    const programLabel = programId ? (PROGRAM_OWNERS[programId] ?? programId) : (PROGRAM_OWNERS[owner] ?? null);
    const entityTag = KNOWN_ENTITIES[owner] ?? KNOWN_ENTITIES[account.address] ?? null;

    const isPool = Boolean(
      programLabel ||
      (entityTag && (entityTag.includes('Pool') || entityTag.includes('AMM') || entityTag.includes('Curve')))
    );
    const poolLabel = programLabel || entityTag;

    const existing = walletMap.get(owner);
    if (existing) {
      existing.totalBalance += balance;
      existing.tokenAccounts.push(account.address);
      if (!existing.poolLabel && poolLabel) {
        existing.poolLabel = poolLabel;
        existing.isPool = isPool;
      }
    } else {
      walletMap.set(owner, {
        owner,
        tokenAccounts: [account.address],
        totalBalance: balance,
        poolLabel,
        isPool,
        firstIndex: idx,
      });
    }
  });

  // Sort unique wallets descending by aggregate balance; tie-break by original order
  const sorted = [...walletMap.values()].sort((a, b) => {
    if (b.totalBalance !== a.totalBalance) return b.totalBalance - a.totalBalance;
    return a.firstIndex - b.firstIndex;
  });

  const rows: HolderRow[] = sorted.map((w, index) => ({
    rank: index + 1,
    address: w.owner,
    tokenAccount: w.tokenAccounts[0] || w.owner,
    balance: w.totalBalance,
    percent:
      totalSupply && totalSupply > 0 && Number.isFinite(w.totalBalance)
        ? Number(((w.totalBalance / totalSupply) * 100).toFixed(4))
        : null,
    poolLabel: w.poolLabel,
    isPool: w.isPool,
  }));

  const sumPct = (list: HolderRow[]) => {
    const known = list.filter((r) => r.percent !== null);
    if (known.length === 0) return null;
    return Number(known.reduce((total, r) => total + (r.percent ?? 0), 0).toFixed(2));
  };

  const nonPoolNonBurn = rows.filter((r) => !r.isPool && !r.poolLabel?.includes('Burn'));

  return {
    holders: rows,
    top10Pct: sumPct(nonPoolNonBurn.slice(0, 10)),
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
 * Fetches the verified on-chain total supply for a mint directly from Solana RPC.
 */
export async function fetchOnChainTokenSupply(rpcUrl: string, mint: string): Promise<number | null> {
  const supplyResult = await rpc<{ value?: { uiAmountString?: string; uiAmount?: number } }>(
    rpcUrl,
    'getTokenSupply',
    [mint],
  );
  const supplyRaw = Number(supplyResult?.value?.uiAmountString ?? supplyResult?.value?.uiAmount);
  return Number.isFinite(supplyRaw) && supplyRaw > 0 ? supplyRaw : null;
}

/**
 * Fetches concentration for a mint, or null when the chain could not answer.
 */
export async function fetchHolderConcentration(
  rpcUrl: string,
  mint: string,
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

  // Resolve every account owner in one batch call
  const owners = await rpc<{
    value?: Array<{ owner?: string; data?: { parsed?: { info?: { owner?: string } } } } | null>;
  }>(rpcUrl, 'getMultipleAccounts', [accounts.map((a) => a.address), { encoding: 'jsonParsed' }]);

  const ownerByTokenAccount: Record<string, string | undefined> = {};
  const ownerProgramByTokenAccount: Record<string, string | undefined> = {};

  (owners?.value ?? []).forEach((entry, index) => {
    const tokenAccount = accounts[index]?.address;
    if (!tokenAccount || !entry) return;
    const owner = entry.data?.parsed?.info?.owner;
    if (owner) {
      ownerByTokenAccount[tokenAccount] = owner;
    }
  });

  // Label known pool addresses provided by caller
  const pools = new Set(poolAddresses.map((p) => p.toLowerCase()));
  for (const account of accounts) {
    const owner = ownerByTokenAccount[account.address];
    if (pools.has(account.address.toLowerCase()) || (owner && pools.has(owner.toLowerCase()))) {
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
