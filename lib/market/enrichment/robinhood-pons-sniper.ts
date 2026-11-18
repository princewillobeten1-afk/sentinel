import 'server-only';

import { ROBINHOOD_PONS_V2_FACTORY, isEvmAddress } from '@/lib/chains/chain-config';
import { encodeAddress, encodeErc20BalanceOf } from '@/lib/chains/evm-abi';
import { robinhoodRpcBatch, robinhoodRpcCall } from '@/lib/blockchain/robinhood-rpc';
import {
  PONS_CURVE_BUY_TOPIC0,
  PONS_TOKEN_LAUNCHED_TOPIC0,
  readPonsV2LaunchedCurveByToken,
} from '@/lib/blockchain/robinhood-rpc-protocols';
import { updateTokenCard } from '@/lib/market/live/card-cache';
import { saveTokenCardEvidence } from '@/lib/server/db/token-card-evidence-repository';
import { logger } from '@/lib/server/logger';
import { redis } from '@/lib/server/redis';

export const PONS_SNIPER_BLOCK_WINDOW = 25; // ~5.4s on Robinhood Chain (~0.217s/block)
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const YOUNG_TOKEN_TTL_MS = 60_000;
const MATURE_TOKEN_TTL_MS = 5 * 60_000;
const FAILURE_COOLDOWN_MS = 45_000;
const REDIS_AUDIT_PREFIX = 'sentinel:rh-pons-sniper:v1:';
const REDIS_META_PREFIX = 'sentinel:rh-pons-launch-meta:v1:';
const REDIS_AUDIT_TTL_SEC = 10 * 60;
const REDIS_META_TTL_SEC = 24 * 60 * 60;
const MAX_WALLET_BALANCE_PROBES = 40;
const MAX_QUEUE_LENGTH = 40;
const SCANNER_SOURCE = 'robinhood-pons-launch-scanner';
const AUDIT_VERSION = 'rh-pons-launch-v1';

export interface RpcLogEntry {
  blockNumber: string;
  transactionHash: string;
  topics: string[];
  data: string;
}

export interface ParsedPonsCurveBuy {
  blockNumber: number;
  transactionHash: string;
  caller: string;
  recipient: string;
  tokenAmountRaw: bigint;
}

export interface PonsLaunchMeta {
  tokenAddress: string;
  curveAddress: string;
  deployerAddress: string | null;
  launchBlock: number;
  openingBuys: ParsedPonsCurveBuy[];
  uniqueEarlyWallets: string[];
  bundlerWallets: string[];
  sniperWallets: string[];
}

export interface PonsLaunchAuditResult {
  tokenAddress: string;
  launchBlock: number;
  sniperPercentage: number;
  sniperCount: number;
  bundlerPercentage: number;
  bundlerCount: number;
  totalOpeningBuys: number;
  detectedSniperCount: number;
  detectedBundlerCount: number;
  observedAt: string;
}

interface PonsAuditCacheRecord {
  result: PonsLaunchAuditResult | null;
  fetchedAt: number;
  nextRetryAt?: number;
  ageMinutes?: number | null;
}

interface QueuedScanJob {
  tokenAddress: string;
  curveAddress?: string | null;
  deployerAddress?: string | null;
  ageMinutes?: number | null;
}

interface PonsSniperGlobals {
  auditCache?: Map<string, PonsAuditCacheRecord>;
  launchMetaCache?: Map<string, PonsLaunchMeta>;
  inFlight?: Map<string, Promise<PonsLaunchAuditResult | null>>;
  queue?: QueuedScanJob[];
  queuedKeys?: Set<string>;
  draining?: boolean;
}

const g = globalThis as typeof globalThis & {
  __robinhoodPonsSniperState?: PonsSniperGlobals;
};

