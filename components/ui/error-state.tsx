import React from 'react';
import { clsx } from 'clsx';
import { WifiOff, AlertTriangle, Wallet, RefreshCw, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppActions } from '@/lib/store';

export interface NetworkErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function NetworkError({ message = 'Unable to load this data. Please check connection.', onRetry, className }: NetworkErrorProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center p-8 text-center border border-rose-500/30 rounded-xl bg-rose-950/20 text-rose-300 select-none space-y-3', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-900/50 text-rose-400">
        <WifiOff className="h-6 w-6" />
      </div>
      <h4 className="font-bold text-sm text-white">Network Connection Error</h4>
      <p className="text-xs text-rose-300 max-w-sm font-sans">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" size="sm" leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Retry Connection
        </Button>
      )}
    </div>
  );
}

export interface GenericErrorProps {
  message?: string;
  onRefresh?: () => void;
  className?: string;
}

export function GenericError({ message = 'Something went wrong while executing this operation.', onRefresh, className }: GenericErrorProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center p-8 text-center border border-amber-500/30 rounded-xl bg-amber-950/20 text-amber-300 select-none space-y-3', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-900/50 text-amber-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h4 className="font-bold text-sm text-white">Execution Failure</h4>
      <p className="text-xs text-amber-200 max-w-sm font-sans">{message}</p>
      {onRefresh && (
        <Button onClick={onRefresh} variant="secondary" size="sm" leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Refresh Component
        </Button>
      )}
    </div>
  );
}

export interface WalletNotConnectedErrorProps {
  message?: string;
  className?: string;
}

export function WalletNotConnectedError({ message = 'Connect a Solana wallet to continue trading & portfolio tracking.', className }: WalletNotConnectedErrorProps) {
  const { setWalletModalOpen } = useAppActions();

  return (
    <div className={clsx('flex flex-col items-center justify-center p-8 text-center border border-sentinel-700 rounded-xl bg-sentinel-900/80 text-slate-300 select-none space-y-3 shadow-card', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400">
        <Wallet className="h-6 w-6" />
      </div>
      <h4 className="font-bold text-sm text-white">Wallet Connection Required</h4>
      <p className="text-xs text-slate-400 max-w-sm font-sans leading-relaxed">{message}</p>
      <Button onClick={() => setWalletModalOpen(true)} variant="primary" size="sm" leftIcon={<Key className="h-3.5 w-3.5" />}>
        Connect Wallet
      </Button>
    </div>
  );
}
