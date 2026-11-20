import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import './terminal.css';
import { Providers } from './providers';

/**
 * Typefaces:
 * - Space Grotesk: Distinctive, geometric neo-grotesque display face for headlines.
 * - Inter: Clean, institutional, high-legibility UI and body copy.
 * - JetBrains Mono: Quantitative data, code, and terminal feeds with tabular figures.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sentinel-mu-jade.vercel.app';

export const viewport: Viewport = {
  themeColor: '#030712',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Phivex · Solana Intelligence & Trading Terminal',
    template: '%s · Phivex',
  },
  description:
    'Institutional-grade Solana token discovery screener, Cabal Radar™ insider tracking, deep liquidity telemetry, and execution terminal.',
  applicationName: 'Phivex',
  keywords: [
    'Solana',
    'Trading Terminal',
    'Token Intelligence',
    'Cabal Radar',
    'Solana Screener',
    'Pump.fun',
    'Raydium',
    'Solana DEX Swaps',
    'Crypto Security',
  ],
  authors: [{ name: 'Phivex Team' }],
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: appUrl,
    siteName: 'Phivex',
    title: 'Phivex · Solana Intelligence & Trading Terminal',
    description:
      'Institutional-grade Solana token discovery screener, Cabal Radar™ insider tracking, and execution terminal.',
    images: [{ url: '/brand/phivex-og.png', width: 1024, height: 1024, alt: 'PHIVEX — Intelligence First' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phivex · Solana Intelligence & Trading Terminal',
    description:
      'Institutional-grade Solana token discovery screener, Cabal Radar™ insider tracking, and execution terminal.',
    images: ['/brand/phivex-og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased text-slate-100 bg-sentinel-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
