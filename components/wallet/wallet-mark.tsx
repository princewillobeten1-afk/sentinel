'use client';

import React, { useEffect, useState } from 'react';
import { getWalletIcons } from '@/lib/wallet/wallet-icons';
import type { WalletProviderId } from '@/lib/wallet/types';

/**
 * A wallet's brand mark.
 *
 * Renders the wallet's own logo, sourced from the Wallet Standard registry or
 * the adapter package. When neither has one, it falls back to a lettermark on
 * the app's own surface — deliberately neutral, so it reads as "no logo
 * available" rather than as a logo we invented for someone else's brand.
 *
 * Resolved in an effect, not during render: the Wallet Standard registry lives
 * on `window` and is populated by extensions after page load, so reading it
 * server-side or on first paint returns nothing.
 */
export function WalletMark({
  id,
  name,
  size = 32,
  muted = false,
  className = '',
}: {
  id: WalletProviderId;
  name: string;
  size?: number;
  /** Dim the mark — used for wallets that are not installed. */
  muted?: boolean;
  className?: string;
}) {
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    setIcon(getWalletIcons()[id] ?? null);

    // Extensions can register after mount; re-read once they announce.
    const onRegister = () => setIcon(getWalletIcons()[id] ?? null);
    window.addEventListener('wallet-standard:register-wallet', onRegister);
    const settle = setTimeout(onRegister, 600);
    return () => {
      window.removeEventListener('wallet-standard:register-wallet', onRegister);
      clearTimeout(settle);
    };
  }, [id]);

  const box = { width: size, height: size };

  if (icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed
      <img
        src={icon}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={box}
        className={`shrink-0 rounded-lg object-contain ${muted ? 'opacity-60 saturate-50' : ''} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={box}
      className={`shrink-0 rounded-lg border border-sentinel-700 bg-sentinel-800 grid place-items-center font-numeric font-bold text-slate-400 ${
        muted ? 'opacity-60' : ''
      } ${className}`}
    >
      <span style={{ fontSize: Math.round(size * 0.4) }}>{name.slice(0, 1).toUpperCase()}</span>
    </span>
  );
}
