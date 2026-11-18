import {
  CHAIN_CONFIGS,
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  isEvmAddress,
} from '@/lib/chains/chain-config';

export interface RobinhoodRpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}

export interface Erc20Metadata {
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: number;
}

const RPC_TIMEOUT_MS = 8_000;
const RPC_MAX_CONCURRENT = 2;
const RPC_MIN_INTERVAL_MS = 45;
const RPC_MAX_RETRIES = 3;
const RPC_MAX_BATCH_ITEMS = 24;

interface RobinhoodRpcQueueState {
  active: number;
  lastStartMs: number;
  cooldownUntil: number;
  waiters: Array<() => void>;
}

const globalForRhRpc = globalThis as unknown as {
  __sentinelRhRpcQueue?: RobinhoodRpcQueueState;
};

function getRpcQueueState(): RobinhoodRpcQueueState {
  if (!globalForRhRpc.__sentinelRhRpcQueue) {
    globalForRhRpc.__sentinelRhRpcQueue = {
      active: 0,
      lastStartMs: 0,
      cooldownUntil: 0,
      waiters: [],
    };
  }
  return globalForRhRpc.__sentinelRhRpcQueue;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireRpcSlot(): Promise<void> {
  const q = getRpcQueueState();
  while (q.active >= RPC_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => q.waiters.push(resolve));
  }
  q.active += 1;

  const now = Date.now();
  const readyAt = Math.max(q.lastStartMs + RPC_MIN_INTERVAL_MS, q.cooldownUntil);
  if (readyAt > now) {
    await sleepMs(readyAt - now);
  }
  q.lastStartMs = Date.now();
}

function releaseRpcSlot(): void {
  const q = getRpcQueueState();
  q.active = Math.max(0, q.active - 1);
  const next = q.waiters.shift();
  if (next) next();
}

function parseRetryAfterMs(res: Response, attempt: number): number {
  const raw = res.headers.get('retry-after');
  if (raw) {
    const sec = Number(raw);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(3_500, Math.max(250, Math.round(sec * 1000)));
    }
  }
  const base = 350 * 2 ** attempt;
  return Math.min(3_000, base + Math.floor(Math.random() * 140));
}

async function postJsonRpc(
  rpcUrl: string,
  payload: unknown,
  timeoutMs: number,
  label: string,
): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RPC_MAX_RETRIES; attempt += 1) {
    let retryDelayMs = 0;
    await acquireRpcSlot();
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });

      if (res.status === 429 || res.status >= 500) {
        const waitMs = parseRetryAfterMs(res, attempt);
        const q = getRpcQueueState();
        q.cooldownUntil = Math.max(q.cooldownUntil, Date.now() + waitMs);
        lastError = new Error(`${label} HTTP ${res.status}`);
        if (attempt < RPC_MAX_RETRIES) {
          retryDelayMs = waitMs;
        } else {
          throw lastError;
        }
      } else if (!res.ok) {
        throw new Error(`${label} HTTP ${res.status}`);
      } else {
        return await res.json();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(msg);
      const isHttpNonRetry = /HTTP 4\d\d/.test(msg) && !msg.includes('HTTP 429');
      if (isHttpNonRetry || attempt >= RPC_MAX_RETRIES) {
        throw lastError;
      }
      retryDelayMs = 300 * 2 ** attempt;
    } finally {
      releaseRpcSlot();
    }

    if (retryDelayMs > 0) {
      await sleepMs(retryDelayMs);
    }
  }

  throw lastError ?? new Error(`${label} failed`);
}

export function getRobinhoodRpcUrl(testnet = false): string {
  if (testnet) {
    return (
      process.env.ROBINHOOD_TESTNET_RPC_URL?.trim() ||
      CHAIN_CONFIGS.robinhood.testnetRpcUrl ||
      'https://rpc.testnet.chain.robinhood.com'
    );
  }
  return (
    process.env.ROBINHOOD_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL?.trim() ||
    CHAIN_CONFIGS.robinhood.rpcUrl ||
    'https://rpc.mainnet.chain.robinhood.com'
  );
}

