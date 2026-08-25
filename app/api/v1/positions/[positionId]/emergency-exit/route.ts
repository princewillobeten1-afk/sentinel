import { ApiError } from '@/lib/server/errors';
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
    // A price default is a fabrication: it silently prices a real decision
    // off a constant. 0.0425 was that constant here, identical for every
    // token. Absent now fails loudly instead.
    const { currentPrice } = body;
    if (!Number.isFinite(Number(currentPrice)) || Number(currentPrice) <= 0) {
      throw new ApiError('currentPrice is required to size an emergency exit', 400);
    }

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
