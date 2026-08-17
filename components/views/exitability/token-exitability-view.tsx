import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut, TrendingDown, Info, Activity } from 'lucide-react';
import { ExitabilityScore, ExecutionEstimate } from '@/lib/intelligence/exitability/types';

export function TokenExitabilityView({ tokenId = 'mock-id' }: { tokenId?: string }) {
  const [data, setData] = useState<ExitabilityScore | null>(null);
  const [simulateAmount, setSimulateAmount] = useState<string>('25000');
  const [simulation, setSimulation] = useState<ExecutionEstimate | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    fetch(`/api/intelligence/exitability/${tokenId}`)
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, [tokenId]);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/intelligence/exitability/${tokenId}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionSizeUsd: Number(simulateAmount) })
      });
      const est = await res.json();
      setSimulation(est);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Run initial simulation
  useEffect(() => {
    if (data && !simulation) handleSimulate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return <div className="p-8 text-center text-muted-foreground">Loading Exitability Engine...</div>;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      
      {/* Overview Card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-full bg-primary/10 text-primary">
                <LogOut className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  Exitability <Badge variant="outline">{data.rating}</Badge>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Estimating real liquidity execution constraints.</p>
              </div>
            </div>

            <div className="text-right">
              <div className={`text-4xl font-bold ${getScoreColor(data.score)}`}>{data.score} <span className="text-lg text-muted-foreground">/ 100</span></div>
              <div className="text-sm font-medium text-muted-foreground mt-1 flex items-center justify-end gap-1">
                <Activity className="w-4 h-4"/> Trend: {data.trend}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t">
            <div>
              <div className="text-sm text-muted-foreground">Market Cap</div>
              <div className="text-xl font-bold">${(data.marketCapUsd / 1000000).toFixed(1)}M</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Liquidity</div>
              <div className="text-xl font-bold">${(data.totalLiquidityUsd / 1000).toFixed(0)}K</div>
            </div>
            <div className="bg-muted/30 p-2 rounded">
              <div className="text-sm font-medium text-primary flex items-center gap-1">
                Executable Liquidity (±5%) <Info className="w-3 h-3"/>
              </div>
              <div className="text-xl font-bold text-primary">${(data.executableLiquidityUsd / 1000).toFixed(0)}K</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Risk Factors */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Risk Factors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(data.factors).map(([key, value], idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="font-medium">{value as string}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Exit Simulator */}
        <Card className="md:col-span-2 border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5"/> Live Exit Simulator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <Input 
                type="number" 
                value={simulateAmount} 
                onChange={e => setSimulateAmount(e.target.value)} 
                className="font-mono text-lg"
                prefix="$"
              />
              <Button onClick={handleSimulate} disabled={isSimulating}>
                {isSimulating ? 'Simulating...' : 'Simulate'}
              </Button>
            </div>

            {simulation && (
              <div className="space-y-4">
                {simulation.executionWarning && (
                  <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-500 text-sm flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 shrink-0"/>
                    <span>{simulation.executionWarning}</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded bg-muted/10">
                    <div className="text-sm text-muted-foreground">Estimated Proceeds</div>
                    <div className="text-2xl font-bold">${simulation.estimatedProceedsUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-xs text-muted-foreground mt-1">Network fees: ${simulation.feesUsd.toFixed(2)}</div>
                  </div>
                  <div className="p-4 border rounded bg-muted/10">
                    <div className="text-sm text-muted-foreground">Price Impact</div>
                    <div className={`text-2xl font-bold ${simulation.priceImpactPct > 5 ? 'text-red-500' : 'text-amber-500'}`}>
                      {simulation.priceImpactPct.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Suggested slippage: {simulation.slippageToleranceNeededPct.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm border-t pt-4">
                  <span className="text-muted-foreground">Best Executable Route</span>
                  <span className="font-mono">{simulation.route.join(' → ')}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
