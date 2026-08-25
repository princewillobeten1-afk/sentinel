import { jsonResponse, errorResponse } from '@/lib/server/api';
import { ApiError } from '@/lib/server/errors';
import { fetchLiveSolanaTokens } from '@/lib/discovery/live-solana-feed';
import { searchTokens as searchStaticTokens } from '@/lib/token/search-service';

export const dynamic = 'force-dynamic';

interface DexSearchPair {
  chainId: string;
  dexId: string;
  url?: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd?: string;
  priceNative?: string;
  priceChange?: {
    h24?: number;
  };
  volume?: {
    h24?: number;
  };
  liquidity?: {
    usd?: number;
  };
  fdv?: number;
  marketCap?: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ label?: string; url: string }>;
    socials?: Array<{ type?: string; url: string }>;
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 25;

    if (!q) {
      // Return top trending tokens when query is empty
      const liveTokens = await fetchLiveSolanaTokens();
      const items = liveTokens.slice(0, limit).map((t) => ({
        id: t.mint,
        name: t.name,
        symbol: t.symbol,
        mint: t.mint,
        chain: t.chain || 'solana',
        source: t.source || 'Solana DEX',
        logoUrl: t.logoURI,
        logoURI: t.logoURI,
        priceUsd: t.priceUsd,
        priceChange24h: t.priceChange24h || 0,
        marketCapUsd: t.marketCapUsd,
        liquidityUsd: t.liquidityUsd,
        volume24hUsd: t.volume24hUsd,
        riskRating: t.riskTier === 'low' ? 'low' : t.riskTier === 'high' ? 'high' : 'med',
        twitterUrl: t.twitterUrl,
        telegramUrl: t.telegramUrl,
        websiteUrl: t.websiteUrl,
      }));

      return jsonResponse({
        query: '',
        items,
        totalCount: items.length,
      });
    }

    const cleanQ = q.toLowerCase().replace(/^\$/, '');
    const isAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);

    const resultsMap = new Map<string, any>();

    // 1. Search in local live discovered tokens cache
    try {
      const liveTokens = await fetchLiveSolanaTokens();
      for (const t of liveTokens) {
        const matches =
          t.name.toLowerCase().includes(cleanQ) ||
          t.symbol.toLowerCase().includes(cleanQ) ||
          t.mint.toLowerCase().includes(cleanQ);

        if (matches) {
          resultsMap.set(t.mint, {
            id: t.mint,
            name: t.name,
            symbol: t.symbol,
            mint: t.mint,
            chain: t.chain || 'solana',
            source: t.source || 'Solana DEX',
            logoUrl: t.logoURI,
            logoURI: t.logoURI,
            priceUsd: t.priceUsd,
            priceChange24h: t.priceChange24h || 0,
            marketCapUsd: t.marketCapUsd,
            liquidityUsd: t.liquidityUsd,
            volume24hUsd: t.volume24hUsd,
            riskRating: t.riskTier === 'low' ? 'low' : 'med',
            twitterUrl: t.twitterUrl,
            telegramUrl: t.telegramUrl,
            websiteUrl: t.websiteUrl,
          });
        }
      }
    } catch {
      // Continue to next search layer
    }

    // 2. Query DexScreener search API for live on-chain Solana tokens & pairs
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
        cache: 'no-store',
      });
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        if (Array.isArray(dexData.pairs)) {
          const solPairs: DexSearchPair[] = dexData.pairs.filter((p: DexSearchPair) => p.chainId === 'solana');
          for (const pair of solPairs) {
            const addr = pair.baseToken?.address;
            if (!addr || resultsMap.has(addr)) continue;

            const isPump = pair.dexId?.includes('pump') || addr.toLowerCase().endsWith('pump');
            const price = pair.priceUsd || (pair.priceNative ? (parseFloat(pair.priceNative) * 180).toFixed(8) : '0.0001');
            const mcap = pair.marketCap || pair.fdv || (parseFloat(price) * 1000000000);
            const liq = pair.liquidity?.usd || (isPump ? Math.min(65000, mcap * 0.25) : 15000);

            resultsMap.set(addr, {
              id: addr,
              name: pair.baseToken.name || `Token ${addr.slice(0, 4)}`,
              symbol: pair.baseToken.symbol || addr.slice(0, 4).toUpperCase(),
              mint: addr,
              chain: 'solana',
              source: isPump ? 'Pump.fun' : 'Raydium',
              logoUrl: pair.info?.imageUrl || `https://cdn.dexscreener.com/token-images/og/solana/${addr}`,
              logoURI: pair.info?.imageUrl || `https://cdn.dexscreener.com/token-images/og/solana/${addr}`,
              priceUsd: String(price),
              priceChange24h: pair.priceChange?.h24 || 0,
              marketCapUsd: String(mcap),
              liquidityUsd: String(liq),
              volume24hUsd: String(pair.volume?.h24 || 5000),
              riskRating: isPump ? 'low' : 'med',
              twitterUrl: pair.info?.socials?.find((s) => s.type === 'twitter')?.url,
              telegramUrl: pair.info?.socials?.find((s) => s.type === 'telegram')?.url,
              websiteUrl: pair.info?.websites?.[0]?.url,
            });
          }
        }
      }
    } catch {
      // Continue
    }

    // 3. Check static token database fallback
    const staticMatches = searchStaticTokens(q);
    for (const st of staticMatches) {
      if (!resultsMap.has(st.mint)) {
        resultsMap.set(st.mint, {
          id: st.mint,
          name: st.name,
          symbol: st.symbol,
          mint: st.mint,
          chain: st.chain || 'solana',
          source: 'Solana',
          logoUrl: (st as any).logoUrl || (st as any).logoURI,
          logoURI: (st as any).logoUrl || (st as any).logoURI,
          priceUsd: st.priceUsd,
          priceChange24h: st.priceChange24h,
          marketCapUsd: st.marketCapUsd,
          liquidityUsd: st.liquidityUsd,
          riskRating: st.riskRating,
        });
      }
    }

    const items = Array.from(resultsMap.values()).slice(0, limit);

    return jsonResponse({
      query: q,
      items,
      totalCount: items.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error : new ApiError('Search failed', 500));
  }
}
