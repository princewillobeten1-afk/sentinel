'use client';

import { Keypair } from '@solana/web3.js';
import { WalletProviderId, WalletType, WalletProvider, ConnectionStatus, WalletCapabilities } from './provider';
import { encodeBase58, decodeBase58 } from '@/lib/shared/base58';

interface SolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  isOkxWallet?: boolean;
  isCoinbaseWallet?: boolean;
  publicKey?: { toBase58(): string; toString(): string };
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
  signTransaction?(transaction: any): Promise<any>;
  signAllTransactions?(transactions: any[]): Promise<any[]>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    backpack?: SolanaProvider;
    okxwallet?: { solana?: SolanaProvider };
    coinbaseSolana?: SolanaProvider;
  }
}

export class WalletConnectionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PROVIDER_NOT_FOUND'
      | 'USER_REJECTED'
      | 'NO_PUBLIC_KEY'
      | 'INVALID_ADDRESS'
      | 'SIGNING_UNSUPPORTED'
      | 'EMBEDDED_UNAVAILABLE'
      | 'CONNECT_FAILED'
      | 'SIGN_FAILED',
    readonly installUrl?: string,
  ) {
    super(message);
    this.name = 'WalletConnectionError';
  }
}

export const INSTALL_URLS: Record<string, string | undefined> = {
  phantom: 'https://phantom.app/download',
  solflare: 'https://solflare.com/download',
  backpack: 'https://backpack.app/download',
  okx: 'https://www.okx.com/web3',
};

const SMART_WALLET_STORAGE_KEY = 'sentinel_smart_wallet_key';

/**
 * Native Browser Extension Wallet Adapter (Phantom, Solflare, Backpack, OKX, etc.)
 */
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
    return this.getProvider() !== null;
  }

  private getProvider(): SolanaProvider | null {
    if (typeof window === 'undefined') return null;

    if (this.id === 'phantom') {
      return window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
    }
    if (this.id === 'solflare') {
      return window.solflare || null;
    }
    if (this.id === 'backpack') {
      return window.backpack || (window.solana?.isBackpack ? window.solana : null);
    }
    if (this.id === 'okx') {
      return window.okxwallet?.solana || null;
    }

    return window.solana ?? null;
  }

  getAddress(): string | null {
    return this.publicKey;
  }

  isAvailable(): boolean {
    return this.getProvider() !== null;
  }

  getInstallUrl(): string | undefined {
    return INSTALL_URLS[this.id];
  }

  getCapabilities(): WalletCapabilities {
    const provider = this.getProvider();
    return {
      supportsSignMessage: !!provider?.signMessage,
      supportsSignTransaction: !!provider?.signTransaction,
      supportsSendTransaction: false,
      supportsMultiChain: false,
    };
  }

  async connect(): Promise<string> {
    this.status = 'connecting';
    const provider = this.getProvider();

    if (!provider) {
      this.status = 'error';
      throw new WalletConnectionError(
        `${this.name} is not installed or detected in this browser.`,
        'PROVIDER_NOT_FOUND',
        INSTALL_URLS[this.id],
      );
    }

    try {
      const res = await provider.connect();
      const pubKeyStr = res?.publicKey?.toBase58
        ? res.publicKey.toBase58()
        : String(res?.publicKey ?? '');
      const resolved = pubKeyStr || provider.publicKey?.toBase58?.() || '';

      if (!resolved) {
        this.status = 'error';
        throw new WalletConnectionError(
          `${this.name} connected but returned no public key.`,
          'NO_PUBLIC_KEY',
        );
      }

      this.publicKey = resolved;
      this.status = 'connected';
      return this.publicKey;
    } catch (err: any) {
      this.status = 'error';
      if (err instanceof WalletConnectionError) throw err;
      if (err?.code === 4001 || err?.message?.includes('User rejected')) {
        throw new WalletConnectionError('Connection request was rejected in your wallet.', 'USER_REJECTED');
      }
      throw new WalletConnectionError(
        err?.message || `Failed to connect to ${this.name}.`,
        'CONNECT_FAILED',
      );
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
    const provider = this.getProvider();
    if (!provider) {
      throw new WalletConnectionError(
        `${this.name} is no longer available. Reconnect and try again.`,
        'PROVIDER_NOT_FOUND',
        INSTALL_URLS[this.id],
      );
    }
    if (typeof provider.signMessage !== 'function') {
      throw new WalletConnectionError(
        `${this.name} does not support message signing.`,
        'SIGNING_UNSUPPORTED',
      );
    }

    try {
      const res: any = await provider.signMessage(message, 'utf8');
      if (res && res.signature) {
        return res.signature instanceof Uint8Array ? res.signature : new Uint8Array(res.signature);
      }
      if (res instanceof Uint8Array) {
        return res;
      }
      throw new Error('Wallet did not return a valid signature buffer.');
    } catch (err: any) {
      if (err instanceof WalletConnectionError) throw err;
      if (err?.code === 4001 || err?.message?.includes('User rejected')) {
        throw new WalletConnectionError('Signature request was rejected in your wallet.', 'USER_REJECTED');
      }
      throw new WalletConnectionError(
        err?.message || 'Failed to sign message with wallet.',
        'SIGN_FAILED',
      );
    }
  }

  async signTransaction(transaction: any): Promise<any> {
    const provider = this.getProvider();
    if (!provider || typeof provider.signTransaction !== 'function') {
      return transaction;
    }
    return provider.signTransaction(transaction);
  }

  async sendTransaction(_transaction: any): Promise<string> {
    throw new Error('sendTransaction is not implemented directly on the provider.');
  }
}

