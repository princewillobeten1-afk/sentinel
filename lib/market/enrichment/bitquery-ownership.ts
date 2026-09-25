import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { isSolanaMint } from '@/lib/market/chart-model';
import { acquireBitquerySlot } from '@/lib/market/bitquery-limiter';
import { quickNodeService } from '@/lib/server/quicknode';
import { env } from '@/lib/server/env';
import type { HolderProfile } from './holder-profile';

const ENDPOINT = 'https://streaming.bitquery.io/graphql';
const ROW_LIMIT = 500;
const CACHE_MS = 60_000;
const cache = new Map<string, { until: number; profile: HolderProfile | null }>();
const requests = new Map<string, Promise<HolderProfile | null>>();
let pausedUntil = 0;
let lastError: string | null = null;

type OwnerBalance = { owner: string; balance: number };

/** A balance-update row is only usable after the latest slot is selected. */
export function parseBitqueryOwners(body: unknown): OwnerBalance[] | null {
  const result = body as { errors?: unknown[]; data?: { Solana?: { BalanceUpdates?: unknown } } };
  if (result?.errors?.length || !Array.isArray(result?.data?.Solana?.BalanceUpdates)) return null;
  const seen = new Set<string>();
  const rows: OwnerBalance[] = [];
  for (const item of result.data.Solana.BalanceUpdates) {
    const row = item as { BalanceUpdate?: { Account?: { Owner?: unknown }; balance?: unknown } };
    const owner = row?.BalanceUpdate?.Account?.Owner;
    const raw = row?.BalanceUpdate?.balance;
    const balance = typeof raw === 'number' || typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    if (typeof owner !== 'string' || !isSolanaMint(owner) || seen.has(owner)
      || !Number.isFinite(balance) || balance < 0) return null;
    seen.add(owner);
    rows.push({ owner, balance });
  }
  return rows;
}

/** Reject incomplete eight-hour snapshots before publishing concentration or a holder count. */
export function profileFromBitqueryOwners(
  mint: string, rows: OwnerBalance[], supply: number, devAddress?: string | null,
): HolderProfile | null {
  if (!Number.isFinite(supply) || supply <= 0 || !rows.length || rows.length >= ROW_LIMIT) return null;
  const active = rows.filter(row => row.balance > 0);
  if (!active.length) return null;
  const represented = active.reduce((sum, row) => sum + row.balance, 0);
  // Bitquery V2 sees only recent balance updates. If historical holders are
  // missing, their balances will not reconcile to the independently read
  // on-chain supply; an incomplete subset must never become a reassuring score.
  if (Math.abs(represented - supply) > Math.max(0.000001, supply * 1e-10)) return null;
  const top10 = [...active].sort((a, b) => b.balance - a.balance).slice(0, 10)
    .reduce((sum, row) => sum + row.balance, 0) / supply * 100;
  const dev = devAddress ? active.find(row => row.owner === devAddress) : undefined;
  return {
    mint, source: 'bitquery-balance-updates+solana-rpc-supply',
    top10Pct: Number(top10.toFixed(4)), totalHolders: active.length,
    devPct: devAddress ? Number(((dev?.balance ?? 0) / supply * 100).toFixed(4)) : null,
    snipersPct: null, insidersPct: null, bundlersPct: null, proTraders: null, kols: null,
    fetchedAt: Date.now(),
  };
}

function queryFor(mint: string): string {
  return `query SentinelRecentOwners {
    Solana {
      BalanceUpdates(
        orderBy: { descendingByField: "BalanceUpdate_balance_maximum" }
        limit: { count: ${ROW_LIMIT} }
        where: { BalanceUpdate: { Currency: { MintAddress: { is: ${JSON.stringify(mint)} } } },
          Transaction: { Result: { Success: true } } }
      ) { BalanceUpdate { Account { Owner } balance: PostBalance(maximum: Block_Slot) } }
    }
  }`;
}

function heliusRpc(): string {
  return env.HELIUS_RPC_URL || (env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}` : '');
}

export async function fetchBitqueryOwnership(mint: string, devAddress?: string | null): Promise<HolderProfile | null> {
  const token = process.env.BITQUERY_ACCESS_TOKEN?.trim();
  if (!token || !isSolanaMint(mint) || Date.now() < pausedUntil) return null;
  const key = `${mint}:${devAddress ?? ''}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.profile;
  const pending = requests.get(key);
  if (pending) return pending;
  const work = (async () => {
    try {
      await acquireBitquerySlot('ownership', AbortSignal.timeout(5_000));
      const [response, supplyResult] = await Promise.all([
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query: queryFor(mint) }),
          cache: 'no-store', signal: AbortSignal.timeout(10_000),
        }),
        quickNodeService.read(heliusRpc(), rpc => rpc.getTokenSupply(new PublicKey(mint))),
      ]);
      if (!response.ok) {
        lastError = `Bitquery ownership HTTP ${response.status}`;
        if ([401, 402, 403, 429].includes(response.status)) {
          const retry = Number(response.headers.get('retry-after'));
          pausedUntil = Date.now() + (response.status === 429 && Number.isFinite(retry) && retry > 0
            ? Math.min(retry * 1_000, 15 * 60_000) : 60_000);
        }
        return null;
      }
      const owners = parseBitqueryOwners(await response.json());
      const supply = Number(supplyResult.value.value.uiAmountString ?? supplyResult.value.value.uiAmount);
      if (!owners) { lastError = 'Bitquery returned malformed ownership data.'; return null; }
      const profile = profileFromBitqueryOwners(mint, owners, supply, devAddress);
      // A legitimate but incomplete recent snapshot is not a provider error.
      lastError = null;
      cache.set(key, { until: Date.now() + CACHE_MS, profile });
      if (cache.size > 300) cache.delete(cache.keys().next().value!);
      return profile;
    } catch {
      lastError = 'Bitquery ownership or on-chain supply request failed.';
      return null;
    }
  })();
  requests.set(key, work);
  try { return await work; } finally { requests.delete(key); }
}

export function bitqueryOwnershipHealth() {
  return { configured: Boolean(process.env.BITQUERY_ACCESS_TOKEN?.trim()), pausedUntil, lastError, cached: cache.size };
}

export function resetBitqueryOwnershipForTests() {
  cache.clear(); requests.clear(); pausedUntil = 0; lastError = null;
}
