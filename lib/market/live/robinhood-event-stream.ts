import 'server-only';

import {
  getRobinhoodBlockNumber,
  getRobinhoodRecentLogs,
  type RobinhoodRpcLog,
} from '@/lib/blockchain/robinhood-rpc';
import { CHAIN_CONFIGS, ROBINHOOD_CHAIN_ID } from '@/lib/chains/chain-config';
import { updateTokenCard } from '@/lib/market/live/card-cache';
import { registerObservedPonsLaunch } from '@/lib/blockchain/robinhood-rpc-protocols';
import { invalidateRobinhoodNewPairsCache } from '@/lib/discovery/robinhood-feed';
import { broadcast } from '@/lib/ws/server';
import { buildTopic } from '@/lib/ws/topics';
import { logger } from '@/lib/server/logger';

/**
 * Known DEX Swap & Pair/Pool Creation EVM Event Signatures:
 * - Uniswap V2 PairCreated: 0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9
 * - Uniswap V3 PoolCreated: 0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118
 * - Uniswap V2 Swap:        0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822
 * - Uniswap V3 Swap:        0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
 */
export const ROBINHOOD_EVENT_TOPICS = {
  UNISWAP_V2_PAIR_CREATED:
    '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9',
  UNISWAP_V3_POOL_CREATED:
    '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118',
  UNISWAP_V2_SWAP:
    '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822',
  UNISWAP_V3_SWAP:
    '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
  UNISWAP_V4_INITIALIZE:
    '0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438',
  UNISWAP_V4_SWAP:
    '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f',
  PONS_V2_TOKEN_LAUNCHED:
    '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607',
  PONS_V2_CURVE_BUY:
    '0xec36bf571f136799e8dc0b0b8bea4b04d8bd3d43de838aab0d5fc21d4cbfc455',
  PONS_V2_CURVE_SELL:
    '0x8113d738abdcb6b38357e9d53a54a7157861a09031b453651f0fe7fe151f59df',
  PONS_V2_GRADUATION:
    '0x0a44ef75df69c534f43cd6c1aa3ef8983065fe5fe79ef9e79f6494e6f258c259',
} as const;

export interface RobinhoodNormalizedEvent {
  id: string;
  chainId: number;
  kind: 'pool_created' | 'swap';
  poolAddress: string;
  token0?: string;
  token1?: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  observedAt: string;
}

export interface RobinhoodStreamHealth {
  status: 'idle' | 'connected' | 'reconnecting' | 'degraded';
  transport: 'ws' | 'rpc-log-poll';
  lastBlockNumber: number | null;
  lastEventAt: number | null;
  reconnectAttempts: number;
  dedupCacheSize: number;
  lastError?: string;
}

interface StreamState {
  started: boolean;
  watchedTokens: Set<string>;
  poolToToken: Map<string, string>;
  seenEvents: Set<string>;
  lastBlockNumber: number | null;
  lastEventAt: number | null;
  reconnectAttempts: number;
  status: RobinhoodStreamHealth['status'];
  transport: RobinhoodStreamHealth['transport'];
  lastError?: string;
  pollTimer: ReturnType<typeof setTimeout> | null;
  ws: WebSocket | null;
  listeners: Set<(event: RobinhoodNormalizedEvent) => void>;
}

const globalForRhStream = globalThis as typeof globalThis & {
  __sentinelRobinhoodEventStream?: StreamState;
};

const state: StreamState = (globalForRhStream.__sentinelRobinhoodEventStream ??= {
  started: false,
  watchedTokens: new Set(),
  poolToToken: new Map(),
  seenEvents: new Set(),
  lastBlockNumber: null,
  lastEventAt: null,
  reconnectAttempts: 0,
  status: 'idle',
  transport: 'rpc-log-poll',
  pollTimer: null,
  ws: null,
  listeners: new Set(),
});

const MAX_SEEN_EVENTS = 2_500;
const BASE_POLL_MS = 3_000;
const MAX_BACKOFF_MS = 60_000;

function rememberEventId(eventId: string): boolean {
  if (state.seenEvents.has(eventId)) return false;
  if (state.seenEvents.size >= MAX_SEEN_EVENTS) {
    const oldest = state.seenEvents.values().next().value;
    if (oldest) state.seenEvents.delete(oldest);
  }
  state.seenEvents.add(eventId);
  return true;
}

function topicToAddress(topic?: string): string | undefined {
  if (!topic || topic.length < 42) return undefined;
  return `0x${topic.slice(-40).toLowerCase()}`;
}

