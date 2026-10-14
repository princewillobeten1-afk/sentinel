'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, ShieldCheck } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'How does Sentinel detect hidden holder funding clusters?',
    answer:
      'Rather than analyzing token balances in isolation, Sentinel traces the funding roots of top holders backwards across multiple transaction hops. We identify when multiple "independent" wallets were originally funded with SOL from the same centralized exchange deposit address, intermediary mixer, or dispenser wallet within a narrow time window. When 15 wallets controlling 35% of supply share a common progenitor, Sentinel flags it as a coordinated cabal.',
  },
  {
    question: 'How does wash-trading volume decomposition work?',
    answer:
      'Many newly launched Solana tokens deploy automated market-making scripts that trade back and forth between two or three creator-controlled addresses to generate artificial volume and trend on aggregators. Sentinel uses machine-learning heuristics to decompose volume into unique organic buyer inflow versus closed-loop cyclic trades. We report true net capital flow and true organic volume.',
  },
  {
    question: 'Are Sentinel session keys safe and non-custodial?',
    answer:
      'Yes, 100% non-custodial. Session keys are ephemeral keypairs generated locally in your browser and encrypted with local storage credentials. They have restricted permissions—they can only submit swap transactions to verified DEX contracts and cannot transfer SOL to external addresses or approve malicious token permits. You can revoke or wipe them with one click at any second.',
  },
  {
    question: 'How does Jito MEV bundle protection eliminate sandwich attacks?',
    answer:
      'Standard public RPC transactions are broadcast to public validators where predatory searchers can see your trade in the mempool and execute a front-run buy followed by a back-run sell (a sandwich attack), leaving you with maximum slippage. Sentinel routes your swaps through private Jito validator bundles that are submitted directly into blocks without public exposure, ensuring 0% sandwich slippage.',
  },
  {
    question: 'Which Solana DEX liquidity pools does Sentinel support?',
    answer:
      'Sentinel natively routes across Raydium CPMM, Raydium Concentrated Liquidity (CLMM), Meteora Dynamic AMM (DLMM), Orca Whirlpools, and Pump.fun bonding curves. Our routing engine can also split a single execution across multiple venues simultaneously to minimize price impact.',
  },
  {
    question: 'Can I use Sentinel on mobile devices?',
    answer:
      'Yes. Sentinel is built with a responsive progressive layout that adapts high-density desktop trading views into mobile-optimized execution cards and radar views accessible through standard mobile Web3 browsers like Phantom or Solflare.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 font-mono">
      <div className="text-center space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
          FREQUENTLY ASKED QUESTIONS // TECHNICAL FAQ
        </span>
        <h3 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
          Everything You Need to Know
        </h3>
        <p className="text-xs sm:text-sm text-neutral-400 font-sans">
          Clear answers about Sentinel&apos;s forensic intelligence engine, security, and execution infrastructure.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;

          return (
            <div
              key={idx}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'border-emerald-500/40 bg-[#0A0B10] shadow-[0_0_20px_rgba(16,185,129,0.15),inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                  : 'border-white/[0.08] bg-[#0A0B10]/60 hover:border-white/[0.15]'
              }`}
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full py-4 px-6 flex items-center justify-between text-left gap-4 cursor-pointer"
              >
                <span className="text-sm font-bold text-neutral-100 flex items-center gap-3">
                  <span className="text-emerald-400 font-mono text-xs">0{idx + 1}.</span>
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-neutral-400 transition-transform duration-200 flex-shrink-0 ${
                    isOpen ? 'rotate-180 text-emerald-400' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="px-6 pb-5 pt-1 text-xs text-neutral-300 font-sans leading-relaxed border-t border-white/[0.06]">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
