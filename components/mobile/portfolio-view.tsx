import React from 'react';

export function MobilePortfolioView() {
  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <button className="text-red-500 font-bold bg-red-500/10 px-3 py-1 rounded-full text-xs">⚠ Emergency</button>
      </div>

      <div className="bg-card border rounded-2xl p-6 text-center shadow-sm">
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Value</div>
        <div className="text-4xl font-mono font-bold tracking-tight mb-2">$24,821.40</div>
        <div className="flex justify-center items-center gap-2 font-medium">
          <span className="text-green-500">+$842.12</span>
          <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-xs">+3.51%</span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="font-bold flex justify-between items-center">
          <span>Positions</span>
          <span className="text-muted-foreground text-sm font-normal">3 active</span>
        </h2>

        {/* Position Card */}
        <div className="border rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="font-bold text-lg">TOKEN A</div>
              <div className="text-xs text-muted-foreground font-medium">Qty: 5.84M</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-lg">$8,421.00</div>
              <div className="text-green-500 text-sm font-medium">+$1,421 (+20.3%)</div>
            </div>
          </div>

          <div className="bg-muted p-3 rounded-lg text-xs space-y-2 font-medium">
            <div className="flex justify-between">
              <span className="text-muted-foreground">True Net P&L (incl. fees)</span>
              <span className="text-green-500 font-mono">+$1,388.42</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry / Current Price</span>
              <span className="font-mono">$0.0012 / $0.00144</span>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <span className="text-2xs bg-green-500/10 text-green-500 px-2 py-1 rounded font-bold">🟢 Good Exitability</span>
            <span className="text-2xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded font-bold">🟠 Medium Risk</span>
          </div>
        </div>

        {/* Cash Card */}
        <div className="border rounded-xl p-4 flex justify-between items-center bg-muted/20">
          <div className="font-bold text-lg">Cash (USDC)</div>
          <div className="font-mono font-bold text-lg">$4,210.00</div>
        </div>
      </div>
    </div>
  );
}
