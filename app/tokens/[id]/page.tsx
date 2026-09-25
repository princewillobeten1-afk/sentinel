import { redirect } from 'next/navigation';

/**
 * Legacy `/tokens/[id]` route.
 * Redirects to the canonical terminal page (`/trade/solana/[token]`),
 * which renders the real-time Axiom token strip, live candlestick chart,
 * and live trading engine with zero mock data.
 */
export default async function TokenRedirectPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await params;
  const tokenId = resolvedParams?.id || 'So11111111111111111111111111111111111111112';
  redirect(`/trade/solana/${tokenId}`);
}
