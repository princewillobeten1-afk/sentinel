import React from 'react';

export function MobileTokenPage() {
  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        
        {/* Token Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-2xl">TOKEN X</div>
              <div className="text-sm font-medium text-muted-foreground">Market Cap: $1.2M</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-primary">$0.00241</div>
              <div className="text-sm font-medium text-green-500">+18.4%</div>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="h-64 w-full bg-muted/20 flex flex-col items-center justify-center border-b relative">
          <div className="text-muted-foreground text-sm">Interactive Chart View</div>
          {/* Intelligence Overlay Example */}
          <div className="absolute top-1/2 left-1/3 bg-red-500 w-3 h-3 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
          <div className="absolute top-1/2 left-1/3 ml-4 -mt-2 bg-popover text-popover-foreground text-2xs px-2 py-1 rounded shadow-md font-medium border border-red-500/20">
            Insider accumulation
          </div>
        </div>

        {/* Intelligence Summary */}
        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Token Health</h2>
            <div className="text-lg font-bold text-green-500">82 <span className="text-xs text-muted-foreground">/ 100</span></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <div className="bg-green-500/10 text-green-500 p-2 rounded">🟢 Organic Volume</div>
            <div className="bg-green-500/10 text-green-500 p-2 rounded">🟢 Strong Exitability</div>
            <div className="bg-green-500/10 text-green-500 p-2 rounded">🟢 Healthy Liquidity</div>
            <div className="bg-yellow-500/10 text-yellow-500 p-2 rounded">⚠ Moderate Ownership</div>
            <div className="bg-green-500/10 text-green-500 p-2 rounded">🟢 Low Insider Risk</div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded mt-4">
            <div className="text-sm font-bold text-red-500 mb-1">Risk: HIGH</div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              <li>Creator controls 18%</li>
              <li>3 related wallets hold 11%</li>
              <li>Recent insider selling detected</li>
            </ul>
          </div>
        </div>

      </div>

      {/* Persistent Trade Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-card border-t flex gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        <button className="flex-1 bg-green-500 text-white font-bold py-3 rounded-lg active:scale-95 transition-transform">
          BUY
        </button>
        <button className="flex-1 bg-red-500 text-white font-bold py-3 rounded-lg active:scale-95 transition-transform">
          SELL
        </button>
      </div>
    </div>
  );
}
