import 'server-only';
import { Connection, PublicKey } from '@solana/web3.js';
import { env } from '@/lib/server/env';
import { acquireBirdeyeSlot } from '@/lib/market/enrichment/birdeye-limiter';
import { measuredNumber, type TradeWalletPosition } from './sidebar-model';
import { evidence, readProvider, failureReason, ProviderReadError } from './provider-read';

const cached = new Map<string, { expires: number; value: TradeWalletPosition }>();
const inFlight = new Map<string, Promise<TradeWalletPosition>>();
export function marketRpc(): Connection | null {
  const endpoint = env.HELIUS_RPC_URL || (env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}` : '');
  return endpoint ? new Connection(endpoint, { commitment: 'confirmed', disableRetryOnRateLimit: true,
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }) }) : null;
}

/** Bind responses to both wallet AND mint; all-time WAC is an estimate with provider coverage limitations. */
export function parseWalletPnl(body: any, wallet: string, mint: string) {
  const data = body?.success === true ? body.data : null;
  if (data?.meta?.address !== wallet || data.meta.currency?.toUpperCase() !== 'USD' || !data.tokens?.[mint]) return null;
  const token = data.tokens[mint];
  return { boughtUsd: measuredNumber(token.cashflow_usd?.total_invested), soldUsd: measuredNumber(token.cashflow_usd?.total_sold),
    holdingUsd: measuredNumber(token.cashflow_usd?.current_value), pnlUsd: measuredNumber(token.pnl?.total_usd) };
}

export async function getTradeWalletPosition(wallet: string, mint: string): Promise<TradeWalletPosition> {
  const key = `${wallet}:${mint}`;
  const hit = cached.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const pending = inFlight.get(key); if (pending) return pending;
  const work = load(wallet, mint).then(value => {
    if (cached.size >= 200) cached.delete(cached.keys().next().value!);
    cached.set(key, { value, expires: Date.now() + 15_000 }); return value;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, work); return work;
}
async function load(wallet: string, mint: string): Promise<TradeWalletPosition> {
  const balanceSource = 'helius-confirmed-token-accounts';
  const pnlSource = 'birdeye-wallet-pnl:all-time-wac';
  const output: TradeWalletPosition = { wallet, mint, quantity: null, balanceSol: null, boughtUsd: null, soldUsd: null, holdingUsd: null, pnlUsd: null,
    balanceEvidence: evidence(balanceSource, 15_000, 'Balance unavailable.'), pnlEvidence: evidence(pnlSource, 30_000, 'PnL unavailable.') };
  await Promise.all([
    (async () => {
      try {
        const rpc = marketRpc(); if (!rpc) throw new ProviderReadError('Helius mainnet RPC is not configured.');
        const owner = new PublicKey(wallet);
        const [accounts, balance] = await Promise.all([rpc.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(mint) }, 'confirmed'), rpc.getBalance(owner, 'confirmed')]);
        const amounts = accounts.value.map(account => measuredNumber(account.account.data.parsed?.info?.tokenAmount?.uiAmountString));
        if (amounts.some(amount => amount === null)) throw new ProviderReadError('Token account balance could not be decoded.');
        output.quantity = amounts.reduce<number>((sum, amount) => sum + amount!, 0);
        output.balanceSol = balance / 1e9;
        output.balanceEvidence = evidence(balanceSource, 15_000);
      } catch (error) { output.balanceEvidence = evidence(balanceSource, 30_000, failureReason(error)); }
    })(),
    (async () => {
      try {
        if (!env.BIRDEYE_API_KEY) throw new ProviderReadError('Birdeye API key is not configured.');
        await acquireBirdeyeSlot('audit');
        const body = await readProvider('Birdeye wallet PnL', `https://public-api.birdeye.so/wallet/v2/pnl?wallet=${wallet}&token_addresses=${mint}&pnl_method=wac`,
          { headers: { 'X-API-KEY': env.BIRDEYE_API_KEY, 'x-chain': 'solana' } });
        const pnl = parseWalletPnl(body, wallet, mint);
        if (!pnl) throw new ProviderReadError('Birdeye returned no matching wallet/token PnL.');
        Object.assign(output, pnl);
        output.pnlEvidence = { ...evidence(pnlSource, 30_000), reason: 'All-time weighted-average-cost estimate. Provider protocol history may be incomplete; not a guaranteed realized return.' };
      } catch (error) { output.pnlEvidence = evidence(pnlSource, 30_000, failureReason(error)); }
    })(),
  ]);
  return output;
}
