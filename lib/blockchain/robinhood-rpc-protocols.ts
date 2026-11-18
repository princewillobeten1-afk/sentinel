import {
  ROBINHOOD_PERMIT2,
  ROBINHOOD_PONS_V2_FACTORY,
  ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
  ROBINHOOD_UNISWAP_V4_POOL_MANAGER,
  ROBINHOOD_USDG_ADDRESS,
  ROBINHOOD_WETH_ADDRESS,
  isEvmAddress,
} from '@/lib/chains/chain-config';
import { robinhoodRpcBatch, robinhoodRpcCall } from '@/lib/blockchain/robinhood-rpc';
import {
  computeV4StateSlot,
  decodeAddressAt,
  decodeUint256At,
  encodeAddress,
  encodeErc20Allowance,
  encodeErc20BalanceOf,
  encodePermit2Allowance,
  strip0x,
  type UniswapV4PoolKey,
} from '@/lib/chains/evm-abi';
import type { TapeTrade } from '@/lib/market/trade-tape';

const USDG_WETH_V3_POOL = '0x52e65b17fb6e5ba00ed806f37afcd2daa50271ca';
const V4_INITIALIZE_TOPIC0 = '0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438';
const V4_SWAP_TOPIC0 = '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f';
const V3_SWAP_TOPIC0 = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
export const PONS_TOKEN_LAUNCHED_TOPIC0 = '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
export const PONS_CURVE_BUY_TOPIC0 = '0xec36bf571f136799e8dc0b0b8bea4b04d8bd3d43de838aab0d5fc21d4cbfc455';
const PONS_CURVE_SELL_TOPIC0 = '0x8113d738abdcb6b38357e9d53a54a7157861a09031b453651f0fe7fe151f59df';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface RpcBatchCallItem {
  method: string;
  params: unknown[];
}

interface RobinhoodProtocolGlobals {
  ponsLaunchedCurveCache?: Map<string, string>;
  ponsLaunchesCache?: {
    lastBlock: number;
    fetchedAt: number;
    records: PonsV2LaunchRecord[];
  };
  ponsLaunchesInFlight?: Promise<PonsV2LaunchRecord[]>;
  v4PoolKeyCache?: Map<string, UniswapV4PoolKey>;
  v4PoolKeyInFlight?: Map<string, Promise<UniswapV4PoolKey | null>>;
  v4ByTokenCache?: Map<string, { at: number; result: UniswapV4LiveState | null }>;
  v4ByTokenInFlight?: Map<string, Promise<UniswapV4LiveState | null>>;
}

const globalForRhProto = globalThis as unknown as {
  __sentinelRhProto?: RobinhoodProtocolGlobals;
};

type InitializedProtoGlobals = Required<
  Pick<
    RobinhoodProtocolGlobals,
    | 'ponsLaunchedCurveCache'
    | 'v4PoolKeyCache'
    | 'v4PoolKeyInFlight'
    | 'v4ByTokenCache'
    | 'v4ByTokenInFlight'
  >
> &
  Pick<RobinhoodProtocolGlobals, 'ponsLaunchesCache' | 'ponsLaunchesInFlight'>;

function getProtoGlobals(): InitializedProtoGlobals {
  if (!globalForRhProto.__sentinelRhProto) {
    globalForRhProto.__sentinelRhProto = {};
  }
  const g = globalForRhProto.__sentinelRhProto;
  g.ponsLaunchedCurveCache ??= new Map();
  g.v4PoolKeyCache ??= new Map();
  g.v4PoolKeyInFlight ??= new Map();
  g.v4ByTokenCache ??= new Map();
  g.v4ByTokenInFlight ??= new Map();
  return g as InitializedProtoGlobals;
}

async function rpcCall<T = unknown>(method: string, params: unknown[]): Promise<T> {
  return robinhoodRpcCall<T>(method, params, { timeoutMs: 8_000 });
}

export async function rpcBatchCalls(calls: RpcBatchCallItem[]): Promise<Array<string | null>> {
  if (calls.length === 0) return [];
  const results = await robinhoodRpcBatch<string>(calls, { timeoutMs: 8_000 });
  return results.map((r) => (typeof r === 'string' ? r : null));
}

let cachedEthUsd: { at: number; priceUsd: number } | null = null;
const ethUsdCacheTtlMs = 15_000;

export async function readOnChainEthUsdPrice(): Promise<number | null> {
  if (cachedEthUsd && Date.now() - cachedEthUsd.at < ethUsdCacheTtlMs) {
    return cachedEthUsd.priceUsd;
  }
  try {
    const [slot0Hex] = await rpcBatchCalls([
      { method: 'eth_call', params: [{ to: USDG_WETH_V3_POOL, data: '0x3850c7bd' }, 'latest'] },
    ]);
    if (!slot0Hex || slot0Hex.length < 66) return cachedEthUsd?.priceUsd ?? null;
    const sqrtPriceX96 = decodeUint256At(slot0Hex, 0);
    if (sqrtPriceX96 <= 0n) return cachedEthUsd?.priceUsd ?? null;
    // USDG/WETH pool has token0=WETH (18 decimals), token1=USDG (6 decimals)
    const ratio = Number(sqrtPriceX96) / 2 ** 96;
    const priceUsd = ratio * ratio * 1e12;
    if (Number.isFinite(priceUsd) && priceUsd > 50 && priceUsd < 100_000) {
      cachedEthUsd = { at: Date.now(), priceUsd };
      return priceUsd;
    }
  } catch {
    // Fall back to last cached ETH/USD
  }
  return cachedEthUsd?.priceUsd ?? null;
}

