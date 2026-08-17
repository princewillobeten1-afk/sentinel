'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from './use-auth-hooks';

export interface WalletBalance {
  address: string;
  network: string;
  sol: number;
  usdc: number;
}

const POLL_INTERVAL_MS = 15_000;

async function fetchBalance(walletId: string, token: string): Promise<WalletBalance> {
  const res = await fetch(`/api/v1/user/wallets/${walletId}/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body?.error?.message ?? 'Failed to load wallet balance');
  }
  return body.data.balance as WalletBalance;
}

/**
 * Polls a wallet's real SOL/USDC balance while `enabled` is true (e.g. a
 * receive/send modal is open) — devnet-first, see
 * docs/security/threat-model.md's "Wallet transfers" section.
 */
export function useWalletBalance(walletId: string | null, enabled: boolean) {
  const { token } = useSession();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !walletId || !token) {
      setBalance(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const result = await fetchBalance(walletId, token);
        if (!cancelled) {
          setBalance(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load balance');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [walletId, enabled, token]);

  return { balance, isLoading, error };
}