function getGlobals(): Required<PonsSniperGlobals> {
  if (!g.__robinhoodPonsSniperState) {
    g.__robinhoodPonsSniperState = {
      auditCache: new Map(),
      launchMetaCache: new Map(),
      inFlight: new Map(),
      queue: [],
      queuedKeys: new Set(),
      draining: false,
    };
  }
  const s = g.__robinhoodPonsSniperState;
  s.auditCache ??= new Map();
  s.launchMetaCache ??= new Map();
  s.inFlight ??= new Map();
  s.queue ??= [];
  s.queuedKeys ??= new Set();
  s.draining ??= false;
  return s as Required<PonsSniperGlobals>;
}

function decodeTopicAddress(topic?: string): string | null {
  if (!topic || typeof topic !== 'string' || !topic.startsWith('0x') || topic.length < 42) {
    return null;
  }
  const addr = `0x${topic.slice(-40)}`.toLowerCase();
  return isEvmAddress(addr) ? addr : null;
}

function decodeWordBigInt(dataHex: string | undefined, wordIndex: number): bigint {
  if (!dataHex || !dataHex.startsWith('0x')) return 0n;
  const start = 2 + wordIndex * 64;
  if (dataHex.length < start + 64) return 0n;
  try {
    return BigInt(`0x${dataHex.slice(start, start + 64)}`);
  } catch {
    return 0n;
  }
}

function decodeUint256Result(hex: string | null | undefined): bigint {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('0x') || hex.length < 66) return 0n;
  try {
    return BigInt(`0x${hex.slice(2, 66)}`);
  } catch {
    return 0n;
  }
}

