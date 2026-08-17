export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { globalReservationManager } from '@/lib/order/reservation';
import { globalTriggerEngine } from '@/lib/order/trigger';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  
  try {
    const body = await request.json();
    
    // In a real app, we'd update the database and save a revision to order_revisions.
    // For MVP, just return success.
    
    return NextResponse.json({ 
      message: 'Order updated successfully',
      id,
      updatedFields: Object.keys(body)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  
  // This endpoint is for cancellation
  
  // 1. Unregister from Trigger Engine
  globalTriggerEngine.unregisterOrder(id);
  
  // 2. Release any reserved balances
  globalReservationManager.release(id);
  
  // 3. Update DB to CANCELLED (mocked)
  
  return NextResponse.json({ 
    message: 'Order cancelled successfully',
    order: { id, status: 'CANCELLED' }
  });
}
