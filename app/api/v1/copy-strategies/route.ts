export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // Stub for getting copy strategies
  const strategies = [
    {
      id: 'cs_123',
      traderWalletId: '2Kvw...9xab',
      allocation: 5000,
      mode: 'PROPORTIONAL',
      maxPosition: 500,
      maxDailyLoss: 300,
      status: 'ACTIVE',
      currentValue: 6320,
      netPnl: 1320
    }
  ];

  return NextResponse.json(strategies);
}

export async function POST(request: Request) {
  const body = await request.json();
  // Stub for creating a strategy
  
  return NextResponse.json({
    id: `cs_${Date.now()}`,
    ...body,
    status: 'ACTIVE'
  });
}
