'use client';

import React, { useState } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { WalletConnectModal } from '@/components/auth/wallet-connect-modal';

export default function LoginPage() {
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow styling */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <LoginForm onWalletConnectRequest={() => setWalletModalOpen(true)} />
      </div>

      <WalletConnectModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onSuccess={() => {
          setWalletModalOpen(false);
          window.location.href = '/trade';
        }}
      />
    </main>
  );
}
