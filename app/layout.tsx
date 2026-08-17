import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
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

export const metadata: Metadata = {
  title: 'Project Sentinel',
  description: 'Solana-first token intelligence, trading terminal, and launchpad foundation.',
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
