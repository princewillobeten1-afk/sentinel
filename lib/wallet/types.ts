export type WalletProviderId = 'phantom' | 'solflare' | 'backpack' | 'coinbase' | 'embedded' | 'standard';

export type WalletType = 'extension' | 'standard' | 'embedded';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticating'
  | 'authenticated'
  | 'error';

export interface WalletAdapter {
  id: WalletProviderId;
  name: string;
  icon: string;
  type: WalletType;
  installed: boolean;
  publicKey: string | null;
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export interface LinkedWallet {
  id: string;
  address: string;
  network: string;
  label: string;
  isPrimary: boolean;
  balanceSol: number;
  status: 'active' | 'inactive' | 'suspended';
  firstSeenAt?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserPreferences {
  slippageTolerance: number;
  riskLevel: 'conservative' | 'moderate' | 'high' | 'degenerate';
  currencyDisplay: 'USD' | 'SOL' | 'EUR' | 'BTC';
  rpcEndpoint: 'mainnet' | 'devnet' | 'custom';
  customRpcUrl?: string;
  theme: 'dark' | 'light' | 'system';
  density: 'compact' | 'standard' | 'spacious';
  reducedMotion?: boolean;
  autoLockMinutes: number;
  notificationsEnabled: {
    security: boolean;
    priceAlerts: boolean;
    tradeExecution: boolean;
    system: boolean;
  };
}

export interface AuthenticatedIdentity {
  userId: string;
  displayName: string;
  email?: string;
  role: 'user' | 'admin' | 'analyst';
  primaryWallet: LinkedWallet;
  linkedWallets: LinkedWallet[];
  preferences: UserPreferences;
  authenticatedAt: string;
}

export interface SIWSChallenge {
  nonce: string;
  statement: string;
  address: string;
  expiresAt: string;
  domain: string;
  issuedAt: string;
  chainId: string;
  formattedMessage: string;
}
