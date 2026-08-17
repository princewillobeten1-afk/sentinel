import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { chain, address } = params;

    const pools = [
      {
        id: 'pool_raydium',
        dex: 'Raydium CPMM',
        pair: 'SOL / $SENT',
        poolAddress: '5xRydm99qP88x12kL0z1',
        liquidityUsd: '$384,500.00',
        reserves: {
          sol: '1,280.5 SOL ($192,075)',
          token: '4,527,647 $SENT ($192,425)',
        },
        volume24h: '$1,240,500.00',
        fees24h: '$3,721.50',
        apy: '142.8%',
        lockStatus: 'burned',
        lockDetails: '🔥 100% LP Burned (Solana Incinerator)',
        feeTier: '0.25%',
      },
      {
        id: 'pool_orca',
        dex: 'Orca Whirlpool',
        pair: 'SOL / $SENT (Concentrated)',
        poolAddress: 'orca_whirl_41a99x88b7',
        liquidityUsd: '$112,000.00',
        reserves: {
          sol: '373.3 SOL ($56,000)',
          token: '1,317,647 $SENT ($56,000)',
        },
        volume24h: '$418,200.00',
        fees24h: '$1,254.60',
        apy: '168.4%',
        lockStatus: 'locked',
        lockDetails: '🔒 Locked 365 Days on Streamflow',
        feeTier: '0.30%',
      },
      {
        id: 'pool_meteora',
        dex: 'Meteora DLMM',
        pair: 'USDC / $SENT',
        poolAddress: 'met_dlmm_89z01k44w',
        liquidityUsd: '$65,000.00',
        reserves: {
          sol: '32,500 USDC',
          token: '764,705 $SENT ($32,500)',
        },
        volume24h: '$194,000.00',
        fees24h: '$970.00',
        apy: '215.2%',
        lockStatus: 'locked',
        lockDetails: '🔒 Locked 180 Days',
        feeTier: '0.25% - 1.50% (Dynamic)',
      },
    ];

    const topProviders = [
      {
        rank: 1,
        provider: 'Solana Incinerator (Burn Address)',
        tag: '🔥 100% LP Burnt',
        pool: 'Raydium CPMM (SOL/SENT)',
        lpTokens: '184,200,000 LP',
        sharePct: '85.2%',
        valueUsd: '$327,594.00',
        lockStatus: 'Burned 🔥',
      },
      {
        rank: 2,
        provider: 'Raydium Protocol Vault',
        tag: 'AMM Protocol Reserve',
        pool: 'Raydium CPMM (SOL/SENT)',
        lpTokens: '18,500,000 LP',
        sharePct: '8.5%',
        valueUsd: '$32,682.00',
        lockStatus: 'Locked 🔒',
        lockExpiry: 'Permanent Protocol Vault',
      },
      {
        rank: 3,
        provider: 'Streamflow Lock Vault (Orca)',
        tag: 'Whale LP Lock',
        pool: 'Orca Whirlpool (SOL/SENT)',
        lpTokens: '8,400,000 LP',
        sharePct: '4.2%',
        valueUsd: '$16,149.00',
        lockStatus: 'Locked 🔒',
        lockExpiry: '342 days remaining',
      },
      {
        rank: 4,
        provider: 'Community DAO Treasury',
        tag: 'Ecosystem Liquidity',
        pool: 'Meteora DLMM (USDC/SENT)',
        lpTokens: '4,500,000 LP',
        sharePct: '2.1%',
        valueUsd: '$8,074.50',
        lockStatus: 'Locked 🔒',
        lockExpiry: '168 days remaining',
      },
    ];

    return jsonResponse({
      token: address,
      chain: chain.toLowerCase(),
      totalLiquidityUsd: '$561,500.00',
      total24hVolumeUsd: '$1,852,700.00',
      total24hFeesUsd: '$5,946.10',
      pools,
      topProviders,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch liquidity info', 500));
  }
}
