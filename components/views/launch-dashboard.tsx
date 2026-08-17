import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function LaunchDashboard({ launchId }: { launchId: string }) {
  const [data, setData] = useState<any>(null);
  const [intel, setIntel] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [sim, setSim] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/v1/launches/${launchId}`).then(r => r.json()).then(setData);
    fetch(`/api/v1/launches/${launchId}/intelligence`).then(r => r.json()).then(setIntel);
  }, [launchId]);

  const handleSimulate = async (action: 'BUY' | 'SELL') => {
    if (!amount || isNaN(Number(amount))) return;
    const res = await fetch(`/api/v1/launches/${launchId}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ state: data.bondingCurve, action, amount: Number(amount) })
    });
    setSim(await res.json());
  };

  if (!data || !intel) return <div>Loading Launch...</div>;

  const gradProgress = (Number(data.bondingCurve.reserveBalance) / Number(data.bondingCurve.graduationTarget)) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {/* Main Info */}
      <div className="md:col-span-2 space-y-6">
        <div className="flex justify-between items-end border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold">{data.config.name}</h1>
            <div className="text-xl text-muted-foreground">${data.config.symbol}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">${data.bondingCurve.currentPrice}</div>
            <div className="text-sm text-muted-foreground">MCap: ${data.bondingCurve.marketCap}</div>
          </div>
        </div>
        
        {/* Intelligence Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Launch Integrity</div>
              <div className="text-2xl font-bold text-green-500">{intel.integrity}/100</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Insider Risk</div>
              <div className="text-2xl font-bold text-green-500">{intel.insiderRisk}</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Exitability</div>
              <div className="text-2xl font-bold">{intel.exitability}/100</div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground mb-1">Organic Vol</div>
              <div className="text-2xl font-bold">{intel.organicVolume}/100</div>
            </CardContent>
          </Card>
        </div>

        {/* Bonding Curve Progress */}
        <Card>
          <CardHeader><CardTitle>Bonding Curve Progress</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{data.bondingCurve.reserveBalance} / {data.bondingCurve.graduationTarget} SOL</span>
              <span>{gradProgress.toFixed(1)}% to Graduation</span>
            </div>
            <div className="w-full bg-secondary h-4 rounded-full overflow-hidden">
              <div className="bg-primary h-full" style={{ width: `${gradProgress}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trading Sidebar */}
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Trade via Curve</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input 
              type="number" 
              className="w-full bg-background border p-2 rounded" 
              placeholder="Amount" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
            />
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-green-500/20 text-green-500 py-2 rounded font-bold hover:bg-green-500/30" onClick={() => handleSimulate('BUY')}>Simulate Buy</button>
              <button className="bg-red-500/20 text-red-500 py-2 rounded font-bold hover:bg-red-500/30" onClick={() => handleSimulate('SELL')}>Simulate Sell</button>
            </div>
            
            {sim && (
              <div className="mt-4 p-3 bg-muted rounded text-sm space-y-1">
                {sim.tokensReceived && <div>Expected: <span className="font-bold text-primary">{sim.tokensReceived} {data.config.symbol}</span></div>}
                {sim.nativeReceived && <div>Expected: <span className="font-bold text-primary">{sim.nativeReceived} SOL</span></div>}
                <div className={sim.priceImpact > 0.05 ? 'text-red-500' : ''}>Impact: {(sim.priceImpact * 100).toFixed(2)}%</div>
                <div>Fee: {sim.feePaid} SOL</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
