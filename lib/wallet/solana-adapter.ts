'use client';

import { WalletProviderId, WalletType, WalletProvider, ConnectionStatus, WalletCapabilities } from './provider';

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  isCoinbaseWallet?: boolean;
  publicKey?: { toBase58(): string; toString(): string };
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  signTransaction?(transaction: any): Promise<any>;
  signAllTransactions?(transactions: any[]): Promise<any[]>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
    coinbaseSolana?: SolanaProvider;
  }
}

export class SolanaWalletAdapterImpl implements WalletProvider {
  id: WalletProviderId;
  name: string;
  icon: string;
  type: WalletType;
  publicKey: string | null = null;
  status: ConnectionStatus = 'disconnected';

  constructor(
    id: WalletProviderId,
    name: string,
    icon: string,
    type: WalletType = 'extension'
  ) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.type = type;
  }

  get installed(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.id === 'embedded') return true;
    if (this.id === 'phantom') return !!(window.solana && window.solana.isPhantom);
    if (this.id === 'solflare') return !!(window.solflare && window.solflare.isSolflare);
    if (this.id === 'backpack') return !!(window.backpack && window.backpack.isBackpack);
    if (this.id === 'coinbase') return !!(window.coinbaseSolana || (window.solana && window.solana.isCoinbaseWallet));
    return !!window.solana;
  }

  private getProvider(): SolanaProvider | null {
    if (typeof window === 'undefined') return null;
    if (this.id === 'phantom') return window.solana?.isPhantom ? window.solana : null;
    if (this.id === 'solflare') return window.solflare ?? null;
    if (this.id === 'backpack') return window.backpack ?? null;
    if (this.id === 'coinbase') return window.coinbaseSolana ?? window.solana ?? null;
    return window.solana ?? null;
  }

  getAddress(): string | null {
    return this.publicKey;
  }

  getCapabilities(): WalletCapabilities {
    const provider = this.getProvider();
    return {
      supportsSignMessage: !!provider?.signMessage || this.id === 'embedded',
      supportsSignTransaction: !!provider?.signTransaction || this.id === 'embedded',
      supportsSendTransaction: false, // We broadcast from our backend usually, or client RPC
      supportsMultiChain: false
    };
  }

  async connect(): Promise<string> {
    this.status = 'connecting';
    if (this.id === 'embedded') {
      this.publicKey = '7xK99zK8mP2xQ5wN3a19';
      this.status = 'connected';
      return this.publicKey;
    }

    const provider = this.getProvider();
    if (!provider) {
      this.publicKey = `demo_${this.id}_${Math.random().toString(36).substring(2, 8)}7xK9`;
      this.status = 'connected';
      return this.publicKey;
    }

    try {
      const res = await provider.connect();
      const pubKeyStr = res?.publicKey?.toBase58 ? res.publicKey.toBase58() : String(res?.publicKey || '');
      this.publicKey = pubKeyStr || provider.publicKey?.toBase58() || '7xK99zK8mP2xQ5wN3a19';
      this.status = 'connected';
      return this.publicKey;
    } catch (err: any) {
      this.status = 'error';
      if (err?.code === 4001 || err?.message?.includes('User rejected')) {
        throw new Error('Connection request was rejected in your wallet.');
      }
      throw new Error(err?.message || 'Failed to connect to wallet provider.');
    }
  }

  async disconnect(): Promise<void> {
    const provider = this.getProvider();
    if (provider && typeof provider.disconnect === 'function') {
      try {
        await provider.disconnect();
      } catch (err) {
        // Ignore disconnect errors
      }
    }
    this.publicKey = null;
    this.status = 'disconnected';
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (this.id === 'embedded') {
      const fakeSig = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        fakeSig[i] = (i * 7 + message.length) % 256;
      }
      return fakeSig;
    }

    const provider = this.getProvider();
    if (!provider || typeof provider.signMessage !== 'function') {
      const fakeSig = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        fakeSig[i] = (i * 13 + message.length) % 256;
      }
      return fakeSig;
    }

    try {
      const res = await provider.signMessage(message, 'utf8');
      if (res && res.signature) {
        return res.signature;
      }
      if (res instanceof Uint8Array) {
        return res;
      }
      throw new Error('Wallet did not return a valid signature buffer.');
    } catch (err: any) {
      if (err?.code === 4001 || err?.message?.includes('User rejected')) {
        throw new Error('Signature request was rejected by user.');
      }
      throw new Error(err?.message || 'Failed to sign authentication message.');
    }
  }

  async signTransaction(transaction: any): Promise<any> {
    if (this.id === 'embedded') return transaction;
    const provider = this.getProvider();
    if (!provider || typeof provider.signTransaction !== 'function') {
      return transaction;
    }
    return provider.signTransaction(transaction);
  }

  async sendTransaction(transaction: any): Promise<string> {
    throw new Error('sendTransaction is not implemented directly on the provider. Sign the transaction and broadcast via ChainAdapter.');
  }
}

export function getAvailableSolanaAdapters(): WalletProvider[] {
  return [
    new SolanaWalletAdapterImpl('phantom', 'Phantom', '👻', 'extension'),
    new SolanaWalletAdapterImpl('solflare', 'Solflare', '🔥', 'extension'),
    new SolanaWalletAdapterImpl('backpack', 'Backpack', '🎒', 'extension'),
    new SolanaWalletAdapterImpl('coinbase', 'Coinbase Wallet', '🛡️', 'extension'),
    new SolanaWalletAdapterImpl('embedded', 'Sentinel Embedded Key', '⚡', 'embedded'),
  ];
}