function decodePoolAddressFromData(data?: string): string | undefined {
  if (!data || data.length < 66) return undefined;
  const clean = data.startsWith('0x') ? data.slice(2) : data;
  if (clean.length < 64) return undefined;
  // First 32-byte word contains the pair address in PairCreated; last word in PoolCreated
  const slice = clean.length >= 128 ? clean.slice(clean.length - 64) : clean.slice(0, 64);
  return `0x${slice.slice(-40).toLowerCase()}`;
}

export function decodeRobinhoodLog(log: RobinhoodRpcLog): RobinhoodNormalizedEvent | null {
  if (!log || log.removed || !log.topics || log.topics.length === 0) return null;
  const sig = log.topics[0]?.toLowerCase();
  const blockNumber = Number.parseInt(log.blockNumber, 16) || 0;
  const logIndex = Number.parseInt(log.logIndex, 16) || 0;
  const id = `${log.transactionHash.toLowerCase()}:${logIndex}`;
  const observedAt = new Date().toISOString();

  if (sig === ROBINHOOD_EVENT_TOPICS.PONS_V2_TOKEN_LAUNCHED) {
    const token = topicToAddress(log.topics[1]);
    const curve = topicToAddress(log.topics[2]);
    if (!curve) return null;
    return {
      id,
      chainId: ROBINHOOD_CHAIN_ID,
      kind: 'pool_created',
      poolAddress: curve,
      token0: '0x0000000000000000000000000000000000000000',
      token1: token,
      txHash: log.transactionHash,
      blockNumber,
      logIndex,
      observedAt,
    };
  }

  if (sig === ROBINHOOD_EVENT_TOPICS.UNISWAP_V4_INITIALIZE) {
    const poolId = log.topics[1]?.toLowerCase();
    const token0 = topicToAddress(log.topics[2]);
    const token1 = topicToAddress(log.topics[3]);
    if (!poolId) return null;
    return {
      id,
      chainId: ROBINHOOD_CHAIN_ID,
      kind: 'pool_created',
      poolAddress: poolId,
      token0,
      token1,
      txHash: log.transactionHash,
      blockNumber,
      logIndex,
      observedAt,
    };
  }

  if (
    sig === ROBINHOOD_EVENT_TOPICS.UNISWAP_V2_PAIR_CREATED ||
    sig === ROBINHOOD_EVENT_TOPICS.UNISWAP_V3_POOL_CREATED
  ) {
    const token0 = topicToAddress(log.topics[1]);
    const token1 = topicToAddress(log.topics[2]);
    const poolAddress = decodePoolAddressFromData(log.data) ?? log.address.toLowerCase();
    return {
      id,
      chainId: ROBINHOOD_CHAIN_ID,
      kind: 'pool_created',
      poolAddress,
      token0,
      token1,
      txHash: log.transactionHash,
      blockNumber,
      logIndex,
      observedAt,
    };
  }

  if (sig === ROBINHOOD_EVENT_TOPICS.UNISWAP_V4_SWAP) {
    const poolId = log.topics[1]?.toLowerCase();
    if (!poolId) return null;
    return {
      id,
      chainId: ROBINHOOD_CHAIN_ID,
      kind: 'swap',
      poolAddress: poolId,
      txHash: log.transactionHash,
      blockNumber,
      logIndex,
      observedAt,
    };
  }

  if (
    sig === ROBINHOOD_EVENT_TOPICS.UNISWAP_V2_SWAP ||
    sig === ROBINHOOD_EVENT_TOPICS.UNISWAP_V3_SWAP ||
    sig === ROBINHOOD_EVENT_TOPICS.PONS_V2_CURVE_BUY ||
    sig === ROBINHOOD_EVENT_TOPICS.PONS_V2_CURVE_SELL
  ) {
    return {
      id,
      chainId: ROBINHOOD_CHAIN_ID,
      kind: 'swap',
      poolAddress: log.address.toLowerCase(),
      txHash: log.transactionHash,
      blockNumber,
      logIndex,
      observedAt,
    };
  }

  return null;
}