export interface PonsV2LaunchRecord {
  tokenAddress: string;
  curveAddress: string;
  deployerAddress?: string;
  blockNumber: number;
  txHash: string;
  timestampMs?: number;
}

export interface PonsV2FullCurveState {
  tokenAddress: string;
  curveAddress: string;
  quoteReserveRaw: bigint;
  realQuoteReserveRaw: bigint;
  phantomQuoteRaw: bigint;
  tokenReserveRaw: bigint;
  graduationThresholdRaw: bigint;
  graduated: boolean;
  isNativeQuote: boolean;
  feeBps: number;
  creatorTaxBps: number;
  snipeTaxBps: number;
  deployerAddress: string | null;
  launchedAtSec: number | null;
  progressPct: number;
  totalSupplyRaw: bigint;
  tokenDecimals: number;
  deployerBalanceRaw: bigint;
  curveTokenBalanceRaw: bigint;
  spotPriceInQuote: number;
}

export async function readPonsV2LaunchedCurveByToken(
  tokenAddress: string,
): Promise<string | null> {
  if (!isEvmAddress(tokenAddress)) return null;
  const norm = tokenAddress.toLowerCase();
  const { ponsLaunchedCurveCache } = getProtoGlobals();
  const cached = ponsLaunchedCurveCache.get(norm);
  if (cached) return cached;

  try {
    const [resHex] = await rpcBatchCalls([
      {
        method: 'eth_call',
        params: [
          {
            to: ROBINHOOD_PONS_V2_FACTORY,
            data: `0x3cf28b5a${encodeAddress(norm)}`, // getLaunchedToken(address)
          },
          'latest',
        ],
      },
    ]);
    if (!resHex || resHex.length < 130) return null;
    const returnedToken = decodeAddressAt(resHex, 0);
    const curve = decodeAddressAt(resHex, 1);
    if (
      returnedToken === norm &&
      curve &&
      curve !== ZERO_ADDRESS
    ) {
      const curveLower = curve.toLowerCase();
      ponsLaunchedCurveCache.set(norm, curveLower);
      return curveLower;
    }
  } catch {
    // Not a Pons launch or factory unreachable
  }
  return null;
}

