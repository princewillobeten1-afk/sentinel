/**
 * Central Blockchain Service (Sprint 44 §4).
 *
 * Central registry and facade connecting all chain adapters, RPC pools,
 * health monitors, and transaction normalization interfaces.
 */

import { BlockchainAdapter } from './adapter';
import { SupportedChain } from './types';
import { SolanaAdapter } from './solana-adapter';
import { EthereumAdapter, BaseAdapter } from './evm-adapter';
import { RpcProviderPool, defaultRpcPool } from './rpc-provider';

export class BlockchainService {
  private static instance: BlockchainService;
  private adapters: Map<SupportedChain, BlockchainAdapter> = new Map();
  private rpcPool: RpcProviderPool;

  private constructor(rpcPool: RpcProviderPool = defaultRpcPool) {
    this.rpcPool = rpcPool;
    this.registerAdapter(new SolanaAdapter(this.rpcPool));
    this.registerAdapter(new EthereumAdapter(this.rpcPool));
    this.registerAdapter(new BaseAdapter(this.rpcPool));
  }

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  public registerAdapter(adapter: BlockchainAdapter): void {
    this.adapters.set(adapter.chainId, adapter);
  }

  public getAdapter(chainId: SupportedChain): BlockchainAdapter {
    const adapter = this.adapters.get(chainId);
    if (!adapter) {
      throw new Error(`Blockchain adapter not registered for chain: ${chainId}`);
    }
    return adapter;
  }

  public getSupportedChains(): Array<{ chainId: SupportedChain; name: string }> {
    return Array.from(this.adapters.values()).map((a) => ({
      chainId: a.chainId,
      name: a.name,
    }));
  }

  public getRpcPool(): RpcProviderPool {
    return this.rpcPool;
  }

  public async getHealthSummary(): Promise<{
    chains: Array<{ chainId: SupportedChain; name: string; isHealthy: boolean }>;
    providers: ReturnType<RpcProviderPool['getMetrics']>;
  }> {
    const providers = this.rpcPool.getMetrics();
    const chains = this.getSupportedChains().map((c) => {
      const chainProviders = providers.filter((p) => p.chainId === c.chainId);
      const isHealthy = chainProviders.some((p) => p.status === 'HEALTHY' || p.status === 'DEGRADED');
      return {
        chainId: c.chainId,
        name: c.name,
        isHealthy,
      };
    });

    return { chains, providers };
  }
}

export const blockchainService = BlockchainService.getInstance();
