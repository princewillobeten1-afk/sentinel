function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  API_VERSION: process.env.NEXT_PUBLIC_API_VERSION ?? 'v1',
  BASE_API_PATH: `/api/${process.env.NEXT_PUBLIC_API_VERSION ?? 'v1'}`,
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET ?? '',
  // Devnet-first (real fund movement — see docs/security/threat-model.md's
  // "Wallet transfers" section): an explicit NEXT_PUBLIC_SOLANA_NETWORK=solana:mainnet
  // override is required to point this at real money.
  SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'solana:devnet',
  SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
  // Circle's devnet USDC-equivalent mint. Mainnet USDC is EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.
  USDC_MINT_ADDRESS: process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',

  // Real-time market data streaming (server-only — never read from client code).
  // The API keys are intentionally NOT eagerly validated here; getRequiredEnv()
  // is called at the point the stream actually starts (lib/market/live/stream-manager.ts)
  // so importing `env` elsewhere never throws just because streaming isn't configured yet.
  HELIUS_API_KEY: process.env.HELIUS_API_KEY ?? '',
  BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY ?? '',
  SOLANA_TRACKER_API_KEY: process.env.SOLANA_TRACKER_API_KEY ?? '',
  HELIUS_WS_URL: process.env.HELIUS_WS_URL ?? 'wss://devnet.helius-rpc.com',
  // Mainnet RPC for the parsed-transaction enricher. Separate from
  // NEXT_PUBLIC_SOLANA_RPC_URL, which stays on devnet because wallet transfers
  // are devnet-only — market data is read from mainnet, funds never move there.
  HELIUS_RPC_URL: process.env.HELIUS_RPC_URL ?? '',
  HELIUS_GRPC_URL: process.env.HELIUS_GRPC_URL ?? 'https://laserstream-devnet-ewr.helius-rpc.com',
  HELIUS_GRPC_TOKEN: process.env.HELIUS_GRPC_TOKEN ?? '',
  HELIUS_LASERSTREAM_URL: process.env.HELIUS_LASERSTREAM_URL ?? 'https://laserstream-devnet-ewr.helius-rpc.com',
  // No default. This previously fell back to a hardcoded Redis Cloud URL with
  // its password inline — so an unconfigured deployment silently connected to
  // someone else's instance, using a credential that is in committed git
  // history. Empty means "no Redis", which the client degrades to cleanly.
  REDIS_URL: process.env.REDIS_URL ?? '',
  BIRDEYE_WS_URL: process.env.BIRDEYE_WS_URL ?? 'wss://public-api.birdeye.so/socket/solana',
  MARKET_STREAM_TRACKED_MINTS: process.env.MARKET_STREAM_TRACKED_MINTS ?? '',
  MARKET_STREAM_PROGRAM_IDS: process.env.MARKET_STREAM_PROGRAM_IDS ?? '',

  getRequiredEnv,
};
