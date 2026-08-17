export const dynamic = 'force-dynamic';
import { jsonResponse } from '@/lib/server/api';
import { withApiGateway } from '@/lib/server/api-gateway';

export const GET = withApiGateway(
  async (_ctx, _request, params) => {
    const launchId = params.id;

    // Stub: Fetch Launch Config and State from DB
    return jsonResponse({
      id: launchId,
      config: {
        name: 'Mock Token Alpha',
        symbol: 'MOCKA',
        description: 'A mock token for testing the bonding curve.',
        totalSupply: '1000000000',
        launchMode: 'BONDING_CURVE',
      },
      state: 'LIVE',
      bondingCurve: {
        currentPrice: '0.000015',
        circulatingSupply: '150000000',
        reserveBalance: '22.5',
        marketCap: '220000',
        graduationTarget: '85',
        buyFeePercentage: 0.01,
        sellFeePercentage: 0.01,
      },
    });
  },
  { scopes: ['READ_TOKEN_INTELLIGENCE'], optionalAuth: true },
);
