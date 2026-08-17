import { jsonResponse, errorResponse } from '@/lib/server/api';
import { TraderCopilot } from '@/lib/ai/copilot';
import { EvidenceBuilder } from '@/lib/ai/evidence-builder';
import { PreTradeCheckRequest } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      tokenAddress = 'So11111111111111111111111111111111111111112',
      tradeType = 'BUY',
      orderSizeUsd = 500,
      maxSlippagePct = 3.0,
      userProfile = 'BALANCED',
    } = body;

    const checkRequest: PreTradeCheckRequest = {
      tokenAddress,
      tradeType,
      orderSizeUsd: Number(orderSizeUsd),
      maxSlippagePct: Number(maxSlippagePct),
      userProfile,
    };

    const evidence = EvidenceBuilder.buildEvidencePackage({ tokenAddress });
    const checkResult = TraderCopilot.evaluateTradeCheck(checkRequest, evidence);

    return jsonResponse({
      type: 'trade_check_result',
      check: checkResult,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
