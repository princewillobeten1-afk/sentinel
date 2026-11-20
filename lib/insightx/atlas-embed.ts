import type { InsightXNetwork } from './types';

const SCANNER_SUPPORTED_NETWORKS = new Set<string>(['sol', 'eth', 'base', 'bsc', 'sui']);

/**
 * Maps internal/route chain identifiers to InsightX Network IDs.
 */
export function toInsightXNetwork(chain?: string | null): InsightXNetwork {
  const normalized = (chain ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'solana' || normalized === 'sol') return 'sol';
  if (
    normalized === 'robinhood' ||
    normalized === 'robinhood-testnet' ||
    normalized === 'robinhood_testnet' ||
    normalized === '4663' ||
    normalized === '46630'
  ) {
    return 'robinhood';
  }
  if (normalized === 'eth' || normalized === 'ethereum' || normalized === '1') return 'eth';
  if (normalized === 'base' || normalized === '8453') return 'base';
  if (normalized === 'bsc' || normalized === 'bnb' || normalized === '56') return 'bsc';
  if (normalized === 'arb' || normalized === 'arbitrum' || normalized === '42161') return 'arb';
  if (normalized === 'op' || normalized === 'optimism' || normalized === '10') return 'op';
  if (normalized === 'matic' || normalized === 'polygon' || normalized === '137') return 'matic';
  if (normalized === 'sui') return 'sui';
  return normalized;
}

export function isInsightXScannerSupported(chain?: string | null): boolean {
  return SCANNER_SUPPORTED_NETWORKS.has(toInsightXNetwork(chain));
}

/**
 * Sniper, bundler, insider, and dev-flow analytics in InsightX DEX Metrics
 * are currently active for Solana (`sol`); Robinhood returns overview
 * `cluster_pct` and `top10_pct` plus distribution, clusters, and labels.
 */
export function isInsightXSolanaMetricsSupported(chain?: string | null): boolean {
  return toInsightXNetwork(chain) === 'sol';
}

/**
 * Builds the InsightX Atlas Live `<iframe>` URL.
 * Works on `localhost`/`127.0.0.1` without an `embed_id`, and includes
 * `embed_id` in production when `NEXT_PUBLIC_INSIGHTX_EMBED_ID` is configured.
 */
export function getInsightXAtlasEmbedUrl(
  chain: string,
  address: string,
  options?: {
    embedId?: string | null;
    preview?: boolean;
  },
): string | null {
  const cleanAddress = address.trim();
  if (!cleanAddress) return null;

  const network = toInsightXNetwork(chain);
  const url = new URL(
    `https://embed.insightx.network/atlas/${encodeURIComponent(network)}/${encodeURIComponent(cleanAddress)}`,
  );

  const embedId = (options?.embedId ?? process.env.NEXT_PUBLIC_INSIGHTX_EMBED_ID ?? '').trim();
  if (embedId) {
    url.searchParams.set('embed_id', embedId);
  }
  if (options?.preview) {
    url.searchParams.set('preview', 'true');
  }

  return url.toString();
}
