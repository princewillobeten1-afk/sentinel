import { jsonResponse } from '@/lib/server/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonResponse({
    engine: 'Sentinel Token Intelligence Engine v1',
    methodologyVersion: 'sentinel-intelligence-v1.0.0',
    availableEndpoints: [
      'GET  /api/v1/intelligence/:chain/:token',
      'GET  /api/v1/intelligence/:chain/:token/signals',
      'GET  /api/v1/intelligence/:chain/:token/history',
      'GET  /api/v1/intelligence/:chain/:token/timeline',
      'GET  /api/v1/intelligence/:chain/:token/market',
      'GET  /api/v1/intelligence/:chain/:token/liquidity',
      'GET  /api/v1/intelligence/:chain/:token/contract',
    ],
    supportedChains: ['solana'],
    scoreInterpretation: {
      '90-100': 'Strong observable profile',
      '75-89': 'Generally favorable observable profile',
      '60-74': 'Mixed profile',
      '40-59': 'Elevated concerns',
      '20-39': 'High concern',
      '0-19': 'Severe observable concerns',
    },
    disclaimer: 'Intelligence scores reflect observable data patterns and are not financial recommendations.',
  });
}
