export interface BlockchainConnectionConfig {
  network: string;
  rpcUrl: string;
  webSocketUrl?: string;
}

/**
 * BlockchainProvider — Central RPC & WebSocket connection abstraction layer.
 * Prevents scattering raw RPC URLs or WebSocket configurations across components.
 */
export class BlockchainProvider {
  private static instance: BlockchainProvider;
  private config: BlockchainConnectionConfig;

  private constructor() {
    // Devnet-first default — real fund movement (wallet deposit/withdraw)
    // requires an explicit NEXT_PUBLIC_SOLANA_NETWORK=solana:mainnet override.
    // See docs/security/threat-model.md's "Wallet transfers" section.
    this.config = {
      network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'solana:devnet',
      rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      webSocketUrl: process.env.NEXT_PUBLIC_SOLANA_WS_URL || 'wss://api.devnet.solana.com',
    };
  }

  public static getInstance(): BlockchainProvider {
    if (!BlockchainProvider.instance) {
      BlockchainProvider.instance = new BlockchainProvider();
    }
    return BlockchainProvider.instance;
  }

  public getConfig(): BlockchainConnectionConfig {
    return { ...this.config };
  }

  public getRpcUrl(): string {
    return this.config.rpcUrl;
  }

  public getNetwork(): string {
    return this.config.network;
  }

  public getWebSocketUrl(): string | undefined {
    return this.config.webSocketUrl;
  }
}

export const blockchainProvider = BlockchainProvider.getInstance();
