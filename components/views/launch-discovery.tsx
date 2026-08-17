import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function LaunchDiscovery() {
  const [launches, setLaunches] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/v1/launches').then(r => r.json()).then(data => setLaunches(data.launches));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold">Launch Discovery</h1>
          <p className="text-muted-foreground">Quality-adjusted, risk-aware token launches.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded font-medium">Create Token</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {launches.map(launch => (
          <Card key={launch.id} className="hover:border-primary cursor-pointer transition-colors">
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{launch.name}</h3>
                  <div className="text-sm font-medium text-muted-foreground">${launch.symbol}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm bg-muted px-2 py-1 rounded">{launch.age} old</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm border-y py-3 border-muted">
                <div>
                  <div className="text-muted-foreground text-xs">M. Cap</div>
                  <div className="font-bold">{launch.marketCap}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Liquidity</div>
                  <div className="font-bold">{launch.liquidity}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Quality Momentum</div>
                  <div className="font-bold text-primary">{launch.adjustedMomentum}/100</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Launch Risk</div>
                  <div className={`font-bold ${launch.risk === 'LOW' ? 'text-green-500' : 'text-red-500'}`}>
                    {launch.risk}
                  </div>
                </div>
              </div>

              <button className="w-full bg-secondary text-secondary-foreground py-2 rounded font-bold hover:bg-secondary/80">
                View Intelligence
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
