/**
 * Known token logo URLs and avatar resolution helpers for Solana ecosystem tokens.
 */

const KNOWN_LOGOS: Record<string, string> = {
  // Native & Stablecoins
  SOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  WSOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  USDC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  USDT: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',

  // Major Solana Tokens
  BONK: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  JUP: 'https://static.jup.ag/jup/icon.png',
  WIF: 'https://bafkreibk3covs5ltyqxa272uodhculift6nlndfngmx23otcr6x7upvth4.ipfs.nftstorage.link',
  RAY: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  ORCA: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  POPCAT: 'https://bafkreidvkvuzkw46t6qfo4st5urqsl4v3rfn3v4q243qsv5247uomv5lfa.ipfs.nftstorage.link',
  PYTH: 'https://pyth.network/token.svg',
  RENDER: 'https://render.x.io/logo.png',
  BOME: 'https://bafkreibb62s3f6fofq654i6x5iabk6t3y4c6ycfsvf3zwh76d2v4bmsjle.ipfs.nftstorage.link',
  DRIFT: 'https://app.drift.trade/assets/icons/drift.svg',
  PENGU: 'https://bafkreidjfn377g7eqf4k5a42uiv4whr5d263x5xve4i4h5g2m4g6m4x374.ipfs.nftstorage.link',
  MEW: 'https://bafkreihqdtcfcv646p5s7fvg63k327z5vd5vspg6k2w423k5g2m4g6m4x3.ipfs.nftstorage.link',

  // Sentinel Native
  SENT: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2338bdf8"/><stop offset="50%" stop-color="%230ea5e9"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><rect width="100" height="100" rx="24" fill="%230f172a"/><path d="M50 16 L78 30 L78 54 C78 72 50 86 50 86 C50 86 22 72 22 54 L22 30 Z" fill="url(%23g)"/><path d="M50 32 L64 42 L64 54 C64 64 50 72 50 72 C50 72 36 64 36 54 L36 42 Z" fill="%23090d16"/></svg>',
  SENTINEL: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2338bdf8"/><stop offset="50%" stop-color="%230ea5e9"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><rect width="100" height="100" rx="24" fill="%230f172a"/><path d="M50 16 L78 30 L78 54 C78 72 50 86 50 86 C50 86 22 72 22 54 L22 30 Z" fill="url(%23g)"/><path d="M50 32 L64 42 L64 54 C64 64 50 72 50 72 C50 72 36 64 36 54 L36 42 Z" fill="%23090d16"/></svg>',
};

const MINT_LOGOS: Record<string, string> = {
  So11111111111111111111111111111111111111112: KNOWN_LOGOS.SOL,
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: KNOWN_LOGOS.USDC,
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: KNOWN_LOGOS.USDT,
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: KNOWN_LOGOS.BONK,
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: KNOWN_LOGOS.JUP,
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: KNOWN_LOGOS.WIF,
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': KNOWN_LOGOS.RAY,
  orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE: KNOWN_LOGOS.ORCA,
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': KNOWN_LOGOS.POPCAT,
  '7xK99zK8mP2xQ5wN3a19': KNOWN_LOGOS.SENT,
};

const GRADIENT_PALETTES = [
  'from-sky-500 to-blue-600 text-sky-100',
  'from-emerald-500 to-teal-700 text-emerald-100',
  'from-violet-500 to-purple-700 text-purple-100',
  'from-amber-500 to-orange-600 text-amber-100',
  'from-rose-500 to-pink-600 text-rose-100',
  'from-cyan-500 to-blue-600 text-cyan-100',
  'from-fuchsia-500 to-pink-600 text-fuchsia-100',
  'from-indigo-500 to-violet-700 text-indigo-100',
];

/**
 * Routes a third-party image through this origin to avoid CORS/CORP issues.
 */
function proxied(url: string): string {
  if (url.startsWith('/') || url.startsWith('data:')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return url;
  } catch {
    return url;
  }
  return `/api/v1/media/token-icon?url=${encodeURIComponent(url)}`;
}

