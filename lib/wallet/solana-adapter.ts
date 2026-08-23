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
  }
}

/**
 * A wallet connection failure the UI can act on.
 *
 * `code` lets the modal distinguish "install the extension" from "you rejected
 * the request" from "this wallet cannot sign" — three very different things
 * that were previously all a bare `Error`, or worse, silently swallowed and
 * replaced with a fabricated address.
 */
export class WalletConnectionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PROVIDER_NOT_FOUND'
      | 'USER_REJECTED'
      | 'NO_PUBLIC_KEY'
      | 'SIGNING_UNSUPPORTED'
      | 'EMBEDDED_UNAVAILABLE'
      | 'CONNECT_FAILED'
      | 'SIGN_FAILED',
    /** Where to get the wallet, when the problem is that it is missing. */
    readonly installUrl?: string,
  ) {
    super(message);
    this.name = 'WalletConnectionError';
  }
}

/** Official install pages, so "not installed" can be actionable. */
export const INSTALL_URLS: Record<string, string | undefined> = {
  phantom: 'https://phantom.app/download',
  solflare: 'https://solflare.com/download',
};

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
    return !!window.solana;
  }

  private getProvider(): SolanaProvider | null {
    if (typeof window === 'undefined') return null;
    if (this.id === 'phantom') return window.solana?.isPhantom ? window.solana : null;
    if (this.id === 'solflare') return window.solflare ?? null;
    return window.solana ?? null;
  }

  getAddress(): string | null {
    return this.publicKey;
  }

  /**
   * Whether this wallet is actually present in the browser.
   *
   * Lets the connect modal show installed wallets as connectable and the rest
   * as "install" links, instead of offering all five and failing on click.
   */
  isAvailable(): boolean {
    if (this.id === 'embedded') return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    return this.getProvider() !== null;
  }

  /** Where to install this wallet, when it is not present. */
  getInstallUrl(): string | undefined {
    return INSTALL_URLS[this.id];
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

    /**
     * Every failure path here used to report success with an invented address:
     * `embedded` returned a hardcoded key, a missing extension produced
     * `demo_phantom_xxxx`, and a provider that connected without returning a
     * public key fell back to the same fake. The app then believed it held a
     * wallet it did not, and every wallet-scoped request went out with an
     * address that is not even valid base58.
     *
     * In a self-custodial product a connection either happened or it did not.
     */
    if (this.id === 'embedded') {
      this.status = 'error';
      throw new WalletConnectionError(
        'The embedded signer is a development stub and cannot sign real transactions.',
        'EMBEDDED_UNAVAILABLE',
      );
    }

    const provider = this.getProvider();
    if (!provider) {
      this.status = 'error';
      throw new WalletConnectionError(
        `${this.name} is not installed or is not detectable in this browser.`,
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

      // A connect() that returns no key is a failed connect, not a reason to
      // substitute one.
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
        err?.message || 'Failed to connect to wallet provider.',
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
    /**
     * A forged signature is worse than no signature. Both branches here used to
     * synthesise 64 deterministic bytes, which the server would then attempt to
     * verify as a real ed25519 signature — so authentication either failed with
     * a confusing error, or, worse, passed against a mock-signature bypass.
     */
    if (this.id === 'embedded') {
      throw new WalletConnectionError(
        'The embedded signer cannot produce a real signature.',
        'EMBEDDED_UNAVAILABLE',
      );
    }

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
        `${this.name} does not support message signing, which is required to prove wallet ownership.`,
        'SIGNING_UNSUPPORTED',
      );
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
      if (err instanceof WalletConnectionError) throw err;
      if (err?.code === 4001 || err?.message?.includes('User rejected')) {
        throw new WalletConnectionError('Signature request was rejected in your wallet.', 'USER_REJECTED');
      }
      throw new WalletConnectionError(
        err?.message || 'Failed to sign authentication message.',
        'SIGN_FAILED',
      );
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
  const adapters = [
    new SolanaWalletAdapterImpl('phantom', 'Phantom', '👻', 'extension'),
    new SolanaWalletAdapterImpl('solflare', 'Solflare', '🔥', 'extension'),
  ];

  // The embedded signer cannot sign anything real. Offering it beside genuine
  // wallets invited picking it by accident — and it was previously the store's
  // *default* selection, which is why the app booted holding a fake address.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    adapters.push(new SolanaWalletAdapterImpl('embedded', 'Sentinel Embedded Key (demo)', '⚡', 'embedded'));
  }

  return adapters;
}

/** Wallets detected in this browser right now. */
export function getInstalledSolanaAdapters(): WalletProvider[] {
  return getAvailableSolanaAdapters().filter((a) => a.isAvailable?.() ?? false);
}
