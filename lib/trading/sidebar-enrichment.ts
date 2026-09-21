import 'server-only';
import { PublicKey } from '@solana/web3.js';
import { env } from '@/lib/server/env';
import { dbPool } from '@/lib/server/db/pool';
import { updateTokenCard } from '@/lib/market/live/card-cache';
import { marketRpc } from './wallet-position';
import { measuredNumber, type TradeSidebarSnapshot } from './sidebar-model';
import { evidence, readProvider, failureReason, ProviderReadError } from './provider-read';
import { saveTokenCardEvidence } from '@/lib/server/db/token-card-evidence-repository';

type Extras = Pick<TradeSidebarSnapshot, 'funding' | 'fundingEvidence' | 'devBalanceSol' | 'devBalanceEvidence' | 'imageReuse'>;
const state = new Map<string, { expires: number; identity: string; fields: Extras }>();
const pending = new Set<string>();
const fundingCache = new Map<string, { expires: number; funding: TradeSidebarSnapshot['funding']; evidence: NonNullable<TradeSidebarSnapshot['fundingEvidence']> }>();

export function parseFunding(body: any): TradeSidebarSnapshot['funding'] {
  const amount = measuredNumber(body?.amount);
  const timestamp = measuredNumber(body?.timestamp);
  if (body?.mint !== 'So11111111111111111111111111111111111111112' || amount === null || amount < 0 || timestamp === null || timestamp <= 0
    || typeof body?.signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(body.signature)) return null;
  try { new PublicKey(body.funder); } catch { return null; }
  return { address: body.funder, amountSol: amount, signature: body.signature, fundedAt: new Date(timestamp * 1000).toISOString(),
    ...(typeof body.funderName === 'string' ? {name: body.funderName.slice(0, 80)} : {}) };
}
async function creatorFunding(creator: string) {
  const cached = fundingCache.get(creator); if (cached && cached.expires > Date.now()) return cached;
  let result;
  try {
    if (!env.HELIUS_API_KEY) throw new ProviderReadError('Helius Wallet API key is not configured.');
    const body = await readProvider('Helius Wallet API', `https://api.helius.xyz/v1/wallet/${creator}/funded-by`, {headers: {'X-Api-Key':env.HELIUS_API_KEY}});
    const funding = parseFunding(body);
    if (!funding) throw new ProviderReadError('No verifiable SOL funding transaction was returned.');
    result = { funding, evidence: evidence('helius-funded-by', 86400_000), expires: Date.now() + 86400_000 };
  } catch (error) {
    result = { funding: null, evidence: evidence('helius-funded-by', 900_000, failureReason(error)), expires: Date.now() + 900_000 };
  }
  if (fundingCache.size >= 200) fundingCache.delete(fundingCache.keys().next().value!);
  fundingCache.set(creator, result); return result;
}
export async function findImageMatches(mint: string, imageUrl?: string): Promise<NonNullable<TradeSidebarSnapshot['imageReuse']>> {
  const coverage = 'indexed-exact-url' as const;
  if (!imageUrl) return { matches: [], coverage, evidence: evidence('sentinel-image-index', 300_000, 'Token image URL is unavailable.') };
  try {
    // Exact URL match in our observed token index, not a claim of visual similarity
    // or a full-chain image search. URLs are query parameters, never fetched here.
    const result = await dbPool.query<{mint: string; name?: string; symbol?: string}>(
      'SELECT mint, name, symbol FROM realtime_tokens WHERE image_url = $1 AND mint <> $2 ORDER BY updated_at DESC LIMIT 20', [imageUrl, mint]);
    return { matches: result.rows, coverage, evidence: evidence('sentinel-image-index', 300_000) };
  } catch { return { matches: [], coverage, evidence: evidence('sentinel-image-index', 60_000, 'Image index database is unavailable.') }; }
}

/** Bounded off-response enrichment; completion is sent over the existing card channel. */
export function queueSidebarEnrichment(mint: string, creator?: string, imageUrl?: string): Extras {
  const identity = `${creator ?? ''}:${imageUrl ?? ''}`;
  const previous = state.get(mint);
  if (previous?.identity === identity && previous.expires > Date.now()) return previous.fields;
  if (!pending.has(mint) && pending.size < 40) {
    pending.add(mint);
    void (async () => {
      const fields: Extras = {};
      await Promise.all([
        (async () => {
          if (!creator) { fields.funding = null; fields.devBalanceSol = null; fields.fundingEvidence = evidence('helius-funded-by', 60_000, 'Creator address is unavailable.'); return; }
          const funding = await creatorFunding(creator);
          fields.funding = funding.funding; fields.fundingEvidence = funding.evidence;
        })(),
        (async () => {
          try {
            if (!creator) throw new ProviderReadError('Creator address is unavailable.');
            const rpc = marketRpc(); if (!rpc) throw new ProviderReadError('Helius mainnet RPC is not configured.');
            fields.devBalanceSol = (await rpc.getBalance(new PublicKey(creator), 'confirmed')) / 1e9;
            fields.devBalanceEvidence = evidence('helius-confirmed-balance', 60_000);
          } catch (error) { fields.devBalanceSol = null; fields.devBalanceEvidence = evidence('helius-confirmed-balance', 60_000, failureReason(error)); }
        })(),
        (async () => { fields.imageReuse = await findImageMatches(mint, imageUrl); })(),
      ]);
      if (state.size >= 200) state.delete(state.keys().next().value!);
      state.set(mint, {identity, fields, expires: Date.now() + 60_000});
      const observedAt = new Date().toISOString();
      updateTokenCard(mint, fields, 'sidebar-enrichment', 'fresh', observedAt);
      void saveTokenCardEvidence(mint, 'creator', {
        funding: fields.funding ?? null,
        fundingEvidence: fields.fundingEvidence ?? null,
        devBalanceSol: fields.devBalanceSol ?? null,
        devBalanceEvidence: fields.devBalanceEvidence ?? null,
        imageReuse: fields.imageReuse ?? null,
      }, observedAt);
    })().catch(() => {}).finally(() => pending.delete(mint));
  }
  if (previous?.identity === identity) return previous.fields;
  return { funding: null, devBalanceSol: null,
    fundingEvidence: {...evidence('helius-funded-by', 60_000), status:'loading'},
    devBalanceEvidence: {...evidence('helius-confirmed-balance', 60_000), status:'loading'} };
}
