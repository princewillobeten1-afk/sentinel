import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { chain, address } = params;

    const stats = {
      decentralizationScore: 89,
      decentralizationRating: 'Safe & Decentralized',
      top10ConcentrationPct: '14.20%',
      devConnectedWalletsCount: 2,
      devConnectedSupplyPct: '0.85%',
      sniperWalletsCount: 4,
      sniperSupplyPct: '2.94%',
      suspiciousClustersDetected: 0,
    };

    const nodes = [
      {
        id: 'node_dex_raydium',
        label: 'Raydium CPMM Pool',
        tag: 'dex',
        address: '5xRydm99qP88x12kL0z1',
        balanceTokens: '184,200,000 $SENT',
        supplyPct: 18.42,
        valueUsd: '$7,828,500',
        x: 160,
        y: 130,
        r: 44,
        fundingSource: 'Genesis Raydium CPMM Vault',
        color: 'rgba(6, 182, 212, 0.25)',
        borderColor: '#2B6FC4',
      },
      {
        id: 'node_dev_creator',
        label: 'Dev Creator Wallet',
        tag: 'dev',
        address: '7xK99zK8mP2xQ5wN3a19',
        balanceTokens: '8,500,000 $SENT',
        supplyPct: 0.85,
        valueUsd: '$361,250',
        x: 270,
        y: 110,
        r: 22,
        fundingSource: 'Funded via Binance 45 days ago',
        color: 'rgba(16, 185, 129, 0.25)',
        borderColor: '#12B574',
      },
      {
        id: 'node_whale_1',
        label: 'Whale Accumulator #1',
        tag: 'whale',
        address: '4zW8j1k9pQ2x88b7',
        balanceTokens: '45,200,000 $SENT',
        supplyPct: 4.52,
        valueUsd: '$1,921,000',
        x: 380,
        y: 90,
        r: 32,
        fundingSource: 'Funded via Kraken 12 days ago',
        color: 'rgba(168, 85, 247, 0.25)',
        borderColor: '#A78BFA',
      },
      {
        id: 'node_whale_2',
        label: 'Smart Money Whale #2',
        tag: 'whale',
        address: '1aM3p88qL2vN77b3',
        balanceTokens: '38,100,000 $SENT',
        supplyPct: 3.81,
        valueUsd: '$1,619,250',
        x: 350,
        y: 180,
        r: 30,
        fundingSource: 'Funded via Coinbase 20 days ago',
        color: 'rgba(168, 85, 247, 0.25)',
        borderColor: '#A78BFA',
      },
      {
        id: 'node_sniper_cluster',
        label: 'Early Sniper Cluster (4 Wallets)',
        tag: 'sniper',
        address: '8tV3...1m44 + 3 linked',
        balanceTokens: '29,400,000 $SENT',
        supplyPct: 2.94,
        valueUsd: '$1,249,500',
        x: 480,
        y: 140,
        r: 26,
        fundingSource: 'Funded via FixedFloat router',
        color: 'rgba(245, 158, 11, 0.25)',
        borderColor: '#E5A23D',
      },
      {
        id: 'node_insider_cluster',
        label: 'Connected Trader Group',
        tag: 'insider',
        address: '3kL0...5v91 + 2 linked',
        balanceTokens: '22,500,000 $SENT',
        supplyPct: 2.25,
        valueUsd: '$956,250',
        x: 230,
        y: 200,
        r: 24,
        fundingSource: 'Funded via OKX 8 days ago',
        color: 'rgba(56, 189, 248, 0.25)',
        borderColor: '#3B8FF0',
      },
      {
        id: 'node_retail_holders',
        label: '1.4K Decentralized Retail Holders',
        tag: 'retail',
        address: '1,380 Individual Wallets',
        balanceTokens: '672,100,000 $SENT',
        supplyPct: 67.21,
        valueUsd: '$28,564,250',
        x: 100,
        y: 190,
        r: 38,
        fundingSource: 'Organic Solana Mainnet Inflows',
        color: 'rgba(71, 85, 105, 0.25)',
        borderColor: '#98A3B3',
      },
    ];

    const edges = [
      { source: 'node_dev_creator', target: 'node_sniper_cluster', type: 'funding_link', stroke: 'rgba(245, 158, 11, 0.4)' },
      { source: 'node_dev_creator', target: 'node_insider_cluster', type: 'transfer_link', stroke: 'rgba(56, 189, 248, 0.4)' },
      { source: 'node_dex_raydium', target: 'node_dev_creator', type: 'genesis_lp', stroke: 'rgba(6, 182, 212, 0.3)' },
    ];

    return jsonResponse({
      token: address,
      chain: chain.toLowerCase(),
      stats,
      nodes,
      edges,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch bubble map', 500));
  }
}
