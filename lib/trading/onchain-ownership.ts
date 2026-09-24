import 'server-only';

import { Connection, PublicKey } from '@solana/web3.js';
import { env } from '@/lib/server/env';
import type { HolderProfile } from '@/lib/market/enrichment/holder-profile';
import { measuredNumber } from './sidebar-model';

function rpcUrl(): string {
  return (
    process.env.HELIUS_RPC_URL?.trim() ||
    env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY?.trim() || env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY?.trim() || env.HELIUS_API_KEY}`
      : '') ||
    'https://api.mainnet-beta.solana.com'
  );
}

function connection(endpoint: string): Connection {
  return new Connection(endpoint, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }),
  });
}

export async function fetchOnChainOwnership(
  mint: string,
  devAddress?: string | null,
): Promise<HolderProfile | null> {
  const endpoint = rpcUrl();
  if (!endpoint || !mint) return null;

  try {
    const conn = connection(endpoint);
    const mintPubkey = new PublicKey(mint);

    const [supplyRes, largestRes] = await Promise.allSettled([
      conn.getTokenSupply(mintPubkey),
      conn.getTokenLargestAccounts(mintPubkey),
    ]);

    if (supplyRes.status !== 'fulfilled' || largestRes.status !== 'fulfilled') {
      return null;
    }

    const totalSupply = measuredNumber(supplyRes.value.value.uiAmountString ?? supplyRes.value.value.uiAmount);
    const largestAccounts = largestRes.value.value;

    if (!totalSupply || totalSupply <= 0 || !Array.isArray(largestAccounts) || largestAccounts.length === 0) {
      return null;
    }

    const top10Amounts = largestAccounts.slice(0, 10).map(account => measuredNumber(account.uiAmountString ?? account.uiAmount));
    const top10Pct = top10Amounts.every(amount => amount !== null && amount >= 0)
      ? Number((top10Amounts.reduce<number>((sum, amount) => sum + amount!, 0) / totalSupply * 100).toFixed(2))
      : null;

    let devPct: number | null = null;
    if (devAddress) {
      try {
        const devPubkey = new PublicKey(devAddress);
        const devAccounts = await conn.getParsedTokenAccountsByOwner(devPubkey, { mint: mintPubkey }, 'confirmed');
        const balances = devAccounts.value.map(account => measuredNumber(account.account.data.parsed?.info?.tokenAmount?.uiAmountString));
        if (balances.every(balance => balance !== null && balance >= 0)) {
          devPct = Number((balances.reduce<number>((sum, balance) => sum + balance!, 0) / totalSupply * 100).toFixed(2));
        }
      } catch {
        // Dev balance check non-fatal
      }
    }

    return {
      mint,
      top10Pct: top10Pct !== null && top10Pct >= 0 && top10Pct <= 100 ? top10Pct : null,
      totalHolders: null,
      snipersPct: null,
      insidersPct: null,
      bundlersPct: null,
      devPct: devPct !== null && devPct >= 0 && devPct <= 100 ? devPct : null,
      proTraders: null,
      kols: null,
      fetchedAt: Date.now(),
      source: 'solana-rpc-largest-token-accounts',
    };
  } catch {
    return null;
  }
}