export async function readPonsV2FullCurveState(
  curveAddress: string,
  traderAddress?: string | null,
): Promise<PonsV2FullCurveState | null> {
  if (!isEvmAddress(curveAddress)) return null;
  const curve = curveAddress.toLowerCase();
  const trader = traderAddress && isEvmAddress(traderAddress) ? traderAddress : ZERO_ADDRESS;

  const firstResults = await rpcBatchCalls([
    { method: 'eth_call', params: [{ to: curve, data: '0xfc0c546a' }, 'latest'] }, // 0: token()
    { method: 'eth_call', params: [{ to: curve, data: '0x0902f1ac' }, 'latest'] }, // 1: getReserves()
    { method: 'eth_call', params: [{ to: curve, data: '0x4f1f58fd' }, 'latest'] }, // 2: realQuoteReserve()
    { method: 'eth_call', params: [{ to: curve, data: '0xc57eadfc' }, 'latest'] }, // 3: phantomQuote()
    { method: 'eth_call', params: [{ to: curve, data: '0xcbcb3171' }, 'latest'] }, // 4: tokenReserve()
    { method: 'eth_call', params: [{ to: curve, data: '0x8b0bc501' }, 'latest'] }, // 5: graduationThreshold()
    { method: 'eth_call', params: [{ to: curve, data: '0xe7c2b772' }, 'latest'] }, // 6: graduated()
    { method: 'eth_call', params: [{ to: curve, data: '0xdc08e094' }, 'latest'] }, // 7: isNativeQuote()
    { method: 'eth_call', params: [{ to: curve, data: '0x24a9d853' }, 'latest'] }, // 8: feeBps()
    { method: 'eth_call', params: [{ to: curve, data: '0xc1bb8901' }, 'latest'] }, // 9: creatorTaxBps()
    { method: 'eth_call', params: [{ to: curve, data: `0xd7e1ef39${encodeAddress(trader)}` }, 'latest'] }, // 10: currentSnipeTaxBps(trader)
    { method: 'eth_call', params: [{ to: curve, data: '0xd5f39488' }, 'latest'] }, // 11: deployer()
    { method: 'eth_call', params: [{ to: curve, data: '0xbf56b371' }, 'latest'] }, // 12: launchedAt()
  ]);

  const tokenAddress = decodeAddressAt(firstResults[0], 0);
  if (!tokenAddress || tokenAddress === ZERO_ADDRESS) return null;

  const reservesQuote = decodeUint256At(firstResults[1], 0);
  const reservesTokens = decodeUint256At(firstResults[1], 1);
  const realQuoteReserveRaw = decodeUint256At(firstResults[2], 0);
  const phantomQuoteRaw = decodeUint256At(firstResults[3], 0);
  const tokenReserveRaw = decodeUint256At(firstResults[4], 0) || reservesTokens;
  const graduationThresholdRaw = decodeUint256At(firstResults[5], 0);
  const graduated = decodeUint256At(firstResults[6], 0) !== 0n;
  const isNativeQuote = firstResults[7] ? decodeUint256At(firstResults[7], 0) !== 0n : true;
  const feeBps = Number(decodeUint256At(firstResults[8], 0));
  const creatorTaxBps = Number(decodeUint256At(firstResults[9], 0));
  const snipeTaxBps = Number(decodeUint256At(firstResults[10], 0));
  const deployerAddress = decodeAddressAt(firstResults[11], 0);
  const launchedAtRaw = Number(decodeUint256At(firstResults[12], 0));
  const launchedAtSec = launchedAtRaw > 0 ? launchedAtRaw : null;

  const quoteReserveRaw =
    reservesQuote > 0n ? reservesQuote : phantomQuoteRaw + realQuoteReserveRaw;

  const secondCalls: RpcBatchCallItem[] = [
    { method: 'eth_call', params: [{ to: tokenAddress, data: '0x18160ddd' }, 'latest'] }, // totalSupply()
    { method: 'eth_call', params: [{ to: tokenAddress, data: '0x313ce567' }, 'latest'] }, // decimals()
    { method: 'eth_call', params: [{ to: tokenAddress, data: encodeErc20BalanceOf(curve) }, 'latest'] },
  ];
  if (deployerAddress && deployerAddress !== ZERO_ADDRESS) {
    secondCalls.push({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: encodeErc20BalanceOf(deployerAddress) }, 'latest'],
    });
  }

  const secondResults = await rpcBatchCalls(secondCalls).catch(() => [] as Array<string | null>);
  const totalSupplyRaw = decodeUint256At(secondResults[0], 0);
  const tokenDecimals = Number(decodeUint256At(secondResults[1], 0)) || 18;
  const curveTokenBalanceRaw = decodeUint256At(secondResults[2], 0);
  const deployerBalanceRaw = secondResults[3] ? decodeUint256At(secondResults[3], 0) : 0n;

  const progressPct = graduated
    ? 100
    : graduationThresholdRaw > 0n
      ? Math.min(100, Math.max(0, Number((realQuoteReserveRaw * 10_000n) / graduationThresholdRaw) / 100))
      : 0;

  const quoteNum = Number(quoteReserveRaw) / 1e18;
  const tokenNum = Number(tokenReserveRaw) / 10 ** tokenDecimals;
  const spotPriceInQuote = tokenNum > 0 ? quoteNum / tokenNum : 0;

  return {
    tokenAddress,
    curveAddress: curve,
    quoteReserveRaw,
    realQuoteReserveRaw,
    phantomQuoteRaw,
    tokenReserveRaw,
    graduationThresholdRaw,
    graduated,
    isNativeQuote,
    feeBps: Number.isFinite(feeBps) ? feeBps : 100,
    creatorTaxBps: Number.isFinite(creatorTaxBps) ? creatorTaxBps : 0,
    snipeTaxBps: Number.isFinite(snipeTaxBps) ? snipeTaxBps : 0,
    deployerAddress: deployerAddress && deployerAddress !== ZERO_ADDRESS ? deployerAddress : null,
    launchedAtSec,
    progressPct,
    totalSupplyRaw,
    tokenDecimals,
    deployerBalanceRaw,
    curveTokenBalanceRaw,
    spotPriceInQuote,
  };
}

const PONS_LAUNCHES_TTL_MS = 3_000;
const PONS_LAUNCHES_BUFFER_SIZE = 32;

/** Registers a newly observed Pons V2 launch directly into the in-memory launch cursor cache. */
export function registerObservedPonsLaunch(record: PonsV2LaunchRecord): void {
  if (!record?.tokenAddress || !record?.curveAddress) return;
  const g = getProtoGlobals();
  const prev = g.ponsLaunchesCache;
  const normalized: PonsV2LaunchRecord = {
    ...record,
    tokenAddress: record.tokenAddress.toLowerCase(),
    curveAddress: record.curveAddress.toLowerCase(),
    deployerAddress: record.deployerAddress?.toLowerCase(),
  };
  const existing = prev?.records ?? [];
  const merged = [
    normalized,
    ...existing.filter((r) => r.tokenAddress.toLowerCase() !== normalized.tokenAddress),
  ].slice(0, PONS_LAUNCHES_BUFFER_SIZE);

  g.ponsLaunchesCache = {
    lastBlock: Math.max(prev?.lastBlock ?? 0, normalized.blockNumber || 0),
    fetchedAt: Date.now(),
    records: merged,
  };
}

type RawPonsLaunchLog = {
  address: string;
  topics: string[];
  blockNumber: string;
  transactionHash: string;
};

function decodePonsLaunchLogsNewestFirst(logs: RawPonsLaunchLog[]): PonsV2LaunchRecord[] {
  return logs
    .slice()
    .reverse()
    .map((l): PonsV2LaunchRecord | null => {
      if (!l.topics || l.topics.length < 3) return null;
      return {
        tokenAddress: `0x${l.topics[1].slice(-40).toLowerCase()}`,
        curveAddress: `0x${l.topics[2].slice(-40).toLowerCase()}`,
        deployerAddress: l.topics[3] ? `0x${l.topics[3].slice(-40).toLowerCase()}` : undefined,
        blockNumber: Number.parseInt(l.blockNumber, 16) || 0,
        txHash: l.transactionHash,
      };
    })
    .filter((r): r is PonsV2LaunchRecord => Boolean(r));
}

