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
    const {
      walletId = 'w-solana-primary',
      tokenId = 'SENT',
      tokenSymbol = '$SENT',
      entryPrice = 0.035,
      currentPrice = 0.0425,
      positionTokens = 10000,
      protectionMode = 'BALANCED',
      autoBreakEven = true,
      stopLoss,
      takeProfits
    } = body;

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
