'use client';

import React, { useEffect } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled App Router error:', error);
  }, [error]);

  return (
    <AppShell initialView="discover">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(255,59,105,0.3)]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Application Error</h1>
        <p className="text-sm text-slate-400 max-w-md">
          {error.message || 'An unexpected error occurred while loading this interface.'}
        </p>
        <div className="pt-2 flex items-center gap-3">
          <Button onClick={() => reset()} variant="buy" size="md" leftIcon={<RefreshCw className="h-4 w-4" />}>
            Try Again
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
