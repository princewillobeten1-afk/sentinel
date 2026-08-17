/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    // Runs instrumentation.ts's register() once on server boot, so the
    // Birdeye/Helius market data streams start without needing an inbound
    // HTTP request (lib/market/live/stream-manager.ts).
    instrumentationHook: true,
    // `ws` resolves an optional native buffer-masking addon at require time;
    // letting webpack bundle it for the RSC server graph breaks that
    // resolution ("bufferUtil.mask is not a function"). Marking it external
    // makes Next hand off to Node's own require() instead, which resolves
    // ws's pure-JS fallback correctly.
    // `ioredis` is Node-only CJS with dynamic requires; bundling it into the
    // RSC server graph produced "Cannot read properties of undefined (reading
    // 'call')" the moment the event bus imported it, which took down the
    // WebSocket bootstrap route. Same treatment as `ws` above.
    serverComponentsExternalPackages: ['ws', 'ioredis'],
  },
  async headers() {
    // Sprint 30 — Tier 6. A first pass, not final: `'unsafe-inline'` on
    // script-src is a known real weakening (Next.js 14's dev-mode inline
    // bootstrap/HMR scripts and React's error overlay need it without a
    // nonce wired through a custom _document) — tightening that via nonces
    // is a documented follow-up, not silently treated as airtight today.
    // connect-src allowlists the external hosts this app's server (and
    // possibly wallet-adapter code) talks to, plus `wss:` for this app's
    // own /ws WebSocket server (lib/ws/server.ts).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' wss: https: https://api.mainnet-beta.solana.com https://api.devnet.solana.com https://public-api.birdeye.so https://mainnet.helius-rpc.com https://devnet.helius-rpc.com https://laserstream-devnet-ewr.helius-rpc.com wss://mainnet.helius-rpc.com wss://devnet.helius-rpc.com wss://public-api.birdeye.so",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
