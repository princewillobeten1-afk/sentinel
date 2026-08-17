import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Network, AlertTriangle, TrendingUp, Search } from 'lucide-react';

export function TokenInsiderView({ tokenId = 'mock-id' }: { tokenId?: string }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/intelligence/insider/${tokenId}`)
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, [tokenId]);

  if (!data) return <div className="p-8 text-center text-muted-foreground">Loading Insider Intelligence...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      
      {/* Header Overview */}
      <Card className={`border-l-4 ${data.riskScore === 'HIGH' || data.riskScore === 'CRITICAL' ? 'border-l-red-500' : 'border-l-green-500'}`}>
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${data.riskScore === 'HIGH' || data.riskScore === 'CRITICAL' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Insider Risk: {data.riskScore}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Data Confidence:</span>
                <Badge variant="outline">{data.confidence}</Badge>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-muted-foreground">Effective Clustered Ownership</div>
            <div className="text-3xl font-bold">{data.clusteredOwnershipPct.toFixed(1)}%</div>
          </div>
        </CardContent>
      </Card>

      {/* Signals & Evidence */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold flex items-center gap-2"><Network className="w-5 h-5"/> Intelligence Signals</h3>
        
        {data.signals.length === 0 ? (
          <div className="p-8 text-center border rounded-lg bg-muted/20">No suspicious coordination detected.</div>
        ) : (
          <div className="grid gap-4">
            {data.signals.map((signal: any, i: number) => (
              <Card key={i}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    {signal.category.includes('SELLING') ? <TrendingUp className="w-5 h-5 text-red-500 rotate-180"/> : <AlertTriangle className="w-5 h-5 text-amber-500"/>}
                    <CardTitle className="text-lg">{signal.category.replace(/_/g, ' ')}</CardTitle>
                  </div>
                  {signal.timeWindow && <Badge variant="secondary">Window: {signal.timeWindow}</Badge>}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mt-2">
                    {signal.evidence.map((ev: any, j: number) => (
                      <div key={j} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                        <span className="text-sm">{ev.description}</span>
                        <span className="text-xs font-mono font-bold text-amber-500">+{ev.weight}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline"><Search className="w-4 h-4 mr-2"/> View Cluster Details</Button>
                    <Button size="sm" variant="ghost">Set Alert</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
