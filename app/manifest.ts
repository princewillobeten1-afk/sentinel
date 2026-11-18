import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Phivex · Solana Intelligence & Trading Terminal',
    short_name: 'Phivex',
    description: 'Solana token screener, Cabal Radar™ wallet tracking, deep liquidity intelligence, and execution terminal.',
    start_url: '/discover',
    display: 'standalone',
    background_color: '#030712',
    theme_color: '#030712',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