export async function robinhoodRpcCall<T = unknown>(
  method: string,
  params: unknown[] = [],
  options?: { testnet?: boolean; timeoutMs?: number },
): Promise<T> {
  const rpcUrl = getRobinhoodRpcUrl(options?.testnet);
  const json = (await postJsonRpc(
    rpcUrl,
    {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    },
    options?.timeoutMs ?? RPC_TIMEOUT_MS,
    'Robinhood RPC',
  )) as { result?: T; error?: { code?: number; message?: string } };

  if (json.error) {
    throw new Error(json.error.message || `Robinhood RPC error ${json.error.code ?? ''}`.trim());
  }
  return json.result as T;
}

export async function getRobinhoodChainId(testnet = false): Promise<number> {
  const hex = await robinhoodRpcCall<string>('eth_chainId', [], { testnet });
  const parsed = Number.parseInt(hex, 16);
  return Number.isFinite(parsed) ? parsed : testnet ? ROBINHOOD_TESTNET_CHAIN_ID : ROBINHOOD_CHAIN_ID;
}

export async function getRobinhoodBlockNumber(testnet = false): Promise<number> {
  const hex = await robinhoodRpcCall<string>('eth_blockNumber', [], { testnet });
  const parsed = Number.parseInt(hex, 16);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Invalid block number returned by Robinhood RPC');
  }
  return parsed;
}

export async function getRobinhoodEthBalance(address: string, testnet = false): Promise<number> {
  if (!isEvmAddress(address)) {
    throw new Error('Invalid EVM address');
  }
  const hexWei = await robinhoodRpcCall<string>('eth_getBalance', [address, 'latest'], { testnet });
  if (!hexWei || hexWei === '0x') return 0;
  const wei = BigInt(hexWei);
  const whole = Number(wei / 10n ** 12n);
  return whole / 1e6;
}

function decodeAbiString(hex: string | undefined): string | undefined {
  if (!hex || hex === '0x' || hex.length < 66) return undefined;
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  try {
    // Dynamic ABI string: offset (32 bytes) + length (32 bytes) + UTF-8 bytes
    if (clean.length >= 128) {
      const length = Number.parseInt(clean.slice(64, 128), 16);
      if (Number.isFinite(length) && length > 0 && length < 256) {
        const dataHex = clean.slice(128, 128 + length * 2);
        const bytes = new Uint8Array(
          dataHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
        );
        const decoded = new TextDecoder().decode(bytes).replace(/\0/g, '').trim();
        if (decoded) return decoded;
      }
    }
    // Fallback bytes32 fixed-length string
    const bytes = new Uint8Array(
      clean.slice(0, 64).match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
    );
    const decoded = new TextDecoder().decode(bytes).replace(/\0/g, '').trim();
    return decoded || undefined;
  } catch {
    return undefined;
  }
}

function decodeUint256(hex: string | undefined): bigint | undefined {
  if (!hex || hex === '0x') return undefined;
  try {
    return BigInt(hex);
  } catch {
    return undefined;
  }
}