export async function readRecentPonsV2LaunchesFromRpc(limit = 20): Promise<PonsV2LaunchRecord[]> {
  const g = getProtoGlobals();
  const cached = g.ponsLaunchesCache;
  if (cached && cached.records.length > 0) {
    if (
      Date.now() - cached.fetchedAt >= PONS_LAUNCHES_TTL_MS &&
      !g.ponsLaunchesInFlight
    ) {
      // Trigger incremental catch-up asynchronously; never block discovery HTTP reads
      void fetchOrRefreshPonsLaunches(limit);
    }
    return cached.records.slice(0, limit);
  }

  if (g.ponsLaunchesInFlight) {
    const records = await g.ponsLaunchesInFlight;
    return records.slice(0, limit);
  }

  const records = await fetchOrRefreshPonsLaunches(limit);
  return records.slice(0, limit);
}

async function fetchOrRefreshPonsLaunches(limit: number): Promise<PonsV2LaunchRecord[]> {
  const g = getProtoGlobals();
  if (g.ponsLaunchesInFlight) return g.ponsLaunchesInFlight;

  const targetCount = Math.max(limit, PONS_LAUNCHES_BUFFER_SIZE);
  const task = (async (): Promise<PonsV2LaunchRecord[]> => {
    try {
      const latestHex = await rpcCall<string>('eth_blockNumber', []);
      const latest = Number.parseInt(latestHex, 16);
      if (!Number.isFinite(latest) || latest <= 0) {
        return g.ponsLaunchesCache?.records ?? [];
      }

      const prev = g.ponsLaunchesCache;
      if (prev && prev.records.length > 0 && prev.lastBlock > 0) {
        if (latest <= prev.lastBlock) {
          g.ponsLaunchesCache = {
            lastBlock: prev.lastBlock,
            fetchedAt: Date.now(),
            records: prev.records,
          };
          return prev.records;
        }

        // Incremental tail scan: at ~0.22s/block this only inspects ~16-30 blocks per 4s poll.
        const fromHex = `0x${(prev.lastBlock + 1).toString(16)}`;
        const res = await rpcCall<RawPonsLaunchLog[]>('eth_getLogs', [
          {
            fromBlock: fromHex,
            toBlock: latestHex,
            address: ROBINHOOD_PONS_V2_FACTORY,
            topics: [PONS_TOKEN_LAUNCHED_TOPIC0],
          },
        ]);
        const freshRecords = decodePonsLaunchLogsNewestFirst(Array.isArray(res) ? res : []);
        const merged: PonsV2LaunchRecord[] = [];
        const seenTokens = new Set<string>();
        for (const rec of [...freshRecords, ...prev.records]) {
          if (seenTokens.has(rec.tokenAddress)) continue;
          seenTokens.add(rec.tokenAddress);
          merged.push(rec);
          if (merged.length >= targetCount) break;
        }
        g.ponsLaunchesCache = {
          lastBlock: latest,
          fetchedAt: Date.now(),
          records: merged,
        };
        return merged;
      }

      // Cold start: look back 350k blocks (~20 hours), expanding to 1.5M blocks if sparse
      let logs: RawPonsLaunchLog[] = [];
      for (const span of [350_000, 1_500_000]) {
        const fromHex = `0x${Math.max(0, latest - span).toString(16)}`;
        const res = await rpcCall<RawPonsLaunchLog[]>('eth_getLogs', [
          {
            fromBlock: fromHex,
            toBlock: latestHex,
            address: ROBINHOOD_PONS_V2_FACTORY,
            topics: [PONS_TOKEN_LAUNCHED_TOPIC0],
          },
        ]);
        logs = Array.isArray(res) ? res : [];
        if (logs.length >= limit) break;
      }

      const decoded = decodePonsLaunchLogsNewestFirst(logs.slice(-targetCount));
      const deduped: PonsV2LaunchRecord[] = [];
      const seenTokens = new Set<string>();
      for (const rec of decoded) {
        if (seenTokens.has(rec.tokenAddress)) continue;
        seenTokens.add(rec.tokenAddress);
        deduped.push(rec);
      }

      if (deduped.length > 0) {
        g.ponsLaunchesCache = {
          lastBlock: latest,
          fetchedAt: Date.now(),
          records: deduped,
        };
      }
      return deduped;
    } catch {
      return g.ponsLaunchesCache?.records ?? [];
    } finally {
      g.ponsLaunchesInFlight = undefined;
    }
  })();

  g.ponsLaunchesInFlight = task;
  return task;
}

function decodeV4InitializeLog(log: {
  topics: string[];
  data: string;
}): UniswapV4PoolKey {
  const clean = strip0x(log.data);
  const fee = Number(BigInt(`0x${clean.slice(0, 64) || '0'}`));
  const tickWord = BigInt(`0x${clean.slice(64, 128) || '0'}`);
  const tickSpacing = Number(
    tickWord >= 1n << 255n ? tickWord - (1n << 256n) : tickWord,
  );
  const hooks = `0x${clean.slice(128 + 24, 192).toLowerCase()}`;
  return {
    currency0: `0x${log.topics[2].slice(-40).toLowerCase()}`,
    currency1: `0x${log.topics[3].slice(-40).toLowerCase()}`,
    fee,
    tickSpacing,
    hooks,
  };
}

