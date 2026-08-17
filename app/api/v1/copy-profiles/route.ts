export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // In a real app, this would insert into `copy_profiles`
    // using the authenticated user's ID
    const newProfile = {
      id: 'cp_' + Date.now(),
      leaderWallet: body.leaderWallet,
      mode: body.mode || 'BALANCED',
      allocationUsd: body.allocationUsd,
      maxTradeUsd: body.maxTradeUsd,
      maxTokenExposurePercent: body.maxTokenExposurePercent,
      maxTokenRiskScore: body.maxTokenRiskScore,
      minExitabilityScore: body.minExitabilityScore,
      maxPriceDeviationPercent: body.maxPriceDeviationPercent,
      copyBuys: body.copyBuys !== false,
      copySells: body.copySells !== false,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: newProfile
    });
  } catch (error) {
    console.error('Copy Profile Creation Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    // Mock profiles
    return NextResponse.json({
      success: true,
      data: [
        {
          id: 'cp_mock_1',
          leaderWallet: '0x8f2d...4a9e',
          mode: 'BALANCED',
          allocationUsd: 5000,
          status: 'ACTIVE'
        }
      ]
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
