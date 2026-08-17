export enum LaunchMode {
  FAIR = 'FAIR',
  BONDING_CURVE = 'BONDING_CURVE',
  SCHEDULED = 'SCHEDULED'
}

export enum LaunchState {
  CREATED = 'CREATED',
  VALIDATING = 'VALIDATING',
  DEPLOYED = 'DEPLOYED',
  LIVE = 'LIVE',
  GRADUATING = 'GRADUATING',
  GRADUATED = 'GRADUATED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface CreatorAllocation {
  walletAddress: string;
  percentage: number;
  isVested: boolean;
  cliffDays?: number;
  vestingDays?: number;
}

export interface LaunchConfig {
  name: string;
  symbol: string;
  description: string;
  logoUrl?: string;
  websiteUrl?: string;
  socialLinks?: Record<string, string>;
  totalSupply: string; // BigNumberish string
  creatorAllocation: CreatorAllocation;
  launchMode: LaunchMode;
}

export interface LaunchRiskScore {
  overallScore: number; // 0-100 (0 = Safe, 100 = Rugged)
  riskLevel: RiskLevel;
  effectiveOwnershipPercentage: number;
  walletClusteringScore: number;
  creatorReputationScore: number;
  primaryConcern?: string;
}

export interface BondingCurveState {
  currentPrice: string; // in Native Token (e.g. SOL or ETH)
  circulatingSupply: string;
  reserveBalance: string;
  marketCap: string;
  graduationTarget: string; // Target reserve to graduate
  buyFeePercentage: number;
  sellFeePercentage: number;
}

export interface SimulationResult {
  tokensReceived?: string;
  nativeReceived?: string;
  priceImpact: number;
  feePaid: string;
  newPrice: string;
  warnings?: string[];
}
