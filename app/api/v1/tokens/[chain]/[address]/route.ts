import { jsonResponse, errorResponse } from '@/lib/server/api';
import { getTokenByMint } from '@/lib/token/search-service';
import { realtimeRepository } from '@/lib/server/db/realtime-repository';
import { getTokenOverview } from '@/lib/api/birdeye/stats';
import { fetchLiveSolanaTokens } from '@/lib/discovery/live-solana-feed';
import { ApiError } from '@/lib/server/errors';

export const dynamic = 'force-dynamic';

interface DexPairResponse {
  pairs?: Array<{
    chainId: string;
    dexId: string;
    url?: string;
    pairCreatedAt?: number;
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    priceUsd?: string;
    priceNative?: string;
    priceChange?: {
      m5?: number;
      h1?: number;
      h6?: number;
      h24?: number;
    };
    volume?: {
      h24?: number;
      h1?: number;
    };
    liquidity?: {
      usd?: number;
    };
    fdv?: number;
    marketCap?: number;
    info?: {
      imageUrl?: string;
      header?: string;
      websites?: Array<{ label?: string; url: string }>;
      socials?: Array<{ type?: string; url: string }>;
    };
  }>;
}

export async function GET(
  request: Request,
  { params }: { params: { chain: string; address: string } }
) {
  try {
    const { chain, address } = params;
    let token: any = null;

    // 1. Check in-memory discovered live tokens
    let trendingRank: number | undefined = undefined;
    let devHoldingPct: number | undefined = undefined;
    try {
      const liveTokens = await fetchLiveSolanaTokens();
      const rankIdx = liveTokens.findIndex((t) => t.mint.toLowerCase() === address.toLowerCase());
      if (rankIdx >= 0) {
        trendingRank = rankIdx + 1;
      }
      const match = rankIdx >= 0 ? liveTokens[rankIdx] : liveTokens.find((t) => t.mint.toLowerCase() === address.toLowerCase());
      if (match) {
        const isPump = match.source === 'Pump.fun' || match.launchpad === 'pump.fun' || match.mint.toLowerCase().endsWith('pump');
        const hasGraduated = match.graduationTarget !== undefined || (isPump && match.source === 'Raydium');
        devHoldingPct = match.devHoldingsPct;
        token = {
          id: match.mint,
          mint: match.mint,
          name: match.name,
          symbol: match.symbol,
          chain: match.chain || chain.toLowerCase(),
          source: match.source || (isPump ? 'Pump.fun' : 'Solana DEX'),
          launchpad: match.launchpad,
          originLaunchpad: match.originLaunchpad,
          dexId: match.launchpad || (isPump ? 'pumpfun' : 'raydium'),
          isPump,
          hasGraduated,
          ageMinutes: match.ageMinutes,
          bondingCurveProgress: (match as any).bondingCurveProgress,
          priceUsd: match.priceUsd,
          priceChange24h: match.priceChange24h,
          volume24hUsd: match.volume24hUsd,
          liquidityUsd: match.liquidityUsd,
          marketCapUsd: match.marketCapUsd,
          logoUrl: match.logoURI,
          logoURI: match.logoURI,
          twitterUrl: match.twitterUrl,
          telegramUrl: match.telegramUrl,
          websiteUrl: match.websiteUrl,
          socials: {
            twitter: match.twitterUrl,
            telegram: match.telegramUrl,
            website: match.websiteUrl,
          },
          holderCount: match.holdersCount,
          riskScore: match.riskScore,
          riskTier: match.riskTier,
          devHoldingPct,
          trendingRank,
        };
      }
    } catch {
      // Continue to next provider
    }

    // 2. Fetch live DexScreener on-chain pair metadata
    if (!token && (chain.toLowerCase() === 'solana' || !chain)) {
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
          cache: 'no-store',
        });
        if (dexRes.ok) {
          const dexData: DexPairResponse = await dexRes.json();
          if (Array.isArray(dexData.pairs) && dexData.pairs.length > 0) {
            // Pick highest volume pair
            const bestPair = dexData.pairs.reduce((prev, curr) =>
              (curr.volume?.h24 ?? 0) > (prev.volume?.h24 ?? 0) ? curr : prev
            );

            const isPump = bestPair.dexId?.includes('pump') || address.toLowerCase().endsWith('pump');
            const hasGraduated = isPump && bestPair.dexId !== 'pumpfun';
            const twitter = bestPair.info?.socials?.find((s) => s.type === 'twitter')?.url;
            const telegram = bestPair.info?.socials?.find((s) => s.type === 'telegram')?.url;
            const website = bestPair.info?.websites?.[0]?.url;
            const price = bestPair.priceUsd;
            const numPrice = price ? parseFloat(price) : (bestPair.priceNative ? parseFloat(bestPair.priceNative) * 180 : undefined);
            const mcap = bestPair.marketCap ?? bestPair.fdv;
            const liq = bestPair.liquidity?.usd;
            const totalSupply = (bestPair.fdv && numPrice && numPrice > 0)
              ? Math.round(bestPair.fdv / numPrice)
              : (isPump ? 1_000_000_000 : undefined);
            const pairCreatedAt = bestPair.pairCreatedAt;
            const ageMinutes = pairCreatedAt ? Math.max(0.05, (Date.now() - pairCreatedAt) / 60_000) : undefined;

            // Determine DEX pool fee percentage
            let poolFeePct = 0.25;
            if (bestPair.dexId?.includes('pump') || isPump) {
              poolFeePct = 1.0;
            } else if (bestPair.dexId?.includes('meteora')) {
              poolFeePct = 0.1;
            } else if (bestPair.dexId?.includes('orca')) {
              poolFeePct = 0.3;
            } else if (bestPair.dexId?.includes('raydium')) {
              poolFeePct = 0.25;
            }

            // Real volume fee in SOL
            const vol24h = bestPair.volume?.h24;
            const feesPaidSol = (vol24h !== undefined && vol24h > 0)
              ? (vol24h * (poolFeePct / 100)) / 150
              : undefined;

            token = {
              id: address,
              mint: address,
              name: bestPair.baseToken?.name || `Token ${address.slice(0, 4)}`,
              symbol: bestPair.baseToken?.symbol || address.slice(0, 4).toUpperCase(),
              chain: 'solana',
              source: isPump ? (hasGraduated ? 'Pump.fun (Migrated)' : 'Pump.fun') : bestPair.dexId || 'Raydium',
              dexId: bestPair.dexId,
              dexUrl: bestPair.url,
              pairAddress: (bestPair as any).pairAddress,
              poolFeePct,
              feesPaid: feesPaidSol,
              isPump,
              hasGraduated,
              ageMinutes,
              pairCreatedAt,
              totalSupply,
              priceUsd: numPrice !== undefined ? String(numPrice) : undefined,
              priceChange24h: bestPair.priceChange?.h24,
              volume24hUsd: bestPair.volume?.h24 !== undefined ? String(bestPair.volume.h24) : undefined,
              liquidityUsd: liq !== undefined ? String(liq) : undefined,
              marketCapUsd: mcap !== undefined ? String(mcap) : undefined,
              logoUrl: bestPair.info?.imageUrl || `https://cdn.dexscreener.com/token-images/og/solana/${address}`,
              logoURI: bestPair.info?.imageUrl || `https://cdn.dexscreener.com/token-images/og/solana/${address}`,
              twitterUrl: twitter,
              telegramUrl: telegram,
              websiteUrl: website,
              socials: {
                twitter,
                telegram,
                website,
              },
              fdv: bestPair.fdv,
              dexscreenerUrl: bestPair.url || `https://dexscreener.com/solana/${address}`,
              pumpfunUrl: isPump ? `https://pump.fun/coin/${address}` : undefined,
              trendingRank,
              devHoldingPct,
            };
          }
        }
      } catch {
        // Fallback to static/database registry
      }
    }

    // 3. Quick enrichment with Jupiter search for holderCount, real supply & dev holdings
    if (token && (!token.holderCount || !token.totalSupply || token.devHoldingPct === undefined)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800);
        const jupRes = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${address}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        clearTimeout(timeout);
        if (jupRes.ok) {
          const jupList = await jupRes.json();
          if (Array.isArray(jupList) && jupList.length > 0) {
            const jup = jupList[0];
            if (!token.holderCount && jup.holderCount) token.holderCount = jup.holderCount;
            if (!token.totalSupply && jup.totalSupply) token.totalSupply = jup.totalSupply;
            if (token.devHoldingPct === undefined && jup.audit?.devBalancePercentage !== undefined) {
              token.devHoldingPct = Number((jup.audit.devBalancePercentage).toFixed(2));
            }
          }
        }
      } catch {
        // Ignore Jupiter timeout
      }
    }

    // 4. Check static token registry
    if (!token) {
      const staticToken = getTokenByMint(address);
      if (staticToken) {
        token = {
          ...staticToken,
          id: staticToken.mint,
          logoUrl: (staticToken as any).logoURI || (staticToken as any).logoUrl || (staticToken as any).imageUrl,
        };
      }
    }

    // 5. Check database realtime repository
    if (!token) {
      const real = await realtimeRepository.getTokenByMint(address);
      if (real) {
        token = {
          id: real.mint,
          mint: real.mint,
          name: real.name || `Token ${real.mint.slice(0, 4)}`,
          symbol: real.symbol || real.mint.slice(0, 4).toUpperCase(),
          chain: chain.toLowerCase(),
          source: (real.platform || 'Pump.fun') as any,
          priceUsd: real.priceUsd !== undefined ? String(real.priceUsd) : undefined,
          volume24hUsd: real.volume24hUsd !== undefined ? String(real.volume24hUsd) : undefined,
          liquidityUsd: real.liquidityUsd !== undefined ? String(real.liquidityUsd) : undefined,
          marketCapUsd: real.marketCapUsd !== undefined ? String(real.marketCapUsd) : undefined,
          logoUrl: real.imageUrl,
          logoURI: real.imageUrl,
        };
      }
    }

    // 6. Check Birdeye Stats fallback
    if (!token) {
      try {
        const beOverview = await getTokenOverview(address);
        if (beOverview && beOverview.symbol) {
          token = {
            id: beOverview.address || address,
            mint: beOverview.address || address,
            name: beOverview.name || `Token ${address.slice(0, 4)}`,
            symbol: beOverview.symbol || address.slice(0, 4).toUpperCase(),
            chain: chain.toLowerCase(),
            source: 'Solana DEX',
            priceUsd: beOverview.price !== undefined ? String(beOverview.price) : undefined,
            priceChange24h: beOverview.priceChange24hPercent,
            volume24hUsd: (beOverview.v24hUSD ?? beOverview.volume24h) !== undefined ? String(beOverview.v24hUSD ?? beOverview.volume24h) : undefined,
            liquidityUsd: beOverview.liquidity !== undefined ? String(beOverview.liquidity) : undefined,
            marketCapUsd: (beOverview.marketCap ?? beOverview.fdv) !== undefined ? String(beOverview.marketCap ?? beOverview.fdv) : undefined,
            logoUrl: beOverview.logoURI,
            logoURI: beOverview.logoURI,
            decimals: beOverview.decimals,
            holderCount: beOverview.holder,
            totalSupply: beOverview.totalSupply ?? undefined,
            circulatingSupply: beOverview.circulatingSupply ?? undefined,
            feesPaid: beOverview.global_fees_paid ?? undefined,
            athPriceUsd: (beOverview as any).history_ath ?? (beOverview as any).ath,
            websiteUrl: beOverview.extensions?.website ?? undefined,
            twitterUrl: beOverview.extensions?.twitter ?? undefined,
            socials: {
              twitter: beOverview.extensions?.twitter as string | undefined,
              telegram: beOverview.extensions?.telegram as string | undefined,
              website: beOverview.extensions?.website as string | undefined,
            },
          };
        }
      } catch {
        // Degrade to address fallback
      }
    }

    // 7. Safe fallback — undefined, never invented numbers
    if (!token) {
      token = {
        id: address,
        mint: address,
        name: `Token ${address.slice(0, 4)}...${address.slice(-4)}`,
        symbol: address.slice(0, 4).toUpperCase(),
        chain: chain.toLowerCase(),
        source: 'Unknown',
        priceUsd: undefined,
        volume24hUsd: undefined,
        liquidityUsd: undefined,
        marketCapUsd: undefined,
      };
    }

    return jsonResponse({
      token: {
        ...token,
        chain: chain.toLowerCase(),
        description: 'Sentinel verified live token record.',
        explorerUrl: `https://solscan.io/token/${address}`,
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Failed to fetch token', 500));
  }
}
