import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { env } from '@/lib/server/env';
import { quickNodeService } from '@/lib/server/quicknode';
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

export async function fetchOnChainOwnership(
  mint: string,
  devAddress?: string | null,
): Promise<HolderProfile | null> {
  const endpoint = rpcUrl();
  if ((!endpoint && !quickNodeService.getHealth().configured) || !mint) return null;

  try {
    const mintPubkey = new PublicKey(mint);
    let devPubkey: PublicKey | null = null;
    if (devAddress) {
      try { devPubkey = new PublicKey(devAddress); } catch { /* Unknown dev share must not hide top-10 data. */ }
    }
    const { value: chain, source } = await quickNodeService.read(endpoint, async conn => {
      const supply = await conn.getTokenSupply(mintPubkey);
      const devAccounts = devPubkey
        ? await conn.getParsedTokenAccountsByOwner(devPubkey, { mint: mintPubkey }, 'confirmed').catch(() => null)
        : null;
      return { supply, devAccounts };
    });

    const totalSupply = measuredNumber(chain.supply.value.uiAmountString ?? chain.supply.value.uiAmount);

    let devPct: number | null = null;
    if (totalSupply && totalSupply > 0 && chain.devAccounts) {
      try {
        const balances = chain.devAccounts.value.map(account => measuredNumber(account.account.data.parsed?.info?.tokenAmount?.uiAmountString));
        if (balances.every(balance => balance !== null && balance >= 0)) {
          devPct = Number((balances.reduce<number>((sum, balance) => sum + balance!, 0) / totalSupply * 100).toFixed(2));
        }
      } catch {
        // Dev balance check non-fatal
      }
    }

    return {
      mint,
      // getTokenLargestAccounts returns token accounts, not unique holders, and
      // cannot identify pool or burn accounts. Do not present that sum as a
      // holder concentration measurement.
      top10Pct: null,
      totalHolders: null,
      snipersPct: null,
      insidersPct: null,
      bundlersPct: null,
      devPct: devPct !== null && devPct >= 0 && devPct <= 100 ? devPct : null,
      proTraders: null,
      kols: null,
      fetchedAt: Date.now(),
      source: source === 'quicknode' ? 'quicknode-rpc-supply'
        : (env.HELIUS_RPC_URL || env.HELIUS_API_KEY) ? 'helius-rpc-supply'
          : 'solana-rpc-supply',
    };
  } catch {
    return null;
  }
}
