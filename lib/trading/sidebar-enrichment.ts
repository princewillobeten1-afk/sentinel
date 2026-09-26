import 'server-only';
import { Connection, PublicKey } from '@solana/web3.js';
import { env } from '@/lib/server/env';
import { quickNodeService } from '@/lib/server/quicknode';
import { dbPool } from '@/lib/server/db/pool';
import { updateTokenCard } from '@/lib/market/live/card-cache';
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
    // Fall back to on-chain RPC lookup for the earliest transfer to creator
    try {
      const endpoint = env.HELIUS_RPC_URL || (env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}` : '');
      if (!endpoint) throw new ProviderReadError('No RPC endpoint configured for funding lookup.');
      const conn = new Connection(endpoint, {
        commitment: 'confirmed',
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
      });
      const pubkey = new PublicKey(creator);
      const sigs = await conn.getSignaturesForAddress(pubkey, { limit: 100 });
      let found: TradeSidebarSnapshot['funding'] = null;
      if (sigs && sigs.length > 0) {
        const oldest = sigs[sigs.length - 1];
        if (oldest?.signature) {
          const tx = await conn.getParsedTransaction(oldest.signature, { maxSupportedTransactionVersion: 0 });
          const instructions = tx?.transaction?.message?.instructions;
          if (Array.isArray(instructions)) {
            for (const ix of instructions as any[]) {
              if (ix.program === 'system' && (ix.parsed?.type === 'transfer' || ix.parsed?.type === 'createAccount')) {
                const info = ix.parsed?.info;
                if (info?.destination === creator && info?.source && info.source !== creator) {
                  const amountSol = (info.lamports ?? 0) / 1e9;
                  const timestamp = oldest.blockTime ? oldest.blockTime * 1000 : Date.now();
                  found = {
                    address: info.source as string,
                    amountSol,
                    signature: oldest.signature as string,
                    fundedAt: new Date(timestamp).toISOString(),
                  };
                  break;
                }
              }
            }
          }
        }
      }
      if (found) {
        result = { funding: found, evidence: evidence('helius-rpc-funded-by', 86400_000), expires: Date.now() + 86400_000 };
      } else {
        result = { funding: null, evidence: evidence('helius-funded-by', 900_000, failureReason(error)), expires: Date.now() + 900_000 };
      }
    } catch {
      result = { funding: null, evidence: evidence('helius-funded-by', 900_000, failureReason(error)), expires: Date.now() + 900_000 };
    }
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

async function resolveExtras(mint: string, creator?: string, imageUrl?: string): Promise<Extras> {
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
        const endpoint = env.HELIUS_RPC_URL || (env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}` : '');
        if (!endpoint) throw new ProviderReadError('No RPC endpoint configured.');
        const conn = new Connection(endpoint, {
          commitment: 'confirmed',
          fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
        });
        const value = await conn.getBalance(new PublicKey(creator), 'confirmed');
        fields.devBalanceSol = value / 1e9;
        fields.devBalanceEvidence = evidence('helius-confirmed-balance', 60_000);
      } catch (error) { fields.devBalanceSol = null; fields.devBalanceEvidence = evidence('helius-confirmed-balance', 60_000, failureReason(error)); }
    })(),
    (async () => { fields.imageReuse = await findImageMatches(mint, imageUrl); })(),
  ]);
  const observedAt = new Date().toISOString();
  updateTokenCard(mint, fields, 'sidebar-enrichment', 'fresh', observedAt);
  void saveTokenCardEvidence(mint, 'creator', {
    funding: fields.funding ?? null,
    fundingEvidence: fields.fundingEvidence ?? null,
    devBalanceSol: fields.devBalanceSol ?? null,
    devBalanceEvidence: fields.devBalanceEvidence ?? null,
    imageReuse: fields.imageReuse ?? null,
  }, observedAt);
  return fields;
}

export async function enrichSidebar(mint: string, creator?: string, imageUrl?: string): Promise<Extras> {
  const identity = `${creator ?? ''}:${imageUrl ?? ''}`;
  const previous = state.get(mint);
  if (previous?.identity === identity && previous.expires > Date.now()) return previous.fields;
  const fields = await resolveExtras(mint, creator, imageUrl);
  if (state.size >= 200) state.delete(state.keys().next().value!);
  state.set(mint, { identity, fields, expires: Date.now() + 60_000 });
  return fields;
}

/** Bounded off-response enrichment; completion is sent over the existing card channel. */
export function queueSidebarEnrichment(mint: string, creator?: string, imageUrl?: string): Extras {
  const identity = `${creator ?? ''}:${imageUrl ?? ''}`;
  const previous = state.get(mint);
  if (previous?.identity === identity && previous.expires > Date.now()) return previous.fields;
  if (!pending.has(mint) && pending.size < 40) {
    pending.add(mint);
    void resolveExtras(mint, creator, imageUrl).then((fields) => {
      if (state.size >= 200) state.delete(state.keys().next().value!);
      state.set(mint, { identity, fields, expires: Date.now() + 60_000 });
    }).catch(() => {}).finally(() => pending.delete(mint));
  }
  if (previous?.identity === identity) return previous.fields;
  return { funding: null, devBalanceSol: null,
    fundingEvidence: {...evidence('helius-funded-by', 60_000), status:'loading'},
    devBalanceEvidence: {...evidence('helius-confirmed-balance', 60_000), status:'loading'} };
}