export async function readUniswapV4PoolKey(poolId: string): Promise<UniswapV4PoolKey | null> {
  const norm = poolId.toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(norm)) return null;
  const { v4PoolKeyCache, v4PoolKeyInFlight } = getProtoGlobals();
  const cached = v4PoolKeyCache.get(norm);
  if (cached) return cached;

  const existing = v4PoolKeyInFlight.get(norm);
  if (existing) return existing;

  const lookupPromise = (async (): Promise<UniswapV4PoolKey | null> => {
    try {
      const latestHex = await rpcCall<string>('eth_blockNumber', []);
      const latest = Number.parseInt(latestHex, 16);
      if (!Number.isFinite(latest) || latest <= 0) return null;

      // Probe recent 500k blocks first (~30h on Robinhood), then step back sequentially in 10M chunks
      const recentStart = Math.max(0, latest - 500_000);
      const windows: Array<[number, number]> = [[recentStart, latest]];
      for (let end = recentStart - 1; end > 0 && windows.length < 8; end -= 10_000_000) {
        windows.push([Math.max(0, end - 9_999_999), end]);
      }

      for (const [start, end] of windows) {
        const logs = await rpcCall<Array<{ topics: string[]; data: string }>>('eth_getLogs', [
          {
            fromBlock: `0x${start.toString(16)}`,
            toBlock: `0x${end.toString(16)}`,
            address: ROBINHOOD_UNISWAP_V4_POOL_MANAGER,
            topics: [V4_INITIALIZE_TOPIC0, norm],
          },
        ]).catch(() => []);

        if (Array.isArray(logs) && logs.length > 0) {
          const key = decodeV4InitializeLog(logs[0]);
          v4PoolKeyCache.set(norm, key);
          return key;
        }
      }
    } catch {
      // PoolKey lookup failed
    }
    return null;
  })().finally(() => {
    if (v4PoolKeyInFlight.get(norm) === lookupPromise) {
      v4PoolKeyInFlight.delete(norm);
    }
  });

  v4PoolKeyInFlight.set(norm, lookupPromise);
  return lookupPromise;
}

/**
 * Fallback lookup for Uniswap V4 pools by token address via `Initialize` logs
 * when third-party indexers (GeckoTerminal/DexScreener) are rate-limited or lagged.
 */
export async function findUniswapV4PoolByTokenFromRpc(
  tokenAddress: string,
): Promise<UniswapV4LiveState | null> {
  const norm = tokenAddress.toLowerCase();
  if (!isEvmAddress(norm)) return null;
  const { v4PoolKeyCache, v4ByTokenCache, v4ByTokenInFlight } = getProtoGlobals();
  const hit = v4ByTokenCache.get(norm);
  if (hit && Date.now() - hit.at < 30_000) return hit.result;

  const existing = v4ByTokenInFlight.get(norm);
  if (existing) return existing;

  const lookupPromise = (async (): Promise<UniswapV4LiveState | null> => {
    try {
      const latestHex = await rpcCall<string>('eth_blockNumber', []);
      const latest = Number.parseInt(latestHex, 16);
      if (!Number.isFinite(latest) || latest <= 0) return null;

      const paddedToken = `0x${encodeAddress(norm)}`;
      const queryWindow = async (fromBlock: number, toBlock: number) => {
        const from = `0x${Math.max(0, fromBlock).toString(16)}`;
        const to = `0x${toBlock.toString(16)}`;
        const [asToken0, asToken1] = await Promise.allSettled([
          rpcCall<Array<{ topics: string[]; data: string }>>('eth_getLogs', [
            {
              fromBlock: from,
              toBlock: to,
              address: ROBINHOOD_UNISWAP_V4_POOL_MANAGER,
              topics: [V4_INITIALIZE_TOPIC0, null, paddedToken],
            },
          ]),
          rpcCall<Array<{ topics: string[]; data: string }>>('eth_getLogs', [
            {
              fromBlock: from,
              toBlock: to,
              address: ROBINHOOD_UNISWAP_V4_POOL_MANAGER,
              topics: [V4_INITIALIZE_TOPIC0, null, null, paddedToken],
            },
          ]),
        ]);
        return [
          ...(asToken0.status === 'fulfilled' && Array.isArray(asToken0.value) ? asToken0.value : []),
          ...(asToken1.status === 'fulfilled' && Array.isArray(asToken1.value) ? asToken1.value : []),
        ];
      };

      const recentFloor = Math.max(0, latest - 1_000_000);
      let logs = await queryWindow(recentFloor, latest);
      if (logs.length === 0 && recentFloor > 0) {
        logs = await queryWindow(Math.max(0, latest - 9_999_999), recentFloor - 1);
      }

      if (logs.length === 0) {
        v4ByTokenCache.set(norm, { at: Date.now(), result: null });
        return null;
      }

      const candidateIds: string[] = [];
      for (const log of logs) {
        const poolId = log.topics?.[1]?.toLowerCase();
        if (!poolId || !/^0x[a-f0-9]{64}$/.test(poolId)) continue;
        if (!v4PoolKeyCache.has(poolId)) {
          v4PoolKeyCache.set(poolId, decodeV4InitializeLog(log));
        }
        if (!candidateIds.includes(poolId)) candidateIds.push(poolId);
      }

      const states = await Promise.all(
        candidateIds.slice(0, 5).map((id) => readUniswapV4LiveState(id).catch(() => null)),
      );
      const live = states.filter((s): s is UniswapV4LiveState => Boolean(s));
      if (live.length === 0) {
        v4ByTokenCache.set(norm, { at: Date.now(), result: null });
        return null;
      }

      live.sort((a, b) => (b.liquidity > a.liquidity ? 1 : b.liquidity < a.liquidity ? -1 : 0));
      const best = live[0];
      v4ByTokenCache.set(norm, { at: Date.now(), result: best });
      return best;
    } catch {
      return null;
    }
  })().finally(() => {
    if (v4ByTokenInFlight.get(norm) === lookupPromise) {
      v4ByTokenInFlight.delete(norm);
    }
  });

  v4ByTokenInFlight.set(norm, lookupPromise);
  return lookupPromise;
}