function padAddressArg(address: string): string {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

export async function getRobinhoodErc20Metadata(
  tokenAddress: string,
  testnet = false,
): Promise<Erc20Metadata> {
  if (!isEvmAddress(tokenAddress)) return {};
  const [nameHex, symbolHex, decimalsHex, supplyHex] = await robinhoodRpcBatch<string>(
    [
      { method: 'eth_call', params: [{ to: tokenAddress, data: '0x06fdde03' }, 'latest'] }, // name()
      { method: 'eth_call', params: [{ to: tokenAddress, data: '0x95d89b41' }, 'latest'] }, // symbol()
      { method: 'eth_call', params: [{ to: tokenAddress, data: '0x313ce567' }, 'latest'] }, // decimals()
      { method: 'eth_call', params: [{ to: tokenAddress, data: '0x18160ddd' }, 'latest'] }, // totalSupply()
    ],
    { testnet },
  ).catch(() => [undefined, undefined, undefined, undefined]);

  const decimalsBig = decodeUint256(decimalsHex);
  const decimals =
    decimalsBig !== undefined && decimalsBig <= 36n ? Number(decimalsBig) : 18;
  const supplyBig = decodeUint256(supplyHex);
  let totalSupply: number | undefined;
  if (supplyBig !== undefined) {
    const divisor = 10n ** BigInt(Math.min(decimals, 18));
    totalSupply = Number(supplyBig / divisor);
  }

  return {
    name: decodeAbiString(nameHex),
    symbol: decodeAbiString(symbolHex),
    decimals,
    totalSupply: Number.isFinite(totalSupply) ? totalSupply : undefined,
  };
}

export async function getRobinhoodErc20Balance(
  tokenAddress: string,
  walletAddress: string,
  decimals = 18,
  testnet = false,
): Promise<number> {
  if (!isEvmAddress(tokenAddress) || !isEvmAddress(walletAddress)) return 0;
  const data = `0x70a08231${padAddressArg(walletAddress)}`;
  const hex = await robinhoodRpcCall<string>('eth_call', [{ to: tokenAddress, data }, 'latest'], {
    testnet,
  }).catch(() => '0x0');
  const raw = decodeUint256(hex) ?? 0n;
  if (raw === 0n) return 0;
  const scale = Math.min(decimals, 18);
  const whole = Number(raw / 10n ** BigInt(Math.max(0, scale - 6)));
  return whole / 1e6;
}

export async function getRobinhoodErc20Allowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
  testnet = false,
): Promise<bigint> {
  if (!isEvmAddress(tokenAddress) || !isEvmAddress(ownerAddress) || !isEvmAddress(spenderAddress)) {
    return 0n;
  }
  const data = `0xdd62ed3e${padAddressArg(ownerAddress)}${padAddressArg(spenderAddress)}`;
  const hex = await robinhoodRpcCall<string>('eth_call', [{ to: tokenAddress, data }, 'latest'], {
    testnet,
  }).catch(() => '0x0');
  return decodeUint256(hex) ?? 0n;
}

export async function isRobinhoodContractAddress(
  address: string,
  testnet = false,
): Promise<boolean> {
  if (!isEvmAddress(address)) return false;
  const code = await robinhoodRpcCall<string>('eth_getCode', [address, 'latest'], { testnet }).catch(
    () => '0x',
  );
  return typeof code === 'string' && code.length > 2;
}

export async function getRobinhoodRecentLogs(
  params: {
    fromBlock: number;
    toBlock: number;
    topics?: (string | string[] | null)[];
    address?: string | string[];
  },
  testnet = false,
): Promise<RobinhoodRpcLog[]> {
  const filter: Record<string, unknown> = {
    fromBlock: `0x${Math.max(0, params.fromBlock).toString(16)}`,
    toBlock: `0x${Math.max(0, params.toBlock).toString(16)}`,
  };
  if (params.topics) filter.topics = params.topics;
  if (params.address) filter.address = params.address;
  const logs = await robinhoodRpcCall<RobinhoodRpcLog[]>('eth_getLogs', [filter], { testnet });
  return Array.isArray(logs) ? logs : [];
}

export interface PonsV2CurveState {
  poolAddress: string;
  graduated: boolean;
  isNativeQuote: boolean;
  realQuoteReserveRaw: bigint;
  graduationThresholdRaw: bigint;
  /** Real raised reserve formatted assuming 18 decimals for native ETH pairs. */
  realQuoteEth?: number;
  graduationThresholdEth?: number;
  /** Exact on-chain bonding progress percentage [0, 100]. */
  progressPct: number;
}

const PONS_V2_SELECTORS = {
  realQuoteReserve: '0x4f1f58fd',
  graduationThreshold: '0x8b0bc501',
  graduated: '0xe7c2b772',
  isNativeQuote: '0xdc08e094',
} as const;

