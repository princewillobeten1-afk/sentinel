'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { TradeView } from '@/components/views/trade-view';

/**
 * Dynamic Token Trading Page (`/trade/[chain]/[token]`)
 * Renders the terminal workspace and Axiom-style live token strip header.
 */
export default function DynamicTokenPage() {
  const params = useParams();
  const chain = (params?.chain as string) || 'solana';
  const tokenMint = (params?.token as string) || '';

  return (
    <AppShell initialView="trade">
      <TradeView tokenMint={tokenMint} chain={chain} />
    </AppShell>
  );
}
