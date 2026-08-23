'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-sentinel-950 text-slate-100 flex flex-col items-center justify-center min-h-screen p-6 font-sans">
        <div className="max-w-md w-full bg-sentinel-900 border border-sentinel-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <h2 className="text-xl font-bold text-rose-400">Critical Error</h2>
          <p className="text-sm text-slate-400">
            {error.message || 'A critical rendering error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black font-bold text-sm rounded-lg transition-colors"
          >
            Refresh Interface
          </button>
        </div>
      </body>
    </html>
  );
}