export interface UniswapV4LiveState {
  poolId: string;
  poolKey: UniswapV4PoolKey;
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
  liquidity: bigint;
}

export async function readUniswapV4LiveState(poolId: string): Promise<UniswapV4LiveState | null> {
  const poolKey = await readUniswapV4PoolKey(poolId);
  if (!poolKey) return null;

  const slot0Slot = computeV4StateSlot(poolId);
  const liqSlot = `0x${(BigInt(slot0Slot) + 3n).toString(16).padStart(64, '0')}`;

  const [slot0Hex, liqHex] = await rpcBatchCalls([
    {
      method: 'eth_call',
      params: [{ to: ROBINHOOD_UNISWAP_V4_POOL_MANAGER, data: `0x1e2eaeaf${strip0x(slot0Slot)}` }, 'latest'],
    },
    {
      method: 'eth_call',
      params: [{ to: ROBINHOOD_UNISWAP_V4_POOL_MANAGER, data: `0x1e2eaeaf${strip0x(liqSlot)}` }, 'latest'],
    },
  ]);

  if (!slot0Hex || slot0Hex.length <= 2) return null;
  const val = BigInt(slot0Hex);
  const sqrtPriceX96 = val & ((1n << 160n) - 1n);
  if (sqrtPriceX96 <= 0n) return null;

  const tickRaw = Number((val >> 160n) & ((1n << 24n) - 1n));
  const tick = tickRaw >= 1 << 23 ? tickRaw - (1 << 24) : tickRaw;
  const protocolFee = Number((val >> 184n) & ((1n << 24n) - 1n));
  const lpFee = Number((val >> 208n) & ((1n << 24n) - 1n));
  const liquidity = liqHex && liqHex.length > 2 ? BigInt(liqHex) & ((1n << 128n) - 1n) : 0n;

  return {
    poolId: poolId.toLowerCase(),
    poolKey,
    sqrtPriceX96,
    tick,
    protocolFee,
    lpFee,
    liquidity,
  };
}

export interface UniswapV3LiveState {
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
}

export async function readUniswapV3LiveState(poolAddress: string): Promise<UniswapV3LiveState | null> {
  if (!isEvmAddress(poolAddress)) return null;
  const pool = poolAddress.toLowerCase();
  const [t0Hex, t1Hex, feeHex, s0Hex, liqHex] = await rpcBatchCalls([
    { method: 'eth_call', params: [{ to: pool, data: '0x0dfe1681' }, 'latest'] }, // token0()
    { method: 'eth_call', params: [{ to: pool, data: '0xd21220a7' }, 'latest'] }, // token1()
    { method: 'eth_call', params: [{ to: pool, data: '0xddca3f43' }, 'latest'] }, // fee()
    { method: 'eth_call', params: [{ to: pool, data: '0x3850c7bd' }, 'latest'] }, // slot0()
    { method: 'eth_call', params: [{ to: pool, data: '0x1a686502' }, 'latest'] }, // liquidity()
  ]);

  const token0 = decodeAddressAt(t0Hex, 0);
  const token1 = decodeAddressAt(t1Hex, 0);
  if (!token0 || !token1 || !s0Hex || s0Hex.length < 130) return null;

  const fee = Number(decodeUint256At(feeHex, 0));
  const sqrtPriceX96 = decodeUint256At(s0Hex, 0);
  const tickWord = decodeUint256At(s0Hex, 1);
  const tick = Number(tickWord >= 1n << 255n ? tickWord - (1n << 256n) : tickWord);
  const liquidity = decodeUint256At(liqHex, 0);

  if (sqrtPriceX96 <= 0n) return null;

  return {
    poolAddress: pool,
    token0,
    token1,
    fee,
    sqrtPriceX96,
    tick,
    liquidity,
  };
}

export interface EvmContractAuditSignals {
  ownerAddress: string | null;
  isOwnerRenounced: boolean | null;
  isContractVerifiedHint: boolean | null;
  ponsCurve: PonsV2FullCurveState | null;
  lockerAddress: string | null;
}

export async function readOnChainAuditSignals(
  tokenAddress: string,
): Promise<EvmContractAuditSignals> {
  const norm = tokenAddress.toLowerCase();
  if (!isEvmAddress(norm)) {
    return {
      ownerAddress: null,
      isOwnerRenounced: null,
      isContractVerifiedHint: null,
      ponsCurve: null,
      lockerAddress: null,
    };
  }

  const [ownerResults, curveAddress] = await Promise.all([
    rpcBatchCalls([
      { method: 'eth_call', params: [{ to: norm, data: '0x8da5cb5b' }, 'latest'] }, // owner()
    ]).catch(() => [null]),
    readPonsV2LaunchedCurveByToken(norm),
  ]);

  const rawOwner = decodeAddressAt(ownerResults[0], 0);
  const isOwnerRenounced = rawOwner ? rawOwner === ZERO_ADDRESS : null;
  const ponsCurve = curveAddress ? await readPonsV2FullCurveState(curveAddress) : null;

  return {
    ownerAddress: rawOwner && rawOwner !== ZERO_ADDRESS ? rawOwner : null,
    isOwnerRenounced,
    isContractVerifiedHint: ponsCurve ? true : null,
    ponsCurve,
    lockerAddress:
      ponsCurve?.graduated ? '0x267444d099b10fb5ed7c3cc7b7c767adca574952' : null,
  };
}

