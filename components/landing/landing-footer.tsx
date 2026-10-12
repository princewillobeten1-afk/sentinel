'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, Terminal, Activity, Shield, ArrowUpRight } from 'lucide-react';

export function LandingFooter() {
  return (
    <footer className="border-t border-neutral-750 bg-neutral-950 px-6 py-12 pb-24 text-xs font-mono text-neutral-400 relative z-20">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/20 text-accent-400 border border-accent-500/30">
                <Zap className="h-4 w-4" />
              </div>
              <span className="font-heading text-base font-black text-white tracking-wider">PROJECT SENTINEL</span>
            </Link>

            <p className="text-2xs text-neutral-400 leading-relaxed max-w-sm font-sans">
              Solana Market Integrity & Decision Intelligence Operating System. Dissecting holder clusters, decomposing wash volume, and executing low-latency trades with non-custodial session keys.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <span className="h-2 w-2 rounded-full bg-buy-500 animate-pulse" />
              <span className="text-3xs text-neutral-300 font-bold">ALL SYSTEMS OPERATIONAL</span>
              <span className="text-neutral-600">•</span>
              <span className="text-3xs text-neutral-500">v2.4.1 (Mainnet-Beta)</span>
            </div>
          </div>

          {/* Navigation Columns */}
          <div className="space-y-3">
            <p className="text-2xs uppercase font-bold text-white tracking-wider">Terminal & Tools</p>
            <ul className="space-y-2 text-2xs">
              <li>
                <Link href="/trade" className="hover:text-white transition-colors flex items-center gap-1">
                  Pro Trade Terminal <ArrowUpRight className="h-3 w-3 text-neutral-500" />
                </Link>
              </li>
              <li>
                <Link href="/discover" className="hover:text-white transition-colors flex items-center gap-1">
                  Market Screener <ArrowUpRight className="h-3 w-3 text-neutral-500" />
                </Link>
              </li>
              <li>
                <Link href="/ai" className="hover:text-white transition-colors flex items-center gap-1">
                  Sentinel AI Copilot <ArrowUpRight className="h-3 w-3 text-neutral-500" />
                </Link>
              </li>
              <li>
                <Link href="/portfolio" className="hover:text-white transition-colors">
                  Portfolio Tracker
                </Link>
              </li>
              <li>
                <Link href="/wallet-tracker" className="hover:text-white transition-colors">
                  Smart Money Radar
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-2xs uppercase font-bold text-white tracking-wider">Intelligence</p>
            <ul className="space-y-2 text-2xs">
              <li>
                <Link href="/trends" className="hover:text-white transition-colors flex items-center gap-1 text-warn-300">
                  Meme Trends Radar <ArrowUpRight className="h-3 w-3 text-warn-400" />
                </Link>
              </li>
              <li>
                <Link href="/discover" className="hover:text-white transition-colors">
                  Cluster Graph Resolver
                </Link>
              </li>
              <li>
                <Link href="/discover" className="hover:text-white transition-colors">
                  Wash Volume Decomposition
                </Link>
              </li>
              <li>
                <Link href="/discover" className="hover:text-white transition-colors">
                  Simulated Exit Depth
                </Link>
              </li>
              <li>
                <Link href="/portfolio/risk" className="hover:text-white transition-colors">
                  Risk Circuit Breakers
                </Link>
              </li>
              <li>
                <Link href="/launchpad" className="hover:text-white transition-colors">
                  Fair Launchpad
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-2xs uppercase font-bold text-white tracking-wider">Resources</p>
            <ul className="space-y-2 text-2xs">
              <li>
                <Link href="/help" className="hover:text-white transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/developers" className="hover:text-white transition-colors">
                  API & Webhooks
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-white transition-colors">
                  Terminal Preferences
                </Link>
              </li>
              <li>
                <Link href="/settings/security" className="hover:text-white transition-colors">
                  Session Keys Security
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer & Copyright */}
        <div className="pt-8 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-3xs text-neutral-500">
          <div>
            <p>© 2026 Project Sentinel. Built for serious on-chain traders on Solana.</p>
            <p className="mt-0.5">Non-custodial trading software. Not financial advice. Trade responsibly.</p>
          </div>

          <div className="flex items-center gap-4 text-neutral-400">
            <Link href="/help" className="hover:text-white transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link href="/help" className="hover:text-white transition-colors">Terms of Service</Link>
            <span>•</span>
            <Link href="/help" className="hover:text-white transition-colors">Security Disclosures</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
