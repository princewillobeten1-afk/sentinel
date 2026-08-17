/**
 * Curated subscription targets for the live market data streams.
 *
 * Deliberately NOT sourced from `lib/token/search-service.ts`'s `TOKEN_DATABASE`
 * or `lib/discovery/service.ts`'s mock token list — both contain fabricated
 * strings that are not valid base58 Solana mint addresses (e.g. a 20-character
 * placeholder), so subscribing Birdeye/Helius to them would simply produce no
 * data. This is a small, curated list of real mainnet mints instead.
 *
 * v2 should source this from a server-persisted watchlist. Today's watchlist
 * (`lib/store/watchlist-store.tsx`) is `localStorage`-only with no server
 * representation, so that isn't available yet — documented limitation, not
 * addressed in this pass.
 */

const DEFAULT_TRACKED_MINTS = [
  'So11111111111111111111111111111111111111112', // Wrapped SOL
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
];

/**
 * Well-known Solana DEX program IDs. Verify against current mainnet
 * deployments before relying on this in production — program upgrades or
 * new AMM versions can shift these over time.
 */
const DEFAULT_TRACKED_PROGRAM_IDS: Record<string, string> = {
  raydium_amm_v4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  orca_whirlpool: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  pumpfun: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
};

/**
 * Parses a comma-separated mint list from env, falling back to the curated
 * default when unset or empty.
 */
export function resolveTrackedMints(envValue: string): string[] {
  const trimmed = envValue.trim();
  if (!trimmed) return DEFAULT_TRACKED_MINTS;

  const parsed = trimmed
    .split(',')
    .map((mint) => mint.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_TRACKED_MINTS;
}

/**
 * Parses a comma-separated `label:programId` list from env, falling back to
 * the curated default when unset or empty.
 */
export function resolveTrackedProgramIds(envValue: string): Record<string, string> {
  const trimmed = envValue.trim();
  if (!trimmed) return DEFAULT_TRACKED_PROGRAM_IDS;

  const entries = trimmed
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => pair.split(':').map((part) => part.trim()))
    .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[0]) && Boolean(parts[1]));

  if (entries.length === 0) return DEFAULT_TRACKED_PROGRAM_IDS;

  return Object.fromEntries(entries);
}

export { DEFAULT_TRACKED_MINTS, DEFAULT_TRACKED_PROGRAM_IDS };
