import 'server-only';

import { TOKEN_DATABASE } from '@/lib/token/search-service';

/**
 * Resolves a token symbol (e.g. "SOL", "$BONK") to a real mint address for
 * REST calls, falling back to treating the input as an already-a-mint value
 * when no symbol match is found — so callers can pass either.
 *
 * Note: `lib/token/search-service.ts`'s `TOKEN_DATABASE` mixes real mints
 * (SOL, BONK) with fabricated placeholder mints for this app's demo tokens
 * (SENT, QUANT). Resolving one of those returns the fabricated string as-is;
 * Birdeye will simply return no data for it, which callers surface as
 * `freshness: 'unavailable'` rather than crashing.
 */
export function resolveMint(symbolOrMint: string): string {
  const normalized = symbolOrMint.trim().replace(/^\$/, '').toUpperCase();
  const match = TOKEN_DATABASE.find((token) => token.symbol.toUpperCase() === normalized);
  return match?.mint ?? symbolOrMint.trim();
}