function dispatchNormalizedEvent(event: RobinhoodNormalizedEvent): void {
  if (!rememberEventId(event.id)) return;
  state.lastEventAt = Date.now();

  if (event.kind === 'pool_created') {
    const wrapped = CHAIN_CONFIGS.robinhood.nativeCurrency.wrappedAddress.toLowerCase();
    const zero = '0x0000000000000000000000000000000000000000';
    const usdg = CHAIN_CONFIGS.robinhood.stablecoinAddress?.toLowerCase();
    const isQuoteAddr = (addr?: string) => !addr || addr === wrapped || addr === zero || addr === usdg;
    const targetToken = !isQuoteAddr(event.token0) ? event.token0 : event.token1;
    if (targetToken && targetToken !== zero) {
      state.poolToToken.set(event.poolAddress, targetToken);
      updateTokenCard(
        targetToken,
        { liquidityPoolAddress: event.poolAddress },
        'robinhood-rpc-logs',
        'fresh',
        event.observedAt,
      );
    }
    try {
      broadcast('feed.discovery:new', {
        type: 'NEW_POOL',
        chain: 'robinhood',
        poolAddress: event.poolAddress,
        token0: event.token0,
        token1: event.token1,
        observedAt: event.observedAt,
      });
    } catch {
      // Broadcast server may not be initialized in standalone test runs
    }
  } else if (event.kind === 'swap') {
    const tokenAddress = state.poolToToken.get(event.poolAddress);
    if (tokenAddress) {
      try {
        broadcast(buildTopic('token.trade', tokenAddress), {
          type: 'SWAP',
          chain: 'robinhood',
          signature: event.txHash,
          mint: tokenAddress,
          poolAddress: event.poolAddress,
          timestamp: event.observedAt,
        });
      } catch {
        // Ignore if WS server is not attached
      }
    }
  }

  state.listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Never break stream processing on listener failure
    }
  });
}

function nextPollDelayMs(): number {
  if (state.reconnectAttempts <= 0) return BASE_POLL_MS;
  return Math.min(MAX_BACKOFF_MS, BASE_POLL_MS * 2 ** Math.min(state.reconnectAttempts, 4));
}

async function pollLogsTick(): Promise<void> {
  if (!state.started) return;

  try {
    const latestBlock = await getRobinhoodBlockNumber();
    // Robinhood Chain builds blocks ~10x/sec; allow wide catch-up window without skipping blocks
    const fromBlock =
      state.lastBlockNumber !== null
        ? Math.max(state.lastBlockNumber + 1, latestBlock - 2_000)
        : Math.max(0, latestBlock - 600);

    if (fromBlock <= latestBlock) {
      const ammFactories = CHAIN_CONFIGS.robinhood.supportedDexes
        .filter((d) => d.id !== 'pons-v2')
        .map((d) => d.factoryAddress)
        .filter((addr): addr is string => Boolean(addr));

      const ponsFactory = CHAIN_CONFIGS.robinhood.supportedDexes.find(
        (d) => d.id === 'pons-v2',
      )?.factoryAddress;
      const v4PoolManager = CHAIN_CONFIGS.robinhood.supportedDexes.find(
        (d) => d.id === 'uniswap-v4-robinhood',
      )?.poolManagerAddress;

      // Address-based getLogs accepts 20-byte contract/curve addresses; V4 32-byte poolIds go via PoolManager
      const poolAddresses = Array.from(state.poolToToken.keys())
        .filter((addr) => /^0x[a-f0-9]{40}$/i.test(addr))
        .slice(0, 25);

      const requests: Promise<RobinhoodRpcLog[]>[] = [];
      if (ammFactories.length > 0) {
        requests.push(
          getRobinhoodRecentLogs({
            fromBlock,
            toBlock: latestBlock,
            address: ammFactories,
            topics: [
              [
                ROBINHOOD_EVENT_TOPICS.UNISWAP_V2_PAIR_CREATED,
                ROBINHOOD_EVENT_TOPICS.UNISWAP_V3_POOL_CREATED,
              ],
            ],
          }).catch(() => []),
        );
      }
      if (ponsFactory) {
        requests.push(
          getRobinhoodRecentLogs({
            fromBlock,
            toBlock: latestBlock,
            address: ponsFactory,
            topics: [
              [
                ROBINHOOD_EVENT_TOPICS.PONS_V2_TOKEN_LAUNCHED,
                ROBINHOOD_EVENT_TOPICS.PONS_V2_GRADUATION,
              ],
            ],
          }).catch(() => []),
        );
      }
      if (v4PoolManager) {
        requests.push(
          getRobinhoodRecentLogs({
            fromBlock,
            toBlock: latestBlock,
            address: v4PoolManager,
            topics: [
              [
                ROBINHOOD_EVENT_TOPICS.UNISWAP_V4_INITIALIZE,
                ROBINHOOD_EVENT_TOPICS.UNISWAP_V4_SWAP,
              ],
            ],
          }).catch(() => []),
        );
      }
      if (poolAddresses.length > 0) {
        requests.push(
          getRobinhoodRecentLogs({
            fromBlock,
            toBlock: latestBlock,
            address: poolAddresses,
            topics: [
              [
                ROBINHOOD_EVENT_TOPICS.PONS_V2_CURVE_BUY,
                ROBINHOOD_EVENT_TOPICS.PONS_V2_CURVE_SELL,
                ROBINHOOD_EVENT_TOPICS.UNISWAP_V2_SWAP,
                ROBINHOOD_EVENT_TOPICS.UNISWAP_V3_SWAP,
              ],
            ],
          }).catch(() => []),
        );
      }

      const batches = await Promise.all(requests);
      for (const batch of batches) {
        for (const rawLog of batch) {
          const decoded = decodeRobinhoodLog(rawLog);
          if (!decoded) continue;
          if (
            !state.seenEvents.has(decoded.id) &&
            rawLog.topics?.[0]?.toLowerCase() === ROBINHOOD_EVENT_TOPICS.PONS_V2_TOKEN_LAUNCHED &&
            decoded.token1
          ) {
            registerObservedPonsLaunch({
              tokenAddress: decoded.token1,
              curveAddress: decoded.poolAddress,
              deployerAddress: topicToAddress(rawLog.topics?.[3]),
              blockNumber: decoded.blockNumber,
              txHash: decoded.txHash,
            });
            invalidateRobinhoodNewPairsCache();
          }
          dispatchNormalizedEvent(decoded);
        }
      }
      state.lastBlockNumber = latestBlock;
    }

    state.status = 'connected';
    state.reconnectAttempts = 0;
    state.lastError = undefined;
  } catch (error) {
    state.reconnectAttempts += 1;
    state.status = state.reconnectAttempts > 2 ? 'degraded' : 'reconnecting';
    state.lastError = error instanceof Error ? error.message : String(error);
    logger.debug('[robinhood-event-stream] Poll tick failed', {
      attempt: state.reconnectAttempts,
      error: state.lastError,
    });
  } finally {
    if (state.started) {
      state.pollTimer = setTimeout(() => {
        void pollLogsTick();
      }, nextPollDelayMs());
    }
  }
}

