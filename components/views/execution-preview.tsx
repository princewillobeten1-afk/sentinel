'use client';
import { TradingPanel } from '@/components/trading/trading-panel';
import type { ExecutionRequest } from '@/lib/execution/types';
const SOL = 'So11111111111111111111111111111111111111112';
export function ExecutionPreview({ request }: { request: ExecutionRequest }) {
  if (request.chain !== 'solana' || ![request.tokenIn, request.tokenOut].some(mint => mint === SOL))
    return <p role="alert">Use the Solana trade page with exact token mint addresses. This legacy route cannot execute this pair.</p>;
  const buy = request.tokenIn === SOL;
  const mint = buy ? request.tokenOut : request.tokenIn;
  return <TradingPanel tokenSymbol={mint.slice(0, 6)} tokenMint={mint} tokenPriceUsd=""
    initialSide={buy ? 'buy' : 'sell'} initialInputAmount={String(request.amount)} initialSlippage={request.slippageLimit * 100} />;
}
