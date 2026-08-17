export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // In a real DB, SELECT * FROM conditional_orders WHERE status IN ('OPEN', 'MONITORING')
  // Mock response
  const mockOpenOrders = [
    {
      id: 'mock-stop-1',
      tokenIn: 'TOKEN',
      tokenOut: 'USDC',
      side: 'SELL',
      orderType: 'STOP_LOSS',
      status: 'MONITORING',
      condition: {
        source: 'DEX_AGGREGATED',
        targetPrice: 0.82,
        operator: '<='
      },
      quantityType: 'PERCENT_POSITION',
      quantityValue: 50
    },
    {
      id: 'mock-limit-1',
      tokenIn: 'USDC',
      tokenOut: 'TOKEN',
      side: 'BUY',
      orderType: 'LIMIT',
      status: 'MONITORING',
      condition: {
        source: 'POOL_PRICE',
        targetPrice: 0.55,
        operator: '<='
      },
      quantityType: 'ABSOLUTE',
      quantityValue: 1000
    }
  ];

  return NextResponse.json({ orders: mockOpenOrders });
}
