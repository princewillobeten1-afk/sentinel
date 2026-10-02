export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { INITIAL_LIVE_TRADES, TrackedWalletTrade } from '@/lib/wallet-tracker/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Keep base sample events and inject fresh timestamps so trades look recent
    const now = Date.now();
    const liveTrades: TrackedWalletTrade[] = INITIAL_LIVE_TRADES.map((trade, i) => ({
      ...trade,
      timestamp: new Date(now - (i * 180 + 30) * 1000).toISOString(),
    }));

    // Add recent simulated ticks if requested
    const sampleTokens = [
      { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', price: 0.0000248, logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cDc7I' },
      { symbol: 'SENT', name: 'Project Sentinel', mint: '77wvPgk8otNJNsXbCs7nERU8fxh4sgGeouzEVP5Zpump', price: 0.042, logo: '/icons/sentinel.png' },
      { symbol: 'WIF', name: 'dogwifhat', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', price: 2.14, logo: 'https://bafkreibk3covs5ltyqxa272uodhculbx6uh3h52cwopx6rh2i33rq55iaa.ipfs.nftstorage.link' },
      { symbol: 'POPCAT', name: 'Popcat', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', price: 1.28, logo: 'https://bafkreidvkvuzw64e262j6u45e6m32h24i4sqquu65t4v4kexnfdx5u2p47m53m.ipfs.nftstorage.link' },
    ];

    const extendedTrades: TrackedWalletTrade[] = [...liveTrades];
    for (let j = 0; j < Math.min(limit - liveTrades.length, 6); j++) {
      const tok = sampleTokens[j % sampleTokens.length];
      const solAmt = Math.round((5 + j * 4.2) * 10) / 10;
      extendedTrades.push({
        id: `dyn_tr_${j}`,
        walletAddress: j % 2 === 0 ? '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1' : '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        walletLabel: j % 2 === 0 ? 'Raydium Alpha Trench Sniper' : 'Whale Multi-Pool Accumulator',
        walletCategory: j % 2 === 0 ? 'SMART_MONEY' : 'WHALE',
        action: j % 3 === 0 ? 'SELL' : 'BUY',
        tokenMint: tok.mint,
        tokenSymbol: tok.symbol,
        tokenName: tok.name,
        tokenLogo: tok.logo,
        amountSol: solAmt,
        valueUsd: Math.round(solAmt * 152),
        priceUsd: tok.price,
        timestamp: new Date(now - (j * 400 + 600) * 1000).toISOString(),
        txHash: `${Math.random().toString(36).slice(2, 8)}...${Math.random().toString(36).slice(2, 6)}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: extendedTrades.slice(0, limit),
      count: extendedTrades.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch live tracked trades' },
      { status: 500 }
    );
  }
}
