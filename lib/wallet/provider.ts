export type WalletProviderId = 'phantom' | 'solflare' | 'backpack' | 'okx' | 'embedded' | 'manual' | 'standard';

export type WalletType = 'extension' | 'standard' | 'embedded' | 'manual';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticating'
  | 'authenticated'
  | 'error';

export interface WalletCapabilities {
  supportsSignMessage: boolean;
  supportsSignTransaction: boolean;
  supportsSendTransaction: boolean;
  supportsMultiChain: boolean;
}

export interface WalletProvider {
  id: WalletProviderId;
  name: string;
  icon: string;
  type: WalletType;
  installed: boolean;
  publicKey: string | null;
  status: ConnectionStatus;
  
  // Core connection
  connect(customAddress?: string): Promise<string>;
  disconnect(): Promise<void>;
  getAddress(): string | null;
  
  // Presence
  /** Whether this wallet is actually installed in the current browser. */
  isAvailable?(): boolean;
  /** Official install page, so "not installed" can be made actionable. */
  getInstallUrl?(): string | undefined;
  /** Export private key for embedded smart wallets */
  exportPrivateKey?(): string | null;

  // Capabilities
  getCapabilities(): WalletCapabilities;
  
  // Signing and broadcasting
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: any): Promise<any>;
  sendTransaction(transaction: any): Promise<string>;
}
