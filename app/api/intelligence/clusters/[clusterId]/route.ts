import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { clusterId: string } }) {
  return NextResponse.json({
    id: params.clusterId,
    walletCount: 17,
    confidence: 87,
    riskProfile: 'HIGH',
    evidenceSummary: 'The wallets show repeated coordinated entry patterns across 8 launches and share a common funding source.',
    metrics: {
      tokensParticipated: 23,
      earlyEntries: 18,
      creatorLinked: 4,
      coordinatedExits: 7
    },
    topWallets: [
      '0x1234...abcd',
      '0x5678...ef01',
      '0x90ab...2345'
    ],
    relationshipSignals: [
      { type: 'Shared Funding', strength: 'HIGH' },
      { type: 'Timing Similarity', strength: 'HIGH' },
      { type: 'Token Overlap', strength: 'MEDIUM' }
    ]
  });
}
