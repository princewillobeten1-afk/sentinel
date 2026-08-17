import { DexAdapter } from './types';
import { SolanaDexAdapter } from './solana-dex-adapter';
import { UniswapV2Adapter } from './uniswap-v2-adapter';
import { UniswapV3Adapter } from './uniswap-v3-adapter';

export class DexAdapterRegistry {
  private static instance: DexAdapterRegistry;
  private adapters: Map<string, DexAdapter> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): DexAdapterRegistry {
    if (!DexAdapterRegistry.instance) {
      DexAdapterRegistry.instance = new DexAdapterRegistry();
    }
    return DexAdapterRegistry.instance;
  }

  private registerDefaults(): void {
    // Solana DEXes
    this.register(new SolanaDexAdapter('raydium_cpmm'));
    this.register(new SolanaDexAdapter('raydium_amm'));
    this.register(new SolanaDexAdapter('orca_whirlpool'));
    this.register(new SolanaDexAdapter('meteora'));
    this.register(new SolanaDexAdapter('pump_fun'));

    // EVM DEXes
    this.register(new UniswapV2Adapter('base'));
    this.register(new UniswapV2Adapter('ethereum'));
    this.register(new UniswapV3Adapter('base'));
    this.register(new UniswapV3Adapter('ethereum'));
  }

  public register(adapter: DexAdapter): void {
    const key = `${adapter.chainId}:${adapter.protocol}`;
    this.adapters.set(key, adapter);
  }

  public getAdapter(chainId: string, protocol: string): DexAdapter | undefined {
    return this.adapters.get(`${chainId}:${protocol}`);
  }

  public listAdapters(): DexAdapter[] {
    return Array.from(this.adapters.values());
  }

  public reset(): void {
    this.adapters.clear();
    this.registerDefaults();
  }
}

export const dexAdapterRegistry = DexAdapterRegistry.getInstance();