export interface SwapAllowanceStatus {
  erc20Allowance: bigint;
  permit2Amount: bigint;
  permit2Expiration: number;
}

export async function readRobinhoodAllowances(params: {
  owner: string;
  tokenAddress: string;
  spender: string;
  checkPermit2?: boolean;
}): Promise<SwapAllowanceStatus> {
  const calls: RpcBatchCallItem[] = [
    {
      method: 'eth_call',
      params: [
        {
          to: params.tokenAddress,
          data: encodeErc20Allowance(
            params.owner,
            params.checkPermit2 ? ROBINHOOD_PERMIT2 : params.spender,
          ),
        },
        'latest',
      ],
    },
  ];
  if (params.checkPermit2) {
    calls.push({
      method: 'eth_call',
      params: [
        {
          to: ROBINHOOD_PERMIT2,
          data: encodePermit2Allowance(
            params.owner,
            params.tokenAddress,
            params.spender || ROBINHOOD_UNISWAP_UNIVERSAL_ROUTER,
          ),
        },
        'latest',
      ],
    });
  }

  const results = await rpcBatchCalls(calls);
  const erc20Allowance = decodeUint256At(results[0], 0);
  const permit2Amount = params.checkPermit2 ? decodeUint256At(results[1], 0) : 0n;
  const permit2Expiration = params.checkPermit2 ? Number(decodeUint256At(results[1], 1)) : 0;

  return {
    erc20Allowance,
    permit2Amount,
    permit2Expiration,
  };
}

function decodeSignedInt256(wordHex: string): bigint {
  if (!wordHex) return 0n;
  const u = BigInt(`0x${wordHex}`);
  return u >= 1n << 255n ? u - (1n << 256n) : u;
}

function buildConcentratedSwapTrade(params: {
  normToken: string;
  token0: string;
  token1: string;
  amount0: bigint;
  amount1: bigint;
  tokenScale: number;
  ethUsd: number | null;
  txHash: string;
  logIndex: number;
  walletTopic?: string;
  timestamp: string;
}): TapeTrade {
  const tokenIsCurrency0 = params.token0.toLowerCase() === params.normToken;
  const tokenDelta = tokenIsCurrency0 ? params.amount0 : params.amount1;
  const quoteDelta = tokenIsCurrency0 ? params.amount1 : params.amount0;
  const quoteCurrency = tokenIsCurrency0 ? params.token1 : params.token0;
  const isQuoteEth =
    quoteCurrency === ZERO_ADDRESS ||
    quoteCurrency.toLowerCase() === ROBINHOOD_WETH_ADDRESS.toLowerCase();
  const isQuoteUsdg =
    quoteCurrency.toLowerCase() === ROBINHOOD_USDG_ADDRESS.toLowerCase();

  // Uniswap V3 & V4 emit signed pool balance deltas: negative = user pays into pool; positive = user receives
  const isBuy = tokenDelta > 0n;
  const tokAbs = Number(tokenDelta < 0n ? -tokenDelta : tokenDelta) / params.tokenScale;
  const quoteDec = isQuoteUsdg ? 6 : 18;
  const quoteAbs =
    Number(quoteDelta < 0n ? -quoteDelta : quoteDelta) / 10 ** quoteDec;

  const amountSol = isQuoteEth ? quoteAbs : params.ethUsd ? quoteAbs / params.ethUsd : null;
  const amountUsd = isQuoteUsdg
    ? quoteAbs
    : isQuoteEth && params.ethUsd
      ? quoteAbs * params.ethUsd
      : null;
  const priceUsd = amountUsd && tokAbs > 0 ? amountUsd / tokAbs : null;

  return {
    eventId: `${params.txHash}:${params.logIndex}`,
    signature: params.txHash,
    mint: params.normToken,
    wallet: params.walletTopic ? `0x${params.walletTopic.slice(-40).toLowerCase()}` : null,
    side: isBuy ? 'BUY' : 'SELL',
    amountUsd,
    amountSol,
    amountTokens: tokAbs,
    priceUsd,
    timestamp: params.timestamp,
    isMev: false,
    source: 'robinhood-rpc-logs',
  };
}

