import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, Activity, History, Users, AlertTriangle } from 'lucide-react';

export function ClusterAnalysisView({ clusterId = 'mock-cluster' }: { clusterId?: string }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/intelligence/clusters/${clusterId}`)
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, [clusterId]);

  if (!data) return <div className="p-8 text-center text-muted-foreground">Loading Cluster Data...</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Network className="w-6 h-6"/> Wallet Cluster {data.id.substring(0, 8)}</h2>
          <p className="text-muted-foreground mt-1">Identified via recurring on-chain behavioral patterns.</p>
        </div>
        <Badge variant={data.riskProfile === 'HIGH' ? 'destructive' : 'default'} className="text-lg px-4 py-1">
          {data.riskProfile} RISK
        </Badge>
      </div>

      <Card className="bg-amber-500/10 border-amber-500/50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-1"/>
          <div>
            <div className="font-semibold text-amber-500 mb-1">AI Synthesis</div>
            <p className="text-sm">{data.evidenceSummary}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">Wallets</div>
            <div className="text-3xl font-bold mt-1 flex justify-center items-center gap-2"><Users className="w-5 h-5 text-blue-500"/> {data.walletCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">Tokens Participated</div>
            <div className="text-3xl font-bold mt-1">{data.metrics.tokensParticipated}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">Early Entries</div>
            <div className="text-3xl font-bold mt-1 text-green-500">{data.metrics.earlyEntries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground">Creator-Linked</div>
            <div className="text-3xl font-bold mt-1 text-purple-500">{data.metrics.creatorLinked}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5"/> Relationship Signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.relationshipSignals.map((sig: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 border rounded-lg bg-muted/20">
                <span className="font-medium">{sig.type}</span>
                <Badge variant={sig.strength === 'HIGH' ? 'default' : 'secondary'}>{sig.strength}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5"/> Top Wallets in Cluster</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topWallets.map((wallet: string, i: number) => (
              <div key={i} className="p-2 border rounded font-mono text-sm flex justify-between bg-muted/20">
                <span>{wallet}</span>
                <a href="#" className="text-primary hover:underline">View on Explorer</a>
              </div>
            ))}
            <div className="text-center mt-4">
              <a href="#" className="text-sm text-primary hover:underline">+ {data.walletCount - data.topWallets.length} more wallets</a>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
