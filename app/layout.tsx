import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './terminal.css';
import { Providers } from './providers';

/**
 * Two faces, each with a job.
 *
 * Inter carries the UI: it was already loaded but referenced exactly once,
 * while Outfit — a geometric display face — did the work. Outfit's rounded,
 * wide forms read friendly rather than institutional, and it has no true
 * tabular figures, which matters in a product that is mostly numbers.
 *
 * JetBrains Mono replaces the system monospace stack for data. It has genuine
 * tabular figures and a slashed zero, so columns of prices align and 0/O never
 * ambiguate — the reason terminals have used monospace for decades.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
    default: 'Project Sentinel · Solana Intelligence & Trading Terminal',
    template: '%s · Project Sentinel',
  },
  description:
    'Institutional-grade Solana token discovery screener, Cabal Radar™ insider tracking, deep liquidity telemetry, and execution terminal.',
  applicationName: 'Project Sentinel',
  keywords: [
    'Solana',
    'Trading Terminal',
    'Token Intelligence',
    'Cabal Radar',
    'Solana Screener',
    'Pump.fun',
    'Raydium',
    'Jupiter Swap',
    'Crypto Security',
  ],
  authors: [{ name: 'Project Sentinel Team' }],
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: appUrl,
    siteName: 'Project Sentinel',
    title: 'Project Sentinel · Solana Intelligence & Trading Terminal',
    description:
      'Institutional-grade Solana token discovery screener, Cabal Radar™ insider tracking, and execution terminal.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Sentinel · Solana Intelligence & Trading Terminal',
    description:
      'Institutional-grade Solana token discovery screener, Cabal Radar™ insider tracking, and execution terminal.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased text-slate-100 bg-sentinel-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