export async function readRecentPoolTradesFromRpc(params: {
  tokenAddress: string;
  poolAddress: string;
  tokenDecimals?: number;
  limit?: number;
}): Promise<TapeTrade[]> {
  const { tokenAddress, poolAddress, tokenDecimals = 18, limit = 30 } = params;
  const normToken = tokenAddress.toLowerCase();
  const normPool = poolAddress.toLowerCase();
  const isV4PoolId = /^0x[a-f0-9]{64}$/.test(normPool);
  if (!isV4PoolId && !isEvmAddress(normPool)) return [];

  try {
    const latestHex = await rpcCall<string>('eth_blockNumber', []);
    const latest = Number.parseInt(latestHex, 16);
    if (!Number.isFinite(latest)) return [];

    const fromHex = `0x${Math.max(0, latest - 180_000).toString(16)}`;
    const filter = isV4PoolId
      ? {
          fromBlock: fromHex,
          toBlock: latestHex,
          address: ROBINHOOD_UNISWAP_V4_POOL_MANAGER,
          topics: [V4_SWAP_TOPIC0, normPool],
        }
      : {
          fromBlock: fromHex,
          toBlock: latestHex,
          address: normPool,
          topics: [[PONS_CURVE_BUY_TOPIC0, PONS_CURVE_SELL_TOPIC0, V3_SWAP_TOPIC0]],
        };

    const logs = await rpcCall<
      Array<{
        topics: string[];
        data: string;
        blockNumber: string;
        transactionHash: string;
        logIndex: string;
      }>
    >('eth_getLogs', [filter]);

    if (!Array.isArray(logs) || logs.length === 0) return [];
    const recent = logs.slice(-limit).reverse();
    const ethUsd = await readOnChainEthUsdPrice();

    let v4Key: UniswapV4PoolKey | null = null;
    if (isV4PoolId) {
      v4Key = await readUniswapV4PoolKey(normPool);
    }

    let v3Pair: { token0: string; token1: string } | null = null;
    if (!isV4PoolId && recent.some((l) => l.topics[0]?.toLowerCase() === V3_SWAP_TOPIC0)) {
      const [t0Hex, t1Hex] = await rpcBatchCalls([
        { method: 'eth_call', params: [{ to: normPool, data: '0x0dfe1681' }, 'latest'] },
        { method: 'eth_call', params: [{ to: normPool, data: '0xd21220a7' }, 'latest'] },
      ]).catch(() => [null, null]);
      const t0 = decodeAddressAt(t0Hex, 0);
      const t1 = decodeAddressAt(t1Hex, 0);
      if (t0 && t1) v3Pair = { token0: t0, token1: t1 };
    }

    const tokenScale = 10 ** tokenDecimals;
    const uniqueBlocks = Array.from(new Set(recent.map((l) => l.blockNumber))).slice(0, 20);
    const blockCalls = uniqueBlocks.map((b) => ({
      method: 'eth_getBlockByNumber',
      params: [b, false],
    }));

    const blockTimestamps = new Map<string, string>();
    if (blockCalls.length > 0) {
      const blocks = await robinhoodRpcBatch<{ timestamp?: string }>(blockCalls).catch(
        () => [] as Array<{ timestamp?: string } | undefined>,
      );
      blocks.forEach((blk, idx) => {
        const blkHex = uniqueBlocks[idx];
        const tsHex = blk?.timestamp;
        if (blkHex && tsHex) {
          blockTimestamps.set(
            blkHex,
            new Date(Number.parseInt(tsHex, 16) * 1000).toISOString(),
          );
        }
      });
    }

    const trades: TapeTrade[] = [];
    for (const log of recent) {
      const sig = log.topics[0]?.toLowerCase();
      const dataClean = strip0x(log.data);
      const timestamp = blockTimestamps.get(log.blockNumber) ?? new Date().toISOString();
      const logIdx = Number.parseInt(log.logIndex, 16) || 0;

      if (sig === PONS_CURVE_BUY_TOPIC0 || sig === PONS_CURVE_SELL_TOPIC0) {
        const isBuy = sig === PONS_CURVE_BUY_TOPIC0;
        const w0 = decodeUint256At(log.data, 0);
        const w1 = decodeUint256At(log.data, 1);
        const ethRaw = isBuy ? w0 : w1;
        const tokRaw = isBuy ? w1 : w0;
        const amountSol = Number(ethRaw) / 1e18;
        const amountTokens = Number(tokRaw) / tokenScale;
        const amountUsd = ethUsd ? amountSol * ethUsd : null;
        const priceUsd = amountUsd && amountTokens > 0 ? amountUsd / amountTokens : null;

        trades.push({
          eventId: `${log.transactionHash}:${logIdx}`,
          signature: log.transactionHash,
          mint: normToken,
          wallet: log.topics[2] ? `0x${log.topics[2].slice(-40).toLowerCase()}` : null,
          side: isBuy ? 'BUY' : 'SELL',
          amountUsd,
          amountSol,
          amountTokens,
          priceUsd,
          timestamp,
          isMev: false,
          source: 'robinhood-rpc-logs',
        });
      } else if (sig === V4_SWAP_TOPIC0 && v4Key) {
        trades.push(
          buildConcentratedSwapTrade({
            normToken,
            token0: v4Key.currency0,
            token1: v4Key.currency1,
            amount0: decodeSignedInt256(dataClean.slice(0, 64)),
            amount1: decodeSignedInt256(dataClean.slice(64, 128)),
            tokenScale,
            ethUsd,
            txHash: log.transactionHash,
            logIndex: logIdx,
            walletTopic: log.topics[2],
            timestamp,
          }),
        );
      } else if (sig === V3_SWAP_TOPIC0 && v3Pair) {
        trades.push(
          buildConcentratedSwapTrade({
            normToken,
            token0: v3Pair.token0,
            token1: v3Pair.token1,
            amount0: decodeSignedInt256(dataClean.slice(0, 64)),
            amount1: decodeSignedInt256(dataClean.slice(64, 128)),
            tokenScale,
            ethUsd,
            txHash: log.transactionHash,
            logIndex: logIdx,
            walletTopic: log.topics[2],
            timestamp,
          }),
        );
      }
    }

    return trades;
  } catch {
    return [];
  }
}