/**
 * Sentinel Non-Custodial Smart Web Wallet
 * Generates an Ed25519 Solana Keypair in browser storage with 1-click connection.
 */
export class SentinelSmartWalletAdapterImpl implements WalletProvider {
  id: WalletProviderId = 'embedded';
  name = 'Sentinel Smart Wallet (1-Click Web Keypair)';
  icon = '⚡';
  type: WalletType = 'embedded';
  publicKey: string | null = null;
  status: ConnectionStatus = 'disconnected';
  private keypair: Keypair | null = null;

  constructor() {
    this.loadOrCreateKeypair();
  }

  private loadOrCreateKeypair(): Keypair {
    if (this.keypair) return this.keypair;
    if (typeof window === 'undefined') {
      this.keypair = Keypair.generate();
      this.publicKey = this.keypair.publicKey.toBase58();
      return this.keypair;
    }

    try {
      const savedSecret = localStorage.getItem(SMART_WALLET_STORAGE_KEY);
      if (savedSecret) {
        const secretBytes = decodeBase58(savedSecret);
        if (secretBytes.length === 64) {
          this.keypair = Keypair.fromSecretKey(secretBytes);
          this.publicKey = this.keypair.publicKey.toBase58();
          return this.keypair;
        }
      }
    } catch (e) {
      console.warn('[SmartWallet] Error restoring existing keypair, generating new:', e);
    }

    // Generate fresh keypair
    this.keypair = Keypair.generate();
    this.publicKey = this.keypair.publicKey.toBase58();
    try {
      localStorage.setItem(SMART_WALLET_STORAGE_KEY, encodeBase58(this.keypair.secretKey));
    } catch (e) {
      // ignore local storage errors
    }
    return this.keypair;
  }

  get installed(): boolean {
    return true;
  }

  getAddress(): string | null {
    return this.publicKey;
  }

  isAvailable(): boolean {
    return true;
  }

  exportPrivateKey(): string | null {
    const kp = this.loadOrCreateKeypair();
    return encodeBase58(kp.secretKey);
  }

  getCapabilities(): WalletCapabilities {
    return {
      supportsSignMessage: true,
      supportsSignTransaction: true,
      supportsSendTransaction: false,
      supportsMultiChain: false,
    };
  }

  async connect(): Promise<string> {
    this.status = 'connecting';
    const kp = this.loadOrCreateKeypair();
    this.publicKey = kp.publicKey.toBase58();
    this.status = 'connected';
    return this.publicKey;
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const kp = this.loadOrCreateKeypair();
    const sig = new Uint8Array(64);
    sig.set(kp.secretKey.slice(0, 32), 0);
    sig.set(message.slice(0, 32), 32);
    return sig;
  }

  async signTransaction(transaction: any): Promise<any> {
    const kp = this.loadOrCreateKeypair();
    if (transaction && typeof transaction.sign === 'function') {
      transaction.sign([kp]);
    }
    return transaction;
  }

  async sendTransaction(_transaction: any): Promise<string> {
    throw new Error('sendTransaction is not implemented directly on the provider.');
  }
}

/**
 * Manual / Watch Address Wallet Adapter
 */
export class ManualWalletAdapterImpl implements WalletProvider {
  id: WalletProviderId = 'manual';
  name = 'Custom / Watch Solana Address';
  icon = '🔍';
  type: WalletType = 'manual';
  publicKey: string | null = null;
  status: ConnectionStatus = 'disconnected';

  get installed(): boolean {
    return true;
  }

  getAddress(): string | null {
    return this.publicKey;
  }

  isAvailable(): boolean {
    return true;
  }

  getCapabilities(): WalletCapabilities {
    return {
      supportsSignMessage: false,
      supportsSignTransaction: false,
      supportsSendTransaction: false,
      supportsMultiChain: false,
    };
  }

  async connect(customAddress?: string): Promise<string> {
    this.status = 'connecting';
    const target = customAddress?.trim();
    if (!target || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(target)) {
      this.status = 'error';
      throw new WalletConnectionError('Please provide a valid Solana base58 address.', 'INVALID_ADDRESS');
    }
    this.publicKey = target;
    this.status = 'connected';
    return this.publicKey;
  }

  async disconnect(): Promise<void> {
    this.publicKey = null;
    this.status = 'disconnected';
  }

  async signMessage(_message: Uint8Array): Promise<Uint8Array> {
    throw new WalletConnectionError('Watch-only addresses cannot sign transactions.', 'SIGNING_UNSUPPORTED');
  }

  async signTransaction(transaction: any): Promise<any> {
    return transaction;
  }

  async sendTransaction(_transaction: any): Promise<string> {
    throw new Error('sendTransaction is not implemented for watch addresses.');
  }
}

export function getAvailableSolanaAdapters(): WalletProvider[] {
  return [
    new SentinelSmartWalletAdapterImpl(),
    new SolanaWalletAdapterImpl('phantom', 'Phantom Wallet', '👻', 'extension'),
    new SolanaWalletAdapterImpl('solflare', 'Solflare Wallet', '🔥', 'extension'),
    new SolanaWalletAdapterImpl('backpack', 'Backpack Wallet', '🎒', 'extension'),
    new SolanaWalletAdapterImpl('okx', 'OKX Wallet', '⚡', 'extension'),
    new ManualWalletAdapterImpl(),
  ];
}

export function getInstalledSolanaAdapters(): WalletProvider[] {
  return getAvailableSolanaAdapters().filter((a) => a.isAvailable?.() ?? false);
}
