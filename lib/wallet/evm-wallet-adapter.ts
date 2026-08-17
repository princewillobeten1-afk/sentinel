import { IWalletAdapter } from './wallet-provider';

export class EvmWalletAdapterImpl implements IWalletAdapter {
  readonly chainFamily = 'evm' as const;
  readonly chainId: string;

  constructor(chainId = 'base') {
    this.chainId = chainId;
  }

  async connect(): Promise<{ address: string; chainId: string }> {
    return {
      address: '0x71C6793A8B01b50A96B75811776599b5D35888F1',
      chainId: this.chainId,
    };
  }

  async disconnect(): Promise<void> {}

  async getBalance(tokenAddress: string, walletAddress: string): Promise<number> {
    return 1500.0;
  }

  async signTransaction(rawPayload: any): Promise<string> {
    return `0xEvmSig_${Date.now()}_a1b2c3d4e5f67890`;
  }
}
