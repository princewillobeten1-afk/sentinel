export interface NormalizedSearchResult {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  chain: string;
  priceUsd: string;
  priceChange24h: number;
  marketCapUsd: string;
  liquidityUsd: string;
  riskRating: 'low' | 'med' | 'high' | 'critical';
}

export const TOKEN_DATABASE: NormalizedSearchResult[] = [
  {
    id: 't_sentinel',
    name: 'Solana Sentinel Token',
    symbol: 'SENT',
    mint: '7xK99zK8mP2xQ5wN3a19',
    chain: 'solana',
    priceUsd: '3.4500',
    priceChange24h: 18.50,
    marketCapUsd: '$345.0M',
    liquidityUsd: '$18.5M',
    riskRating: 'low',
  },
  {
    id: 't_solana',
    name: 'Solana Native',
    symbol: 'SOL',
    mint: 'So11111111111111111111111111111111111111112',
    chain: 'solana',
    priceUsd: '142.5000',
    priceChange24h: 4.20,
    marketCapUsd: '$66.5B',
    liquidityUsd: '$125.0M',
    riskRating: 'low',
  },
  {
    id: 't_bonk',
    name: 'Bonk Doge Token',
    symbol: 'BONK',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    chain: 'solana',
    priceUsd: '0.00002845',
    priceChange24h: 12.40,
    marketCapUsd: '$1.84B',
    liquidityUsd: '$24.1M',
    riskRating: 'med',
  },
  {
    id: 't_quantum',
    name: 'Cyber Quantum',
    symbol: 'QUANT',
    mint: '3mR8z9K2xP5wN1a84mP2xQ5wN3a19TestMint',
    chain: 'solana',
    priceUsd: '0.0412',
    priceChange24h: -14.20,
    marketCapUsd: '$840.0K',
    liquidityUsd: '$120.0K',
    riskRating: 'critical',
  },
];

/**
 * Searches normalized token database by name, symbol, or mint address.
 */
export function searchTokens(query: string): NormalizedSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return TOKEN_DATABASE;

  return TOKEN_DATABASE.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.mint.toLowerCase().includes(q) ||
      `$${t.symbol.toLowerCase()}`.includes(q)
  );
}

export function getTokenByMint(mint: string): NormalizedSearchResult | undefined {
  return TOKEN_DATABASE.find((t) => t.mint.toLowerCase() === mint.toLowerCase()) || TOKEN_DATABASE[0];
}
