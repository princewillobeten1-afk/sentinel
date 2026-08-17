'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import Link from 'next/link';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="w-full max-w-md p-8 rounded-2xl bg-[#0d131f] border border-cyan-900/40 shadow-2xl backdrop-blur-xl text-center">
        <h2 className="text-xl font-bold text-white mb-2">Invalid Reset Link</h2>
        <p className="text-sm text-cyan-200/70 mb-6">
          This password reset link is missing a valid security token or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-sm transition-all"
        >
          Request New Reset Link
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Suspense fallback={<div className="text-center text-xs text-slate-500">Loading...</div>}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </main>
  );
}