function parseHexBlockNumber(hex: string | undefined): number {
  if (!hex || typeof hex !== 'string') return NaN;
  const parsed = parseInt(hex, 16);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function parsePonsCurveBuyLogs(logs: RpcLogEntry[]): ParsedPonsCurveBuy[] {
  const parsed: ParsedPonsCurveBuy[] = [];
  for (const log of logs) {
    if (!log?.topics || log.topics.length < 3) continue;
    const blockNumber = parseHexBlockNumber(log.blockNumber);
    if (!Number.isFinite(blockNumber) || blockNumber < 0) continue;
    const caller = decodeTopicAddress(log.topics[1]);
    const recipient = decodeTopicAddress(log.topics[2]);
    if (!caller || !recipient || recipient === ZERO_ADDRESS) continue;
    parsed.push({
      blockNumber,
      transactionHash: (log.transactionHash || '').toLowerCase(),
      caller,
      recipient,
      tokenAmountRaw: decodeWordBigInt(log.data, 1),
    });
  }
  return parsed.sort((a, b) => a.blockNumber - b.blockNumber);
}

export interface AnalyzePonsLaunchInput {
  tokenAddress: string;
  launchBlock: number;
  deployerAddress?: string | null;
  curveAddress?: string | null;
  buyLogs: ParsedPonsCurveBuy[];
  currentBalancesByWallet: ReadonlyMap<string, bigint>;
  totalSupplyRaw: bigint;
  sniperBlockWindow?: number;
  observedAt?: string;
}

function toSupplyPercent(heldRaw: bigint, totalSupplyRaw: bigint): number {
  if (totalSupplyRaw <= 0n || heldRaw <= 0n) return 0;
  const bps = (heldRaw * 10000n) / totalSupplyRaw;
  return Math.min(100, Number(bps) / 100);
}

/**
 * Classifies opening-window CurveBuy logs into snipers and bundlers and
 * computes their current held percentage of total supply.
 */
export function classifyPonsOpeningWallets(params: {
  launchBlock: number;
  deployerAddress?: string | null;
  curveAddress?: string | null;
  buyLogs: ParsedPonsCurveBuy[];
  sniperBlockWindow?: number;
}): {
  windowBuys: ParsedPonsCurveBuy[];
  sniperWallets: string[];
  bundlerWallets: string[];
} {
  const windowSize = params.sniperBlockWindow ?? PONS_SNIPER_BLOCK_WINDOW;
  const maxBlock = params.launchBlock + Math.max(0, windowSize);
  const deployer = params.deployerAddress?.toLowerCase() ?? null;
  const curve = params.curveAddress?.toLowerCase() ?? null;

  const windowBuys = params.buyLogs.filter((buy) => {
    if (buy.blockNumber < params.launchBlock || buy.blockNumber > maxBlock) return false;
    const recipient = buy.recipient.toLowerCase();
    return recipient !== ZERO_ADDRESS && (!curve || recipient !== curve);
  });

  const sniperSet = new Set<string>();
  const bundlerSet = new Set<string>();

  const buysByTx = new Map<string, ParsedPonsCurveBuy[]>();
  const buysByBlockCaller = new Map<string, Set<string>>();
  const nonDeployersByBlock = new Map<number, Set<string>>();

  for (const buy of windowBuys) {
    const recipient = buy.recipient.toLowerCase();
    const caller = buy.caller.toLowerCase();
    const isDeployer = deployer !== null && recipient === deployer;

    if (!isDeployer) {
      sniperSet.add(recipient);
      if (buy.blockNumber === params.launchBlock) {
        // Non-deployer landed a buy in the exact launch block alongside TokenLaunched.
        bundlerSet.add(recipient);
      }
      const blockWallets = nonDeployersByBlock.get(buy.blockNumber) ?? new Set<string>();
      blockWallets.add(recipient);
      nonDeployersByBlock.set(buy.blockNumber, blockWallets);
    }

    if (buy.transactionHash) {
      const txList = buysByTx.get(buy.transactionHash) ?? [];
      txList.push(buy);
      buysByTx.set(buy.transactionHash, txList);
    }

    if (caller && caller !== recipient && !isDeployer) {
      const key = `${buy.blockNumber}:${caller}`;
      const set = buysByBlockCaller.get(key) ?? new Set<string>();
      set.add(recipient);
      buysByBlockCaller.set(key, set);
    }
  }

  // Multi-buy transactions (batched CurveBuy logs in one tx).
  for (const txBuys of buysByTx.values()) {
    const distinctRecipients = new Set(txBuys.map((b) => b.recipient.toLowerCase()));
    if (distinctRecipients.size >= 2) {
      for (const wallet of distinctRecipients) {
        if (!deployer || wallet !== deployer) {
          bundlerSet.add(wallet);
          sniperSet.add(wallet);
        }
      }
    }
  }

  // Shared router/executor contract batching multiple wallets in the exact same block.
  for (const wallets of buysByBlockCaller.values()) {
    if (wallets.size >= 2) {
      for (const wallet of wallets) bundlerSet.add(wallet);
    }
  }

  // 3+ distinct non-deployer wallets hitting the exact same ~0.22s block in the launch window.
  for (const wallets of nonDeployersByBlock.values()) {
    if (wallets.size >= 3) {
      for (const wallet of wallets) bundlerSet.add(wallet);
    }
  }

  return {
    windowBuys,
    sniperWallets: [...sniperSet],
    bundlerWallets: [...bundlerSet],
  };
}

export function analyzePonsLaunchBuys(input: AnalyzePonsLaunchInput): PonsLaunchAuditResult {
  const { windowBuys, sniperWallets, bundlerWallets } = classifyPonsOpeningWallets({
    launchBlock: input.launchBlock,
    deployerAddress: input.deployerAddress,
    curveAddress: input.curveAddress,
    buyLogs: input.buyLogs,
    sniperBlockWindow: input.sniperBlockWindow,
  });

  const normalizedBalances = new Map<string, bigint>();
  for (const [wallet, bal] of input.currentBalancesByWallet.entries()) {
    if (bal > 0n) normalizedBalances.set(wallet.toLowerCase(), bal);
  }

  let sniperHeldRaw = 0n;
  let holdingSniperCount = 0;
  for (const wallet of sniperWallets) {
    const bal = normalizedBalances.get(wallet) ?? 0n;
    if (bal > 0n) {
      sniperHeldRaw += bal;
      holdingSniperCount += 1;
    }
  }

  let bundlerHeldRaw = 0n;
  let holdingBundlerCount = 0;
  for (const wallet of bundlerWallets) {
    const bal = normalizedBalances.get(wallet) ?? 0n;
    if (bal > 0n) {
      bundlerHeldRaw += bal;
      holdingBundlerCount += 1;
    }
  }

  return {
    tokenAddress: input.tokenAddress.toLowerCase(),
    launchBlock: input.launchBlock,
    sniperPercentage: toSupplyPercent(sniperHeldRaw, input.totalSupplyRaw),
    sniperCount: holdingSniperCount,
    bundlerPercentage: toSupplyPercent(bundlerHeldRaw, input.totalSupplyRaw),
    bundlerCount: holdingBundlerCount,
    totalOpeningBuys: windowBuys.length,
    detectedSniperCount: sniperWallets.length,
    detectedBundlerCount: bundlerWallets.length,
    observedAt: input.observedAt ?? new Date().toISOString(),
  };
}

function cacheTtlForAge(ageMinutes?: number | null): number {
  return ageMinutes != null && ageMinutes <= 30 ? YOUNG_TOKEN_TTL_MS : MATURE_TOKEN_TTL_MS;
}

export function getCachedPonsLaunchAudit(tokenAddress: string): PonsLaunchAuditResult | null {
  if (!isEvmAddress(tokenAddress)) return null;
  const entry = getGlobals().auditCache.get(tokenAddress.toLowerCase());
  if (!entry?.result) return null;
  if (Date.now() - entry.fetchedAt > cacheTtlForAge(entry.ageMinutes)) return null;
  return entry.result;
}

async function hydrateLaunchMetaFromRedis(tokenAddress: string): Promise<PonsLaunchMeta | null> {
  const norm = tokenAddress.toLowerCase();
  const { launchMetaCache } = getGlobals();
  const mem = launchMetaCache.get(norm);
  if (mem) return mem;
  const raw = await redis.get(`${REDIS_META_PREFIX}${norm}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Omit<PonsLaunchMeta, 'openingBuys'> & {
      openingBuys: Array<Omit<ParsedPonsCurveBuy, 'tokenAmountRaw'> & { tokenAmountRaw: string }>;
    };
    if (!parsed?.curveAddress || !Number.isFinite(parsed.launchBlock)) return null;
    const restored: PonsLaunchMeta = {
      ...parsed,
      openingBuys: (parsed.openingBuys ?? []).map((b) => ({
        ...b,
        tokenAmountRaw: BigInt(b.tokenAmountRaw || '0'),
      })),
    };
    launchMetaCache.set(norm, restored);
    return restored;
  } catch {
    return null;
  }
}

function serializeLaunchMeta(meta: PonsLaunchMeta): string {
  return JSON.stringify({
    ...meta,
    openingBuys: meta.openingBuys.map((b) => ({
      ...b,
      tokenAmountRaw: b.tokenAmountRaw.toString(),
    })),
  });
}

export async function hydratePonsLaunchAuditsFromRedis(
  tokenAddresses: string[],
): Promise<Map<string, PonsLaunchAuditResult>> {
  const out = new Map<string, PonsLaunchAuditResult>();
  const { auditCache } = getGlobals();
  const missing: string[] = [];

  for (const addr of tokenAddresses) {
    if (!isEvmAddress(addr)) continue;
    const norm = addr.toLowerCase();
    const mem = getCachedPonsLaunchAudit(norm);
    if (mem) {
      out.set(norm, mem);
    } else if (!auditCache.has(norm)) {
      missing.push(norm);
    }
  }

  if (missing.length === 0 || redis.isDegraded) return out;

  await Promise.all(
    missing.slice(0, 25).map(async (norm) => {
      const raw = await redis.get(`${REDIS_AUDIT_PREFIX}${norm}`);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as PonsLaunchAuditResult;
        if (parsed?.tokenAddress?.toLowerCase() !== norm) return;
        const ageMs = Date.now() - Date.parse(parsed.observedAt || '');
        if (!Number.isFinite(ageMs) || ageMs > MATURE_TOKEN_TTL_MS) return;
        auditCache.set(norm, { result: parsed, fetchedAt: Date.now() - Math.max(0, ageMs) });
        out.set(norm, parsed);
      } catch {
        // Ignore malformed cache entries; fresh RPC scan will overwrite.
      }
    }),
  );

  return out;
}

async function resolveTokenLaunchedLog(
  tokenAddress: string,
  latestBlock: number,
  ageMinutesHint?: number | null,
): Promise<{ launchBlock: number; curveAddress: string; deployerAddress: string | null } | null> {
  const paddedToken = `0x${encodeAddress(tokenAddress)}`;
  const windows: Array<[number, number]> = [];

  if (ageMinutesHint != null && Number.isFinite(ageMinutesHint) && ageMinutesHint >= 0) {
    const estBlocks = Math.ceil((ageMinutesHint * 60) / 0.217);
    const primaryStart = Math.max(0, latestBlock - Math.min(2_500_000, estBlocks + 40_000));
    windows.push([primaryStart, latestBlock]);
    if (primaryStart > 0) {
      const midStart = Math.max(0, primaryStart - 3_500_000);
      windows.push([midStart, primaryStart - 1]);
      if (midStart > 0) {
        const deepStart = Math.max(0, latestBlock - 9_500_000);
        if (deepStart < midStart) windows.push([deepStart, midStart - 1]);
      }
    }
  } else {
    const w1Start = Math.max(0, latestBlock - 500_000);
    const w2Start = Math.max(0, latestBlock - 3_500_000);
    const w3Start = Math.max(0, latestBlock - 9_500_000);
    windows.push([w1Start, latestBlock]);
    if (w2Start < w1Start) windows.push([w2Start, w1Start - 1]);
    if (w3Start < w2Start) windows.push([w3Start, w2Start - 1]);
  }

  for (const [fromBlock, toBlock] of windows) {
    const logs = await robinhoodRpcCall<RpcLogEntry[]>('eth_getLogs', [
      {
        address: ROBINHOOD_PONS_V2_FACTORY,
        topics: [PONS_TOKEN_LAUNCHED_TOPIC0, paddedToken],
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock: `0x${toBlock.toString(16)}`,
      },
    ]);
    if (Array.isArray(logs) && logs.length > 0) {
      const log = logs[0];
      const launchBlock = parseHexBlockNumber(log.blockNumber);
      const curveAddress = decodeTopicAddress(log.topics?.[2]);
      if (Number.isFinite(launchBlock) && curveAddress) {
        return {
          launchBlock,
          curveAddress,
          deployerAddress: decodeTopicAddress(log.topics?.[3]),
        };
      }
    }
  }

  return null;
}

async function resolvePonsLaunchMeta(params: QueuedScanJob): Promise<PonsLaunchMeta | null> {
  const norm = params.tokenAddress.toLowerCase();
  const existing = await hydrateLaunchMetaFromRedis(norm);
  if (existing) return existing;

  const latestHex = await robinhoodRpcCall<string>('eth_blockNumber', []);
  const latestBlock = parseHexBlockNumber(latestHex);
  if (!Number.isFinite(latestBlock) || latestBlock <= 0) return null;

  const launchLog = await resolveTokenLaunchedLog(norm, latestBlock, params.ageMinutes);
  const curveAddress =
    launchLog?.curveAddress ??
    (params.curveAddress && isEvmAddress(params.curveAddress)
      ? params.curveAddress.toLowerCase()
      : await readPonsV2LaunchedCurveByToken(norm));

  if (!launchLog || !curveAddress) {
    return null;
  }

  const windowEnd = Math.min(latestBlock, launchLog.launchBlock + PONS_SNIPER_BLOCK_WINDOW);
  const rawBuyLogs = await robinhoodRpcCall<RpcLogEntry[]>('eth_getLogs', [
    {
      address: curveAddress,
      topics: [PONS_CURVE_BUY_TOPIC0],
      fromBlock: `0x${launchLog.launchBlock.toString(16)}`,
      toBlock: `0x${windowEnd.toString(16)}`,
    },
  ]);

  const openingBuys = parsePonsCurveBuyLogs(Array.isArray(rawBuyLogs) ? rawBuyLogs : []);
  const deployerAddress =
    launchLog.deployerAddress ??
    (params.deployerAddress && isEvmAddress(params.deployerAddress)
      ? params.deployerAddress.toLowerCase()
      : null);

  const classified = classifyPonsOpeningWallets({
    launchBlock: launchLog.launchBlock,
    deployerAddress,
    curveAddress,
    buyLogs: openingBuys,
  });

  const uniqueWallets = Array.from(
    new Set([...classified.sniperWallets, ...classified.bundlerWallets]),
  ).slice(0, MAX_WALLET_BALANCE_PROBES);

  const meta: PonsLaunchMeta = {
    tokenAddress: norm,
    curveAddress,
    deployerAddress,
    launchBlock: launchLog.launchBlock,
    openingBuys,
    uniqueEarlyWallets: uniqueWallets,
    sniperWallets: classified.sniperWallets,
    bundlerWallets: classified.bundlerWallets,
  };

  getGlobals().launchMetaCache.set(norm, meta);
  void redis.set(`${REDIS_META_PREFIX}${norm}`, serializeLaunchMeta(meta), REDIS_META_TTL_SEC);
  return meta;
}

async function runPonsLaunchAudit(job: QueuedScanJob): Promise<PonsLaunchAuditResult | null> {
  const norm = job.tokenAddress.toLowerCase();
  if (!isEvmAddress(norm)) return null;

  const { auditCache } = getGlobals();
  const existing = auditCache.get(norm);
  if (existing?.result && Date.now() - existing.fetchedAt <= cacheTtlForAge(job.ageMinutes)) {
    return existing.result;
  }
  if (existing?.nextRetryAt && Date.now() < existing.nextRetryAt) {
    return null;
  }

  try {
    const meta = await resolvePonsLaunchMeta(job);
    if (!meta) {
      auditCache.set(norm, {
        result: null,
        fetchedAt: Date.now(),
        nextRetryAt: Date.now() + FAILURE_COOLDOWN_MS,
        ageMinutes: job.ageMinutes,
      });
      return null;
    }

    let result: PonsLaunchAuditResult;
    if (meta.uniqueEarlyWallets.length === 0) {
      result = {
        tokenAddress: norm,
        launchBlock: meta.launchBlock,
        sniperPercentage: 0,
        sniperCount: 0,
        bundlerPercentage: 0,
        bundlerCount: 0,
        totalOpeningBuys: meta.openingBuys.length,
        detectedSniperCount: meta.sniperWallets.length,
        detectedBundlerCount: meta.bundlerWallets.length,
        observedAt: new Date().toISOString(),
      };
    } else {
      const batchCalls = [
        { method: 'eth_call', params: [{ to: norm, data: '0x18160ddd' }, 'latest'] },
        ...meta.uniqueEarlyWallets.map((wallet) => ({
          method: 'eth_call',
          params: [{ to: norm, data: encodeErc20BalanceOf(wallet) }, 'latest'],
        })),
      ];
      const results = await robinhoodRpcBatch<string>(batchCalls);
      const totalSupplyRaw = decodeUint256Result(results[0]);
      const balancesByWallet = new Map<string, bigint>();
      meta.uniqueEarlyWallets.forEach((wallet, idx) => {
        balancesByWallet.set(wallet, decodeUint256Result(results[idx + 1]));
      });

      result = analyzePonsLaunchBuys({
        tokenAddress: norm,
        launchBlock: meta.launchBlock,
        deployerAddress: meta.deployerAddress,
        curveAddress: meta.curveAddress,
        buyLogs: meta.openingBuys,
        currentBalancesByWallet: balancesByWallet,
        totalSupplyRaw,
      });
    }

    auditCache.set(norm, {
      result,
      fetchedAt: Date.now(),
      ageMinutes: job.ageMinutes,
    });

    void redis.set(`${REDIS_AUDIT_PREFIX}${norm}`, JSON.stringify(result), REDIS_AUDIT_TTL_SEC);

    updateTokenCard(
      norm,
      {
        sniperPercentage: result.sniperPercentage,
        sniperCount: result.sniperCount,
        bundlerPercentage: result.bundlerPercentage,
        bundlerCount: result.bundlerCount,
        ownershipEvidence: {
          status: 'measured',
          source: SCANNER_SOURCE,
          observedAt: result.observedAt,
        },
      },
      SCANNER_SOURCE,
      'fresh',
      result.observedAt,
    );

    void saveTokenCardEvidence(
      norm,
      'ownership',
      {
        sniperPercentage: result.sniperPercentage,
        sniperCount: result.sniperCount,
        bundlerPercentage: result.bundlerPercentage,
        bundlerCount: result.bundlerCount,
        launchBlock: result.launchBlock,
        curveAddress: meta.curveAddress,
        deployerAddress: meta.deployerAddress,
        totalOpeningBuys: result.totalOpeningBuys,
        detectedSniperCount: result.detectedSniperCount,
        detectedBundlerCount: result.detectedBundlerCount,
        sniperBlockWindow: PONS_SNIPER_BLOCK_WINDOW,
      },
      result.observedAt,
      AUDIT_VERSION,
    );

    return result;
  } catch (err) {
    logger.debug('[robinhood-pons-sniper] launch scan deferred', {
      tokenAddress: norm,
      message: err instanceof Error ? err.message : String(err),
    });
    auditCache.set(norm, {
      result: existing?.result ?? null,
      fetchedAt: Date.now(),
      nextRetryAt: Date.now() + FAILURE_COOLDOWN_MS,
      ageMinutes: job.ageMinutes,
    });
    return existing?.result ?? null;
  }
}

async function drainScanQueue(): Promise<void> {
  const s = getGlobals();
  if (s.draining) return;
  s.draining = true;
  try {
    while (s.queue.length > 0) {
      const nextJob = s.queue.shift();
      if (!nextJob) continue;
      const norm = nextJob.tokenAddress.toLowerCase();
      s.queuedKeys.delete(norm);
      if (s.inFlight.has(norm)) continue;

      const promise = runPonsLaunchAudit(nextJob).finally(() => {
        s.inFlight.delete(norm);
      });
      s.inFlight.set(norm, promise);
      await promise;
    }
  } finally {
    s.draining = false;
  }
}

export function queuePonsLaunchAudit(params: {
  tokenAddress: string;
  curveAddress?: string | null;
  deployerAddress?: string | null;
  ageMinutes?: number | null;
  priority?: 'high' | 'normal';
}): void {
  if (!isEvmAddress(params.tokenAddress)) return;
  const norm = params.tokenAddress.toLowerCase();
  const s = getGlobals();

  if (getCachedPonsLaunchAudit(norm)) return;
  const existing = s.auditCache.get(norm);
  if (existing?.nextRetryAt && Date.now() < existing.nextRetryAt) return;
  if (s.inFlight.has(norm) || s.queuedKeys.has(norm)) return;
  if (s.queue.length >= MAX_QUEUE_LENGTH && params.priority !== 'high') return;

  const job: QueuedScanJob = {
    tokenAddress: norm,
    curveAddress: params.curveAddress,
    deployerAddress: params.deployerAddress,
    ageMinutes: params.ageMinutes,
  };

  s.queuedKeys.add(norm);
  if (params.priority === 'high') {
    s.queue.unshift(job);
  } else {
    s.queue.push(job);
  }

  queueMicrotask(() => {
    void drainScanQueue();
  });
}

export async function scanPonsLaunchAuditNow(params: {
  tokenAddress: string;
  curveAddress?: string | null;
  deployerAddress?: string | null;
  ageMinutes?: number | null;
}): Promise<PonsLaunchAuditResult | null> {
  if (!isEvmAddress(params.tokenAddress)) return null;
  const norm = params.tokenAddress.toLowerCase();
  const cached = getCachedPonsLaunchAudit(norm);
  if (cached) return cached;

  const s = getGlobals();
  const pending = s.inFlight.get(norm);
  if (pending) return pending;

  const promise = runPonsLaunchAudit({
    tokenAddress: norm,
    curveAddress: params.curveAddress,
    deployerAddress: params.deployerAddress,
    ageMinutes: params.ageMinutes,
  }).finally(() => {
    s.inFlight.delete(norm);
  });
  s.inFlight.set(norm, promise);
  return promise;
}