export async function robinhoodRpcBatch<T = unknown>(
  requests: Array<{ method: string; params: unknown[] }>,
  options?: { testnet?: boolean; timeoutMs?: number },
): Promise<Array<T | undefined>> {
  if (requests.length === 0) return [];
  const rpcUrl = getRobinhoodRpcUrl(options?.testnet);
  const timeoutMs = options?.timeoutMs ?? RPC_TIMEOUT_MS;
  const out: Array<T | undefined> = [];

  for (let offset = 0; offset < requests.length; offset += RPC_MAX_BATCH_ITEMS) {
    const slice = requests.slice(offset, offset + RPC_MAX_BATCH_ITEMS);
    const payload = slice.map((req, idx) => ({
      jsonrpc: '2.0',
      id: idx + 1,
      method: req.method,
      params: req.params,
    }));

    const json = (await postJsonRpc(
      rpcUrl,
      payload,
      timeoutMs,
      'Robinhood RPC batch',
    )) as Array<{ id?: number; result?: T; error?: unknown }>;

    if (!Array.isArray(json)) {
      out.push(...slice.map(() => undefined));
      continue;
    }

    const byId = new Map<number, T | undefined>();
    for (const entry of json) {
      if (typeof entry?.id === 'number' && !entry.error) {
        byId.set(entry.id, entry.result);
      }
    }
    out.push(...slice.map((_, idx) => byId.get(idx + 1)));
  }

  return out;
}

export async function readPonsV2CurveStates(
  poolAddresses: string[],
  testnet = false,
): Promise<Map<string, PonsV2CurveState>> {
  const valid = Array.from(
    new Set(poolAddresses.map((a) => a.toLowerCase()).filter((a) => isEvmAddress(a))),
  );
  const result = new Map<string, PonsV2CurveState>();
  if (valid.length === 0) return result;

  // 4 calls per pool; chunk by 6 pools (24 JSON-RPC calls per HTTP batch)
  const CHUNK_SIZE = 6;
  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const chunk = valid.slice(i, i + CHUNK_SIZE);
    const batch = chunk.flatMap((addr) => [
      { method: 'eth_call', params: [{ to: addr, data: PONS_V2_SELECTORS.realQuoteReserve }, 'latest'] },
      { method: 'eth_call', params: [{ to: addr, data: PONS_V2_SELECTORS.graduationThreshold }, 'latest'] },
      { method: 'eth_call', params: [{ to: addr, data: PONS_V2_SELECTORS.graduated }, 'latest'] },
      { method: 'eth_call', params: [{ to: addr, data: PONS_V2_SELECTORS.isNativeQuote }, 'latest'] },
    ]);

    const responses = await robinhoodRpcBatch<string>(batch, { testnet }).catch(() => []);
    for (let j = 0; j < chunk.length; j += 1) {
      const addr = chunk[j];
      const realBig = decodeUint256(responses[j * 4]);
      const threshBig = decodeUint256(responses[j * 4 + 1]);
      const gradBig = decodeUint256(responses[j * 4 + 2]);
      const nativeBig = decodeUint256(responses[j * 4 + 3]);

      if (threshBig === undefined || threshBig <= 0n || realBig === undefined) {
        continue;
      }

      const graduated = gradBig !== undefined && gradBig > 0n;
      const isNativeQuote = nativeBig !== undefined && nativeBig > 0n;
      const rawPct = graduated
        ? 100
        : Number((realBig * 10_000n) / threshBig) / 100;
      const progressPct = Math.max(0, Math.min(100, Number(rawPct.toFixed(2))));

      result.set(addr, {
        poolAddress: addr,
        graduated,
        isNativeQuote,
        realQuoteReserveRaw: realBig,
        graduationThresholdRaw: threshBig,
        realQuoteEth: isNativeQuote ? Number(realBig / 10n ** 12n) / 1e6 : undefined,
        graduationThresholdEth: isNativeQuote ? Number(threshBig / 10n ** 12n) / 1e6 : undefined,
        progressPct,
      });
    }
  }

  return result;
}

