import { jsonResponse, errorResponse } from '@/lib/server/api';
import { aiGateway } from '@/lib/ai/gateway';
import { TokenAiAnalyst } from '@/lib/ai/token-analyst';
import { CreatorAiAnalyst } from '@/lib/ai/creator-analyst';
import { WalletAiAnalyst } from '@/lib/ai/wallet-analyst';
import { PortfolioAiAnalyst } from '@/lib/ai/portfolio-analyst';
import { EvidenceBuilder } from '@/lib/ai/evidence-builder';
import { AiAudiencePersona } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      type = 'token', // 'token' | 'creator' | 'wallet' | 'portfolio'
      tokenAddress,
      creatorAddress,
      walletAddress,
      positions,
      persona = 'ADVANCED' as AiAudiencePersona,
      question,
    } = body;

    if (type === 'token') {
      const address = tokenAddress || 'So11111111111111111111111111111111111111112';
      const evidence = EvidenceBuilder.buildEvidencePackage({ tokenAddress: address });

      if (question) {
        const directAnswer = await TokenAiAnalyst.answerTraderQuestion(question, evidence);
        return jsonResponse({
          type: 'token_question',
          tokenAddress: address,
          question,
          response: directAnswer,
        });
      }

      const report = TokenAiAnalyst.generateReport(evidence, persona);
      return jsonResponse({
        type: 'token_report',
        tokenAddress: address,
        persona,
        report,
      });
    }

    if (type === 'creator') {
      if (!creatorAddress) {
        return jsonResponse({ error: 'creatorAddress required for creator analysis' }, 400);
      }
      const creatorAnalysis = CreatorAiAnalyst.analyzeCreator({ creatorAddress });
      return jsonResponse({
        type: 'creator_analysis',
        creatorAddress,
        analysis: creatorAnalysis,
      });
    }

    if (type === 'wallet') {
      if (!walletAddress) {
        return jsonResponse({ error: 'walletAddress required for wallet analysis' }, 400);
      }
      const walletAnalysis = WalletAiAnalyst.analyzeWallet({ walletAddress });
      return jsonResponse({
        type: 'wallet_analysis',
        walletAddress,
        analysis: walletAnalysis,
      });
    }

    if (type === 'portfolio') {
      const portfolioAnalysis = PortfolioAiAnalyst.analyzePortfolio(positions || []);
      return jsonResponse({
        type: 'portfolio_analysis',
        analysis: portfolioAnalysis,
      });
    }

    return jsonResponse({ error: `Unsupported analysis type: ${type}` }, 400);
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
