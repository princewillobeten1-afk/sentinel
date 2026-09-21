'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Search, Zap } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TokenAvatar } from '@/components/ui/token-avatar';
import { TradingPanel } from '@/components/trading/trading-panel';
import { useAppActions, useAppState } from '@/lib/store';
import { formatCompactUsd, formatTokenPrice } from '@/lib/discovery/format';

interface ResolvedToken {
  name: string;
  symbol: string;
  mint: string;
  priceUsd: string;
  marketCapUsd?: string;
  liquidityUsd?: string;
  volume24hUsd?: string;
  priceChange24h?: number;
  holders?: number;
  logoURI?: string;
}

function unwrapToken(body: any): any {
  return body?.data?.token ?? body?.token ?? body?.data ?? body;
}

function asResolved(token: any): ResolvedToken | null {
  const mint = String(token?.mint ?? token?.address ?? '').trim();
  if (!mint) return null;
  return {
    mint,
    name: String(token?.name || `Token ${mint.slice(0, 4)}…${mint.slice(-4)}`),
    symbol: String(token?.symbol || mint.slice(0, 4)).replace(/^\$/, '').toUpperCase(),
    priceUsd: String(token?.priceUsd ?? token?.price ?? ''),
    marketCapUsd: token?.marketCapUsd == null ? undefined : String(token.marketCapUsd),
    liquidityUsd: token?.liquidityUsd == null ? undefined : String(token.liquidityUsd),
    volume24hUsd: token?.volume24hUsd == null ? undefined : String(token.volume24hUsd),
    priceChange24h: Number.isFinite(Number(token?.priceChange24h)) ? Number(token.priceChange24h) : undefined,
    holders: Number.isFinite(Number(token?.holderCount ?? token?.holdersCount))
      ? Number(token.holderCount ?? token.holdersCount)
      : undefined,
    logoURI: token?.logoURI ?? token?.logoUrl,
  };
}

/** Uses the same quote, simulation and wallet-signing flow as the Trade page. */
export function QuickBuyDrawer() {
  const router = useRouter();
  const { isQuickBuyOpen, quickBuyToken } = useAppState();
  const { setQuickBuyOpen, setSelectedToken, setActiveView } = useAppActions();
  const [contractInput, setContractInput] = useState('');
  const [resolvedToken, setResolvedToken] = useState<ResolvedToken | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isQuickBuyOpen) return;
    if (!quickBuyToken) {
      setResolvedToken(null);
      setContractInput('');
      setResolveError(null);
      return;
    }
    setResolvedToken(asResolved({
      ...quickBuyToken,
      priceUsd: quickBuyToken.price,
      marketCapUsd: quickBuyToken.mcap,
      liquidityUsd: quickBuyToken.liquidity,
      volume24hUsd: quickBuyToken.volume24h,
    }));
    setContractInput(quickBuyToken.mint);
    setResolveError(null);
  }, [isQuickBuyOpen, quickBuyToken]);

  const resolveMint = useCallback(async () => {
    const mint = contractInput.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
      setResolveError('Enter a valid Solana contract address.');
      setResolvedToken(null);
      return;
    }
    setIsResolving(true);
    setResolveError(null);
    try {
      const response = await fetch(`/api/v1/tokens/solana/${encodeURIComponent(mint)}`, { credentials: 'include' });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || `Token lookup failed (${response.status})`);
      const token = asResolved(unwrapToken(body));
      if (!token) throw new Error('No token record was returned for that address.');
      setResolvedToken(token);
    } catch (error) {
      setResolvedToken(null);
      setResolveError(error instanceof Error ? error.message : 'Token lookup failed.');
    } finally {
      setIsResolving(false);
    }
  }, [contractInput]);

  const openFullTrade = () => {
    if (!resolvedToken) return;
    setSelectedToken({
      mint: resolvedToken.mint,
      symbol: resolvedToken.symbol,
      name: resolvedToken.name,
      logoUrl: resolvedToken.logoURI,
      priceUsd: resolvedToken.priceUsd,
      marketCapUsd: resolvedToken.marketCapUsd,
      liquidityUsd: resolvedToken.liquidityUsd,
      chain: 'solana',
    });
    setActiveView('trade');
    setQuickBuyOpen(false);
    router.push(`/trade/solana/${resolvedToken.mint}`);
  };

  const initialAmount = quickBuyToken?.customAmountSol;

  return (
    <Drawer
      isOpen={isQuickBuyOpen}
      onClose={() => setQuickBuyOpen(false)}
      title={<span className="flex items-center gap-2 text-slate-100"><Zap className="h-4 w-4 text-emerald-400" /> Quick Buy</span>}
      subtitle="Live quote, preflight simulation, then wallet approval"
      position="right"
      className="max-w-[420px]"
    >
      <div className="space-y-4">
        {!quickBuyToken && (
          <div className="space-y-2">
            <label htmlFor="quick-buy-mint" className="text-2xs font-semibold uppercase tracking-wide text-slate-400">Solana contract address</label>
            <div className="flex gap-2">
              <Input
                id="quick-buy-mint"
                value={contractInput}
                onChange={(event) => setContractInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void resolveMint(); }}
                placeholder="Paste token mint"
                className="min-w-0 font-mono"
              />
              <Button onClick={() => void resolveMint()} isLoading={isResolving} variant="secondary" aria-label="Resolve token">
                <Search className="h-4 w-4" /><span className="sr-only">Resolve token</span>
              </Button>
            </div>
          </div>
        )}

        {resolveError && <div role="alert" className="rounded-md border border-rose-800 bg-rose-950/30 p-3 text-xs text-rose-300">{resolveError}</div>}

        {resolvedToken && (
          <>
            <div className="flex items-start gap-3 border-b border-sentinel-700 pb-3">
              <TokenAvatar src={resolvedToken.logoURI} symbol={resolvedToken.symbol} name={resolvedToken.name} mint={resolvedToken.mint} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-100">{resolvedToken.name}</p>
                <p className="font-mono text-2xs text-slate-400">${resolvedToken.symbol} · {resolvedToken.mint.slice(0, 5)}…{resolvedToken.mint.slice(-5)}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 text-2xs text-slate-400">
                  <span>Price <strong className="text-slate-200">${formatTokenPrice(resolvedToken.priceUsd)}</strong></span>
                  {resolvedToken.liquidityUsd !== undefined && <span>Liq <strong className="text-slate-200">${formatCompactUsd(resolvedToken.liquidityUsd)}</strong></span>}
                  {resolvedToken.marketCapUsd !== undefined && <span>MC <strong className="text-slate-200">${formatCompactUsd(resolvedToken.marketCapUsd)}</strong></span>}
                </div>
              </div>
              <Button onClick={openFullTrade} variant="ghost" size="icon" aria-label="Open full trade page"><ArrowUpRight className="h-4 w-4" /></Button>
            </div>

            {quickBuyToken?.customAmountUsd !== undefined ? (
              <div role="alert" className="rounded-md border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200">
                USD presets cannot be executed by the SOL-funded wallet flow. Switch the Discover preset currency to SOL before requesting a quote.
              </div>
            ) : (
              <TradingPanel
                key={`${resolvedToken.mint}:${initialAmount ?? 'default'}`}
                tokenSymbol={resolvedToken.symbol}
                tokenMint={resolvedToken.mint}
                tokenPriceUsd={resolvedToken.priceUsd}
                initialInputAmount={String(initialAmount ?? 0.5)}
              />
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
