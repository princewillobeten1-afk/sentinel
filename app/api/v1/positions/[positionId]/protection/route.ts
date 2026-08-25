import { ApiError } from '@/lib/server/errors';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { protectionService } from '@/lib/protection/protection-service';

export async function GET(
  req: NextRequest,
  { params }: { params: { positionId: string } }
) {
  try {
    const { positionId } = params;
    const protection = protectionService.getProtection(positionId);
    const history = protectionService.getExecutionHistory(positionId);

    return NextResponse.json({
      success: true,
      protection,
      history
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch position protection' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { positionId: string } }
) {
  try {
    const { positionId } = params;
    const body = await req.json();
    // These defaults invented an entire position — a `$SENT` token at an entry
    // of $0.035 and 10,000 units held — for any caller that omitted them, and
    // then computed stop-loss and take-profit levels against it. Protection
    // levels have to be derived from the caller's real position or not at all.
    const {
      walletId,
      tokenId,
      tokenSymbol,
      entryPrice,
      currentPrice,
      positionTokens,
      protectionMode = 'BALANCED',
      autoBreakEven = true,
      stopLoss,
      takeProfits
    } = body;

    for (const [field, value] of [
      ['tokenId', tokenId],
      ['entryPrice', entryPrice],
      ['currentPrice', currentPrice],
      ['positionTokens', positionTokens],
    ] as const) {
      const numeric = field === 'tokenId' ? null : Number(value);
      if (value === undefined || (numeric !== null && (!Number.isFinite(numeric) || numeric <= 0))) {
        throw new ApiError(`${field} is required to compute protection levels`, 400);
      }
    }

    const protection = protectionService.setProtection({
      positionId,
      walletId,
      tokenId,
      tokenSymbol,
      entryPrice: parseFloat(entryPrice),
      currentPrice: parseFloat(currentPrice),
      positionTokens: parseFloat(positionTokens),
      protectionMode,
      autoBreakEven,
      stopLoss,
      takeProfits
    });

    return NextResponse.json({
      success: true,
      protection
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to set position protection' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { positionId: string } }
) {
  try {
    const { positionId } = params;
    const success = protectionService.removeProtection(positionId);

    return NextResponse.json({
      success,
      message: success ? 'Position protection removed' : 'Protection not found'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove position protection' },
      { status: 500 }
    );
  }
}
