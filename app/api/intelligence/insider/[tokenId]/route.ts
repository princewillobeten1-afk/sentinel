export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { InsiderCategory, TokenInsiderRisk } from '@/lib/intelligence/insider/types';

export async function GET(request: Request, { params }: { params: { tokenId: string } }) {
  // Mock implementation returning a structured TokenInsiderRisk object
  
  const mockResponse: TokenInsiderRisk = {
    tokenId: params.tokenId,
    riskScore: 'HIGH',
    confidence: 'HIGH',
    clusteredOwnershipPct: 13.4,
    signals: [
      {
        id: 'signal-1',
        tokenId: params.tokenId,
        category: InsiderCategory.FUNDING_CLUSTER,
        confidence: 90,
        evidence: [
          { description: '14 related wallets identified', weight: 28 },
          { description: 'Common funding source across 12 wallets', weight: 15 }
        ]
      },
      {
        id: 'signal-2',
        tokenId: params.tokenId,
        category: InsiderCategory.PRE_LAUNCH_ACCUMULATION,
        confidence: 85,
        evidence: [
          { description: '9 entered before major volume', weight: 21 }
        ]
      },
      {
        id: 'signal-3',
        tokenId: params.tokenId,
        category: InsiderCategory.COORDINATED_SELLING,
        confidence: 80,
        timeWindow: '42s',
        evidence: [
          { description: '6 coordinated exits', weight: 10 }
        ]
      }
    ]
  };

  return NextResponse.json(mockResponse);
}
