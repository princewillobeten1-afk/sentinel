import React from 'react';
import { WalletProfileView } from '@/components/wallet/wallet-profile-view';
import {
  getSentActivityData,
  getQuantActivityData,
  getBonkActivityData,
  getAlphaActivityData,
} from '@/lib/mocks/activity-mocks';
import { analyzeInsiderCandidates } from '@/lib/activity/insider-engine';
import { buildWalletProfile } from '@/lib/activity/pipeline';

interface WalletPageProps {
  params: {
    chain: string;
    address: string;
  };
}

export default function WalletDetailPage({ params }: WalletPageProps) {
  const { chain, address } = params;

  // Search across mock token datasets
  const datasets = [
    getAlphaActivityData(),
    getQuantActivityData(),
    getSentActivityData(),
    getBonkActivityData(),
  ];

  let matchedData = datasets.find((d) => d.trades.some((t) => t.wallet === address));
  if (!matchedData) {
    matchedData = getAlphaActivityData();
  }

  const currentPositionsUsd = 'currentPositionsUsd' in matchedData ? (matchedData.currentPositionsUsd as Record<string, number>) : undefined;
  const realizedPnlUsd = 'realizedPnlUsd' in matchedData ? (matchedData.realizedPnlUsd as Record<string, number>) : undefined;
  const unrealizedPnlUsd = 'unrealizedPnlUsd' in matchedData ? (matchedData.unrealizedPnlUsd as Record<string, number>) : undefined;

  const insiderReport = analyzeInsiderCandidates({
    trades: matchedData.trades,
    context: matchedData.context,
    currentPositionsUsd,
    realizedPnlUsd,
    unrealizedPnlUsd,
  });

  const profile = buildWalletProfile(
    address,
    chain,
    matchedData.trades,
    matchedData.context,
    insiderReport,
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8">
      <WalletProfileView profile={profile} address={address} chain={chain} />
    </div>
  );
}
