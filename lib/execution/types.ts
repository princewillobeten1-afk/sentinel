/**
 * Swap Execution Engine Master Types (Sprint 47).
 */

export enum ExecutionStatus {
  CREATED = 'CREATED',
  ROUTE_SELECTED = 'ROUTE_SELECTED',
  TRANSACTION_BUILT = 'TRANSACTION_BUILT',
  SIMULATED = 'SIMULATED',
  READY_FOR_SIGNATURE = 'READY_FOR_SIGNATURE',
  SIGNED = 'SIGNED',
  SUBMITTED = 'SUBMITTED',
  PENDING = 'PENDING',
  CONFIRMING = 'CONFIRMED_UNFINALIZED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REPLACED = 'REPLACED',
  EXPIRED = 'EXPIRED',
}

export enum ExecutionFailureCode {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_GAS = 'INSUFFICIENT_GAS_BALANCE',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  SLIPPAGE_TOO_HIGH = 'SLIPPAGE_TOO_HIGH',
  CONTRACT_REVERT = 'CONTRACT_REVERT',
  QUOTE_EXPIRED = 'QUOTE_EXPIRED',
  QUOTE_MISMATCH = 'QUOTE_MISMATCH',
  QUOTE_MOVED = 'QUOTE_MOVED',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  USER_REJECTED = 'USER_REJECTED',
  TIMEOUT = 'CONFIRMATION_TIMEOUT',
  REORG_DETECTED = 'REORG_DETECTED',
  TARGET_BLOCKLISTED = 'TARGET_BLOCKLISTED',
  KILL_SWITCH_ACTIVE = 'EXECUTION_SERVICE_DISABLED',
  UNKNOWN = 'UNKNOWN_FAILURE',
}

export enum RouteType {
  DIRECT = 'DIRECT',
  MULTI_HOP = 'MULTI_HOP',
  MULTI_MARKET = 'MULTI_MARKET',
}

export enum MEVProtectionStrategy {
  PUBLIC_MEMPOOL = 'PUBLIC_MEMPOOL',
  PROTECTED_ROUTE = 'PROTECTED_ROUTE',
  PRIVATE_RPC = 'PRIVATE_RPC',
  CHAIN_SPECIFIC = 'CHAIN_SPECIFIC',
}

export interface SwapRouteLeg {
  tokenIn: string;
  tokenOut: string;
  poolAddress: string;
  protocol: string;
  feeBps: number;
}

export interface SwapRouteOption {
  routeId: string;
  routeType: RouteType;
  hops: number;
  legs: SwapRouteLeg[];
  expectedOutput: string;
  minimumReceived: string;
  priceImpactPct: number;
  estimatedGasUnits: number;
  estimatedNetworkFeeUsd: number;
  protocolFeeUsd: number;
  compositeScore: number; // 0 - 100
  isBestRoute: boolean;
}

export interface SwapExecutionRequest {
  requestId?: string;
  idempotencyKey: string;
  userId: string;
  walletAddress: string;
  chainId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number;
  quoteId: string;
  route?: SwapRouteOption;
  mevStrategy?: MEVProtectionStrategy;
  createdAt?: string;
  expiresAt?: string;
}

export interface UnsignedTransactionPayload {
  chainId: string | number;
  to?: string; // EVM router
  from: string;
  data?: string; // EVM calldata
  value?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  programId?: string; // Solana
  instructions?: any[]; // Solana instructions
  recentBlockhash?: string;
}

export interface SimulationResult {
  success?: boolean;
  expectedTokenOutput: string;
  minimumOutputVerified?: boolean;
  estimatedGasUsage: number;
  estimatedGasCostUsd?: number;
  revertReason?: string;
  warnings: string[];
  willRevert?: boolean;
  logs?: string[];
}

export interface GasEstimateResult {
  estimatedGas: number;
  gasLimit: number; // with safety buffer applied
  baseFeeGwei?: number;
  priorityFeeGwei?: number;
  maxFeeGwei?: number;
  estimatedNetworkFeeUsd: number;
  sufficientNativeBalance: boolean;
}

export interface ExecutionReceipt {
  executionId: string;
  transactionHash: string;
  chainId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  expectedOutput: string;
  effectivePrice: string;
  priceDeviationPct: number;
  networkFeeUsd: number;
  dexFeeUsd: number;
  platformFeeUsd: number;
  routeTaken: string[];
  blockNumberOrSlot: number;
  timestamp: string;
}

export interface ExecutionQuality {
  executionId: string;
  quotedPrice: number;
  executedPrice: number;
  priceDeviationPct: number;
  expectedOutput: string;
  actualOutput: string;
  priceImpactPct: number;
  totalFeesUsd: number;
  gasCostUsd: number;
  executionDurationMs: number;
}

export interface SwapExecutionPolicy {
  maxSlippagePct: number;
  maxPriceImpactPct: number;
  maxPriceDriftPct: number;
  maxGasLimit: number;
  mevProtection: MEVProtectionStrategy;
  requiredConfirmations: number;
  timeoutSeconds: number;
}

// Execution policy enum
export enum ExecutionPolicy {
  BEST_PRICE = 'BEST_PRICE',
  FASTEST = 'FASTEST',
  LOWEST_IMPACT = 'LOWEST_IMPACT',
  LOWEST_GAS = 'LOWEST_GAS',
  PROTECTED = 'PROTECTED',
  BALANCED = 'BALANCED',
}

export type ExecutionPolicyLegacy = ExecutionPolicy;

export enum MEVPreference {
  STANDARD = 'STANDARD',
  PROTECTED = 'PROTECTED',
  MAXIMUM_PROTECTION = 'MAXIMUM_PROTECTION',
}

export enum MEVRisk {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface RouteLeg {
  tokenIn: string;
  tokenOut: string;
  poolAddress: string;
  dexVenue: string;
}

export interface ExecutionRoute {
  hops: number;
  splitPercentage: number;
  legs: RouteLeg[];
}

export interface Quote {
  id: string;
  dexVenue: string;
  expectedOutput: string;
  priceImpact: number;
  gasEstimate: string;
  mevRisk: MEVRisk;
  executionScore: number;
  expiresAt: number;
  routes: ExecutionRoute[];
}

export interface ExecutionRequest {
  wallet: string;
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  side: 'BUY' | 'SELL' | 'SWAP';
  orderType: 'LIMIT' | 'STOP' | 'MARKET' | 'EMERGENCY_EXIT';
  slippageLimit: number;
  priority: 'LOW' | 'NORMAL' | 'FAST' | 'URGENT';
  executionPolicy: ExecutionPolicy;
  maxGas?: string;
  deadline?: number;
  mevPreference: MEVPreference;
}

export interface ExecutionResult {
  txHash?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REVERTED' | 'CANCELLED';
  inputAmount: string;
  outputAmount?: string;
  averagePrice?: string;
  gasUsed?: string;
  gasCost?: string;
  priceImpact?: number;
  slippage?: number;
  errorMessage?: string;
}
