export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { globalReservationManager } from '@/lib/order/reservation';
import { globalTriggerEngine, ConditionalOrder } from '@/lib/order/trigger';

// Mock DB
let conditionalOrders: ConditionalOrder[] = [];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, chain, tokenIn, tokenOut, side, quantityType, quantityValue, orderType, condition, expiresAt } = body;

    // Validate
    if (!walletAddress || !tokenIn || !quantityValue || !orderType || !condition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const orderId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

    // Mock total balance (this would come from a wallet service)
    const mockTotalBalance = 10000; 

    // Reserve balance if it's an ABSOLUTE quantity
    if (quantityType === 'ABSOLUTE') {
      const reserved = globalReservationManager.reserve(orderId, walletAddress, tokenIn, quantityValue, mockTotalBalance);
      if (!reserved) {
        return NextResponse.json({ error: 'Insufficient available balance. You have other open orders reserving these tokens.' }, { status: 400 });
      }
    }

    const newOrder: ConditionalOrder = {
      id: orderId,
      chain,
      tokenIn,
      tokenOut,
      side,
      quantityType,
      quantityValue,
      orderType,
      status: 'MONITORING',
      condition,
    };

    conditionalOrders.push(newOrder);

    // Register with Trigger Engine
    globalTriggerEngine.registerOrder(newOrder);

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return NextResponse.json({ orders: conditionalOrders });
}
