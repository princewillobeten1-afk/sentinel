'use client';

import React from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Compass, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <AppShell initialView="discover">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-glow">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">404 - Page Not Found</h1>
        <p className="text-sm text-slate-400 max-w-md">
          The token, contract address, or route you are looking for does not exist on Solana or Sentinel.
        </p>
        <div className="pt-2">
          <Link href="/discover">
            <Button variant="buy" size="md" leftIcon={<Compass className="h-4 w-4" />}>
              Back to Discovery Screener
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
