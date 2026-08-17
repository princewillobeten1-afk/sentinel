import React from 'react';

export function MobileDiscoveryFeed() {
  const tokens = [
    { symbol: 'ALPHA', price: '$0.0042', change: '+18.4%', organic: 87, risk: 'LOW', liquidity: '$284K' },
    { symbol: 'BETA', price: '$0.012', change: '+5.2%', organic: 92, risk: 'LOW', liquidity: '$1.1M' },
    { symbol: 'GAMMA', price: '$0.0001', change: '+142%', organic: 34, risk: 'HIGH', liquidity: '$12K' }
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">Discover</h1>
        <button className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-xs font-bold">Filters</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar">
        {['Trending', 'High Organic', 'Low Risk', 'New'].map(tag => (
          <button key={tag} className="whitespace-nowrap bg-muted px-4 py-1.5 rounded-full text-sm font-medium snap-start">
            {tag}
          </button>
        ))}
      </div>

      <div className="space-y-3 mt-4">
        {tokens.map(token => (
          <div key={token.symbol} className="border rounded-xl p-4 active:border-primary transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold text-lg">${token.symbol}</div>
                <div className="text-xs text-muted-foreground font-medium">Liq: {token.liquidity}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-medium">{token.price}</div>
                <div className="text-xs text-green-500 font-medium">{token.change}</div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className={`text-2xs px-2 py-0.5 rounded font-bold ${token.organic > 80 ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                {token.organic > 80 ? '🟢 High Organic' : '🟠 Low Organic'}
              </span>
              <span className={`text-2xs px-2 py-0.5 rounded font-bold ${token.risk === 'LOW' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {token.risk === 'LOW' ? '🟢 Low Risk' : '🚨 High Risk'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
