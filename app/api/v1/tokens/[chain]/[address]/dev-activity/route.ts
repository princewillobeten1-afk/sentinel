import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { chain, address } = params;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    const devProfile = {
      creatorWallet: '7xK99zK8mP2xQ5wN3a19',
      isVerified: true,
      currentHoldingTokens: '8,500,000 $SENT',
      currentHoldingUsd: '$361,250.00',
      currentHoldingSupplyPct: '0.85%',
      totalDevBoughtSol: '45.00 SOL ($6,750.00)',
      totalDevSoldSol: '366.60 SOL ($55,000.00)',
      netRealizedProfitSol: '+321.60 SOL',
      netRealizedProfitUsd: '+$48,250.00',
      dumpRiskRating: 'LOW (Dev holds <1% supply)',
      isLpBurned: true,
      genesisDate: '2026-08-13T10:00:00Z',
    };

    const allEvents = [
      {
        id: 'dev_act_1',
        type: 'buy',
        label: 'Dev Accumulation Buy',
        amountSol: '+15.00 SOL',
        tokens: '+352,941 $SENT',
        price: '$0.0425',
        valueUsd: '$2,250.00',
        impact: '+1.8% Pump',
        devBalanceAfter: '8,500,000 $SENT',
        devSupplyPct: '0.85%',
        time: '1h ago',
        txHash: '5xQ88m19aL0',
      },
      {
        id: 'dev_act_2',
        type: 'sell',
        label: 'Dev Partial Profit Take',
        amountSol: '-45.00 SOL',
        tokens: '-1,058,823 $SENT',
        price: '$0.0425',
        valueUsd: '$6,750.00',
        impact: '-2.4% Dip',
        devBalanceAfter: '8,147,059 $SENT',
        devSupplyPct: '0.81%',
        time: '6h ago',
        txHash: '3vK19z88bC2',
      },
      {
        id: 'dev_act_3',
        type: 'buy',
        label: 'Dev Re-buy Support',
        amountSol: '+20.00 SOL',
        tokens: '+487,804 $SENT',
        price: '$0.0410',
        valueUsd: '$3,000.00',
        impact: '+2.1% Bounce',
        devBalanceAfter: '9,205,882 $SENT',
        devSupplyPct: '0.92%',
        time: '1d ago',
        txHash: '9zL44k88wP3',
      },
      {
        id: 'dev_act_4',
        type: 'burn',
        label: '🔥 LP Tokens Burned',
        tokens: '184,200,000 LP',
        valueUsd: '$384,500.00',
        impact: '100% Permanently Burnt',
        devBalanceAfter: '8,718,078 $SENT',
        devSupplyPct: '0.87%',
        time: '3d ago',
        txHash: '4xBurn99z1k2',
      },
      {
        id: 'dev_act_5',
        type: 'lp_add',
        label: 'Initial DEX Liquidity Add',
        amountSol: '+1,200.00 SOL',
        tokens: '184,200,000 $SENT',
        price: '$0.00098',
        valueUsd: '$180,000.00',
        impact: 'Genesis Pool',
        devBalanceAfter: '10,000,000 $SENT',
        devSupplyPct: '1.00%',
        time: '3d ago',
        txHash: '1aGenesis99q',
      },
      {
        id: 'dev_act_6',
        type: 'mint',
        label: 'Token Creation & Mint',
        tokens: '1,000,000,000 $SENT',
        valueUsd: 'Genesis Supply',
        impact: 'Mint Revoked',
        devBalanceAfter: '1,000,000,000 $SENT',
        devSupplyPct: '100.0%',
        time: '3d ago',
        txHash: '7xMintRevoked',
      },
    ];

    let filtered = allEvents;
    if (filter === 'buy') {
      filtered = filtered.filter((e) => e.type === 'buy');
    } else if (filter === 'sell') {
      filtered = filtered.filter((e) => e.type === 'sell');
    } else if (filter === 'lp') {
      filtered = filtered.filter((e) => e.type === 'lp_add' || e.type === 'burn');
    }

    return jsonResponse({
      token: address,
      chain: chain.toLowerCase(),
      devProfile,
      events: filtered,
      totalEvents: filtered.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch dev activity', 500));
  }
}
