// lib/wallet/system-types.ts

export type WalletSystemType = 'TRADING' | 'WATCH_ONLY' | 'COPY' | 'BOT' | 'VAULT';
export type WalletSystemConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'ERROR';

export interface WalletPermissions {
  walletType: WalletSystemType;
  canTrade: boolean;
  canTransfer: boolean;
  canCopyTrade: boolean;
  canUseAutomation: boolean;
  maxTradeUsd?: number;
  dailyLimitUsd?: number;
}

export interface WalletRecord {
  id: string;
  address: string;
  chain: string;
  label: string;
  isPrimary: boolean;
  connectionState: WalletSystemConnectionState;
  permissions: WalletPermissions;
  balances: {
    native: number;
    usdTotal: number;
  };
  gasReserveStatus: 'HEALTHY' | 'LOW' | 'CRITICAL';
}

export interface TransactionSimulationResult {
  success: boolean;
  errorMessage?: string;
  
  expectedReceiveUsd: number;
  priceImpactPct: number;
  networkFeeUsd: number;
  route: string[];
  
  contractRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  contractWarning?: string;
}

export interface TransactionRequest {
  walletId: string;
  tokenId: string;
  action: 'BUY' | 'SELL';
  amountUsd: number;
}
