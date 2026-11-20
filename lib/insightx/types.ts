export type InsightXNetwork =
  | 'sol'
  | 'robinhood'
  | 'eth'
  | 'base'
  | 'bsc'
  | 'sui'
  | 'arb'
  | 'op'
  | 'matic'
  | (string & {});

export type InsightXClusterTag =
  | 'wallet'
  | 'smart_contract'
  | 'funding_address'
  | 'intermediary'
  | 'volume_bot'
  | 'exchange'
  | 'team'
  | 'liquidity_pool'
  | 'vesting'
  | 'presale'
  | 'burn'
  | (string & {});

export interface InsightXDexMetrics {
  cluster_pct: number | null;
  snipers_pct: number | null;
  bundlers_pct: number | null;
  dev_pct: number | null;
  insiders_pct: number | null;
  top10_pct: number | null;
}

export interface InsightXDistributionResponse {
  gini: number | null;
  hhi: number | null;
  nakamoto: number | null;
  top_10_holder_concentration: number | null;
}

export interface InsightXNormalizedDistribution {
  gini: number | null;
  hhi: number | null;
  nakamoto: number | null;
  top10Pct: number | null;
}

export interface InsightXClusterAddress {
  address: string;
  balance: number;
  percentage: number;
  tags: InsightXClusterTag[];
}

export interface InsightXCluster {
  pct: number;
  tags: InsightXClusterTag[];
  cluster_addresses: InsightXClusterAddress[];
}

export interface InsightXClustersResponse {
  total_cluster_pct: number;
  clusters: InsightXCluster[];
}

export interface InsightXClustersSummary {
  totalClusterPct: number | null;
  clusterCount: number;
  suspiciousClusterCount: number;
  clusteredAddressCount: number;
  clusters: InsightXCluster[];
}

export interface InsightXSniperAddress {
  address: string;
  balance: number;
  percentage: number;
}

export interface InsightXSnipersResponse {
  total_sniper_pct: number;
  count: {
    total: number;
    sold_partially: number;
    sold_fully: number;
    bought_more: number;
  };
  snipers: InsightXSniperAddress[];
}

export interface InsightXBundlerAddress {
  address: string;
  balance: number;
  percentage: number;
  reasons?: string[];
  slot?: number;
}

export interface InsightXBundlersResponse {
  total_bundlers_pct: number;
  bundlers: InsightXBundlerAddress[];
}

export interface InsightXInsiderAddress {
  address: string;
  balance: number;
  percentage: number;
}

export interface InsightXInsidersResponse {
  total_insiders_pct: number;
  insiders: InsightXInsiderAddress[];
}

export interface InsightXScannerReason {
  title?: string;
  description?: string;
  severity?: string;
  score?: number;
  [key: string]: unknown;
}

export interface InsightXScannerResponse {
  network: string;
  token: string;
  extensions?: Record<string, unknown>;
  results?: {
    generated_at?: string | number;
    simple?: {
      score?: number;
      message?: string;
      reasons?: Array<string | InsightXScannerReason>;
    };
    advanced?: Record<string, unknown>;
  };
}

export interface InsightXAddressLabel {
  address: string;
  label?: string | null;
  tags?: InsightXClusterTag[];
  smart_contract?: boolean;
}

export interface InsightXTokenIntelligence {
  configured: boolean;
  network: InsightXNetwork;
  token: string;
  atlasEmbedUrl: string | null;
  capabilities: {
    atlasLive: boolean;
    dexMetrics: boolean;
    distribution: boolean;
    clusters: boolean;
    labels: boolean;
    snipersAndBundlers: boolean;
    scanner: boolean;
  };
  metrics: InsightXDexMetrics | null;
  distribution: InsightXNormalizedDistribution | null;
  clusters: InsightXClustersSummary | null;
  snipers: InsightXSnipersResponse | null;
  bundlers: InsightXBundlersResponse | null;
  insiders: InsightXInsidersResponse | null;
  scanner: InsightXScannerResponse | null;
  rateLimit: {
    minuteRemaining: number | null;
    monthRemaining: number | null;
    coolingDown?: boolean;
  };
  detailLevel?: 'core' | 'full';
  fetchedAt: string;
}
