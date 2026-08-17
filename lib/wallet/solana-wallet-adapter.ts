import { IWalletAdapter } from './wallet-provider';

export class SolanaWalletAdapterImpl implements IWalletAdapter {
  readonly chainFamily = 'solana' as const;
  readonly chainId = 'solana';

  async connect(): Promise<{ address: string; chainId: string }> {
    return {
      address: '7xK9FixturedTraderWalletAddress3a19',
      chainId: this.chainId,
    };
  }

  async disconnect(): Promise<void> {}

  async getBalance(tokenAddress: string, walletAddress: string): Promise<number> {
    if (tokenAddress.includes('So1111111')) return 42.5;
    if (tokenAddress.includes('EPjFWdd5')) return 15420.0;
    return 1000.0;
  }

  async signTransaction(rawPayload: any): Promise<string> {
    return `solana_sig_${Date.now()}_5xTxHashExample`;
  }
}
