import { NextResponse } from 'next/server';
import { WalletProfiler } from '@/lib/analytics';

export async function GET(
  request: Request,
  { params }: { params: { walletAddress: string } }
) {
  const { walletAddress } = params;

  const profile = WalletProfiler.profileWallet({
    walletAddress,
    trades: [
      {
        tradeId: 't1',
        tokenMint: 'TokenA',
        entryTimestamp: Date.now() - 3600000,
        exitTimestamp: Date.now() - 1800000,
        poolCreationTimestamp: Date.now() - 3700000,
        buyAmountUsd: 5000,
        sellAmountUsd: 7200,
        realizedPnlUsd: 2200,
      },
      {
        tradeId: 't2',
        tokenMint: 'TokenB',
        entryTimestamp: Date.now() - 86400000,
        exitTimestamp: Date.now() - 82800000,
        poolCreationTimestamp: Date.now() - 86500000,
        buyAmountUsd: 8000,
        sellAmountUsd: 12400,
        realizedPnlUsd: 4400,
      },
    ],
    clusterId: `cluster_${walletAddress.slice(0, 6)}`,
    clusterConfidencePct: 82,
  });

  const cluster = WalletProfiler.buildClusterNode({
    clusterId: profile.clusterId!,
    memberWallets: [walletAddress, 'SolanaClusterMember2...abc', 'SolanaClusterMember3...xyz'],
    commonFundingSource: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    collectiveOwnershipPct: 8.4,
  });

  return NextResponse.json({
    walletProfile: profile,
    clusterDetails: cluster,
    timestamp: new Date().toISOString(),
  });
}
