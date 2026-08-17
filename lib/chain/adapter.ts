export interface ChainBalance {
  native: number; // e.g., SOL, ETH
  tokens: Array<{
    address: string;
    symbol: string;
    amount: number;
    decimals: number;
  }>;
}

export interface SimulationResult {
  success: boolean;
  expectedOut?: number;
  priceImpact?: number;
  fee?: number;
  errorReason?: string;
  logs?: string[];
}

export interface RPCNode {
  url: string;
  name: string;
  health: 'healthy' | 'degraded' | 'dead';
  latency: number;
  lastSuccessfulRequest: number;
}

export interface ChainAdapter {
  chainId: string;
  name: string;
  
  // RPC Management
  getNodes(): RPCNode[];
  reportNodeHealth(url: string, latency: number, success: boolean): void;
  
  // Queries
  getBalance(address: string): Promise<ChainBalance>;
  getTransaction(hash: string): Promise<any>;
  getBlockState(): Promise<{ height: number; timestamp: number }>;
  
  // Transactions
  estimateFees(transaction: any): Promise<number>;
  simulateTransaction(transaction: any): Promise<SimulationResult>;
  broadcastTransaction(signedTransaction: any): Promise<string>;
  
  // Events
  subscribeToEvents(address: string, callback: (event: any) => void): () => void;
}
