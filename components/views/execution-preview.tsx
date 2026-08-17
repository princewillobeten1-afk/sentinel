import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { RouteVisualizer } from '@/components/ui/route-visualizer';
import { Quote, SimulationResult, ExecutionRequest, ExecutionPolicy, MEVPreference } from '@/lib/execution/types';

interface ExecutionPreviewProps {
  request: ExecutionRequest;
}

export function ExecutionPreview({ request }: ExecutionPreviewProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch Quote
    fetch('/api/v1/execution/quote', {
      method: 'POST',
      body: JSON.stringify(request)
    })
    .then(res => res.json())
    .then(data => {
      const bestQuote = data.quotes?.[0];
      setQuote(bestQuote);
      if (bestQuote) {
        // 2. Simulate Pre-flight
        fetch('/api/v1/execution/simulate', {
          method: 'POST',
          body: JSON.stringify({ quote: bestQuote, wallet: request.wallet })
        })
        .then(res => res.json())
        .then(sim => {
          setSimulation(sim);
          setLoading(false);
        });
      }
    });
  }, [request]);

  const handleExecute = async () => {
    // Submit
    const res = await fetch('/api/v1/execution/submit', {
      method: 'POST',
      body: JSON.stringify({ quote, request })
    });
    const result = await res.json();
    alert(`Execution Status: ${result.status}\nTx: ${result.txHash}`);
  };

  if (loading) return <div>Simulating Execution Routes...</div>;
  if (!quote) return <div>No route found for this trade.</div>;

  const isEmergency = request.orderType === 'EMERGENCY_EXIT';

  return (
    <Card className={`max-w-md ${isEmergency ? 'border-red-500 bg-red-500/5' : ''}`}>
      <CardHeader>
        <CardTitle className={isEmergency ? 'text-red-500' : ''}>
          {isEmergency ? '🚨 EMERGENCY EXIT' : 'REVIEW TRADE'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center space-y-2">
          <div className="text-sm text-muted-foreground">{request.side} {request.amount} {request.tokenIn}</div>
          <div className="text-3xl font-bold text-primary">~ {quote.expectedOutput} {request.tokenOut}</div>
        </div>

        <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price Impact</span>
            <span className={quote.priceImpact > 0.05 ? 'text-red-500 font-bold' : ''}>
              {(quote.priceImpact * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage Tolerance</span>
            <span>{(request.slippageLimit * 100).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network Fee</span>
            <span>~ {quote.gasEstimate} wei</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MEV Risk</span>
            <span className={quote.mevRisk === 'HIGH' ? 'text-red-500' : 'text-green-500'}>
              {quote.mevRisk}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t mt-2">
            <span className="text-muted-foreground">Execution Quality</span>
            <span className="font-bold text-primary">{quote.executionScore}/100</span>
          </div>
        </div>

        {simulation?.willRevert && (
          <div className="bg-red-500/20 text-red-500 p-3 rounded text-sm font-medium">
            ❌ Simulation failed. Transaction will revert.
          </div>
        )}

        <RouteVisualizer routes={quote.routes} />

      </CardContent>
      <CardFooter>
        <button 
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold disabled:opacity-50"
          onClick={handleExecute}
          disabled={simulation?.willRevert}
        >
          Confirm & Sign
        </button>
      </CardFooter>
    </Card>
  );
}
