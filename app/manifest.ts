import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Project Sentinel · Solana Intelligence & Trading Terminal',
    short_name: 'Sentinel',
    description: 'Solana token screener, Cabal Radar™ wallet tracking, deep liquidity intelligence, and execution terminal.',
    start_url: '/discover',
    display: 'standalone',
    background_color: '#030712',
    theme_color: '#030712',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
