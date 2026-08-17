import React from 'react';

export function MobileEmergencyExit({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl p-6 border-2 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)] animate-in zoom-in-95 duration-200">
        
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-4xl">
            ⚠
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-red-500 mb-2">EMERGENCY EXIT</h2>
        <p className="text-sm text-center text-muted-foreground mb-6 font-medium">
          Liquidating position at best available route.
        </p>

        <div className="bg-muted p-4 rounded-lg space-y-3 mb-6 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position Value:</span>
            <span>$8,420.00</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span className="text-muted-foreground">Estimated Exit:</span>
            <span className="font-bold text-red-500">$7,984.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price Impact:</span>
            <span className="text-red-500">5.2%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Liquidity:</span>
            <span className="text-red-500 font-bold">LOW</span>
          </div>
        </div>

        <div className="text-xs text-center text-yellow-500 font-bold mb-6 p-2 bg-yellow-500/10 rounded">
          Partial exit recommended due to high price impact.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="py-3 font-bold rounded-lg border hover:bg-muted transition-colors">
            CANCEL
          </button>
          <button className="py-3 font-bold rounded-lg bg-red-500 text-white shadow-lg active:scale-95 transition-transform">
            DUMP ALL
          </button>
        </div>
      </div>
    </div>
  );
}