export function registerRobinhoodPoolWatch(tokenAddress: string, poolAddress: string): void {
  const normToken = tokenAddress.toLowerCase();
  const normPool = poolAddress.toLowerCase();
  state.watchedTokens.add(normToken);
  state.poolToToken.set(normPool, normToken);
}

export function startRobinhoodEventStream(): void {
  if (state.started) return;
  state.started = true;
  state.status = 'reconnecting';

  const wsUrl = CHAIN_CONFIGS.robinhood.websocketUrl;
  if (wsUrl && typeof WebSocket !== 'undefined') {
    state.transport = 'ws';
    try {
      const ws = new WebSocket(wsUrl);
      state.ws = ws;
      ws.onopen = () => {
        state.status = 'connected';
        state.reconnectAttempts = 0;
        const factories = CHAIN_CONFIGS.robinhood.supportedDexes
          .map((d) => d.factoryAddress)
          .filter((a): a is string => Boolean(a));
        if (factories.length > 0) {
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_subscribe',
              params: [
                'logs',
                {
                  address: factories,
                  topics: [
                    [
                      ROBINHOOD_EVENT_TOPICS.UNISWAP_V2_PAIR_CREATED,
                      ROBINHOOD_EVENT_TOPICS.UNISWAP_V3_POOL_CREATED,
                    ],
                  ],
                },
              ],
            }),
          );
        }
      };
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(String(msg.data));
          const log = parsed?.params?.result as RobinhoodRpcLog | undefined;
          if (log) {
            const decoded = decodeRobinhoodLog(log);
            if (decoded) dispatchNormalizedEvent(decoded);
          }
        } catch {
          // Ignore malformed WS frames
        }
      };
      ws.onerror = () => {
        state.status = 'reconnecting';
      };
      ws.onclose = () => {
        state.ws = null;
        if (state.started) {
          state.reconnectAttempts += 1;
          state.transport = 'rpc-log-poll';
          state.pollTimer = setTimeout(() => {
            void pollLogsTick();
          }, nextPollDelayMs());
        }
      };
      return;
    } catch {
      state.transport = 'rpc-log-poll';
    }
  }

  state.transport = 'rpc-log-poll';
  void pollLogsTick();
}

export function stopRobinhoodEventStream(): void {
  state.started = false;
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
  if (state.ws) {
    try {
      state.ws.close();
    } catch {
      // ignore
    }
    state.ws = null;
  }
  state.status = 'idle';
}

export function onRobinhoodEvent(listener: (event: RobinhoodNormalizedEvent) => void): () => void {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

export function getRobinhoodStreamHealth(): RobinhoodStreamHealth {
  return {
    status: state.status,
    transport: state.transport,
    lastBlockNumber: state.lastBlockNumber,
    lastEventAt: state.lastEventAt,
    reconnectAttempts: state.reconnectAttempts,
    dedupCacheSize: state.seenEvents.size,
    ...(state.lastError ? { lastError: state.lastError } : {}),
  };
}

