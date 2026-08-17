'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'VERIFYING' | 'SUCCESS' | 'ERROR'>('VERIFYING');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (!token) {
      setStatus('ERROR');
      setMessage('Invalid or missing verification token.');
      return;
    }

    const doVerify = async () => {
      try {
        const res = await fetch('/api/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || data.message || 'Verification failed');
        }

        setStatus('SUCCESS');
        setMessage('Your email address has been verified successfully.');
      } catch (err: any) {
        setStatus('ERROR');
        setMessage(err.message || 'Email verification failed.');
      }
    };

    doVerify();
  }, [token]);

  return (
    <div className="w-full max-w-md p-8 rounded-2xl bg-[#0d131f] border border-cyan-900/40 shadow-2xl backdrop-blur-xl text-center">
      {status === 'VERIFYING' && (
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 animate-pulse">
            <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Verifying Email</h2>
          <p className="text-xs text-cyan-200/70">{message}</p>
        </div>
      )}

      {status === 'SUCCESS' && (
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Verification Complete</h2>
          <p className="text-xs text-cyan-200/70">{message}</p>
          <Link
            href="/trade"
            className="inline-block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-cyan-500/20"
          >
            Proceed to Terminal
          </Link>
        </div>
      )}

      {status === 'ERROR' && (
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Verification Error</h2>
          <p className="text-xs text-red-300">{message}</p>
          <Link
            href="/login"
            className="inline-block w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs transition-all"
          >
            Return to Login
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <Suspense fallback={<div className="text-center text-xs text-slate-500">Loading...</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </main>
  );
}
