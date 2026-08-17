export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { protectionService } from '@/lib/protection/protection-service';

export async function POST(
  req: NextRequest,
  { params }: { params: { positionId: string } }
) {
  try {
    const { positionId } = params;
    const body = await req.json().catch(() => ({}));
    const { currentPrice = 0.0425 } = body;

    const result = protectionService.executeEmergencyExit(positionId, parseFloat(currentPrice));

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      executionRecord: result.executionRecord
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Emergency exit execution failed' },
      { status: 500 }
    );
  }
}
