export type WalletProviderId = 'phantom' | 'solflare' | 'backpack' | 'coinbase' | 'embedded' | 'standard';

export type WalletType = 'extension' | 'standard' | 'embedded';

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
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  getAddress(): string | null;
  
  // Capabilities
  getCapabilities(): WalletCapabilities;
  
  // Signing and broadcasting
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: any): Promise<any>;
  sendTransaction(transaction: any): Promise<string>;
}