export function normalizeIpfsUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();

  // ipfs://<cid>
  if (trimmed.startsWith('ipfs://')) {
    const raw = trimmed.replace(/^ipfs:\/\//, '').replace(/^ipfs\//, '');
    return `https://pump.mypinata.cloud/ipfs/${raw}`;
  }

  // <cid>.ipfs.<gateway>
  const subMatch = trimmed.match(/https?:\/\/([a-zA-Z0-9]+)\.ipfs\.[^/]+(\/.*)?/i);
  if (subMatch) {
    const cid = subMatch[1];
    const path = subMatch[2] || '';
    return `https://pump.mypinata.cloud/ipfs/${cid}${path}`;
  }

  // https://<gateway>/ipfs/<cid>
  const pathMatch = trimmed.match(/https?:\/\/[^/]+\/ipfs\/([a-zA-Z0-9]+)(.*)?/i);
  if (pathMatch) {
    const cid = pathMatch[1];
    const rest = pathMatch[2] || '';
    // Rewrite gateways known to rate-limit or 403 public scrapers
    if (
      trimmed.includes('ipfs.io') ||
      trimmed.includes('dweb.link') ||
      trimmed.includes('nftstorage.link') ||
      trimmed.includes('cf-ipfs.com') ||
      trimmed.includes('cloudflare-ipfs.com') ||
      trimmed.includes('w3s.link')
    ) {
      return `https://pump.mypinata.cloud/ipfs/${cid}${rest}`;
    }
  }

  return trimmed;
}

export function resolveTokenLogoCandidates(params: {
  src?: string | null;
  symbol?: string | null;
  mint?: string | null;
}): string[] {
  const { src, symbol, mint } = params;
  const candidates: string[] = [];

  const addCandidate = (url?: string | null) => {
    if (!url || typeof url !== 'string') return;
    const clean = url.trim();
    if (!clean || candidates.includes(clean)) return;
    candidates.push(clean);
  };

  const isPumpToken = Boolean(
    mint && (mint.toLowerCase().endsWith('pump') || (mint.length >= 32 && mint.length <= 44))
  );

  // 1. Primary src if provided
  if (src && typeof src === 'string' && src.trim() !== '') {
    const normalized = normalizeIpfsUrl(src);
    addCandidate(proxied(normalized));

    // If normalized is an IPFS URL, also provide a secondary fast gateway
    const cidMatch = normalized.match(/\/ipfs\/([a-zA-Z0-9]+)/i);
    if (cidMatch) {
      addCandidate(proxied(`https://ipfs.filebase.io/ipfs/${cidMatch[1]}`));
    }

    if (normalized !== src.trim()) {
      addCandidate(proxied(src.trim()));
    }
  }

  // 2. Known mint mapping (SOL, USDC, BONK, etc.)
  if (mint && MINT_LOGOS[mint]) {
    addCandidate(proxied(MINT_LOGOS[mint]));
  }

  // 3. Pump.fun coin image CDN if pump token or Solana mint
  if (mint && isPumpToken) {
    addCandidate(proxied(`https://images.pump.fun/coin-image/${mint}?variant=80x80`));
    addCandidate(`https://images.pump.fun/coin-image/${mint}?variant=80x80`);
    addCandidate(proxied(`https://cdn.dexscreener.com/token-images/og/solana/${mint}`));
  }

  // 4. Known symbol logo (BONK, JUP, WIF, etc.)
  if (symbol) {
    const cleanSym = symbol.replace(/^\$/, '').toUpperCase();
    if (KNOWN_LOGOS[cleanSym]) {
      addCandidate(proxied(KNOWN_LOGOS[cleanSym]));
    }
  }

  // 5. Direct unproxied src fallback (for browsers that can load directly)
  if (src && typeof src === 'string' && src.trim().startsWith('http')) {
    addCandidate(normalizeIpfsUrl(src));
  }

  return candidates;
}

export function resolveTokenLogoUrl(params: {
  src?: string | null;
  symbol?: string | null;
  mint?: string | null;
}): string | null {
  const candidates = resolveTokenLogoCandidates(params);
  return candidates[0] || null;
}

/**
 * Generates a consistent, attractive gradient background class for a token.
 */
export function getTokenGradient(seed?: string): string {
  if (!seed) return GRADIENT_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[index];
}
