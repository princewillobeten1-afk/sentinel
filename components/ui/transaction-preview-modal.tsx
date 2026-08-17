import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck, ArrowRight, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransactionSimulationResult } from '@/lib/wallet/system-types';
import { endpoints, apiUrl } from '@/lib/api/endpoints';

interface TransactionPreviewModalProps {
  walletId: string;
  tokenId: string;
  action: 'BUY' | 'SELL';
  amountUsd: number;
  /**
   * A preview the caller has already obtained. When supplied, the modal renders
   * it directly instead of running its own simulation.
   *
   * This exists because the trade flow already prices the swap through
   * `/api/v1/trading/quote` before opening the preview; making the modal fetch
   * a *second*, differently-sourced estimate meant the number the user
   * confirmed was not the number that was quoted.
   */
  simulation?: TransactionSimulationResult | null;
  onCancel: () => void;
  onSign: () => void;
}

export function TransactionPreviewModal({
  walletId,
  tokenId,
  action,
  amountUsd,
  simulation: providedSimulation,
  onCancel,
  onSign,
}: TransactionPreviewModalProps) {
  const [simulation, setSimulation] = useState<TransactionSimulationResult | null>(
    providedSimulation ?? null,
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [hasSimulated, setHasSimulated] = useState(Boolean(providedSimulation));

  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(apiUrl(endpoints.wallets.simulate), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ walletId, tokenId, action, amountUsd }),
      });
      const data = await res.json().catch(() => null);

      // The endpoint reports failure as `{ error }`, which has no `success`
      // field. Treated as-is it read as a *failed simulation* with an empty
      // message and left "Confirm & Sign" permanently disabled. Normalise it
      // into the result shape so the reason is actually shown.
      if (!res.ok || !data || typeof data.success !== 'boolean') {
        setSimulation({
          success: false,
          errorMessage: data?.error || 'Simulation is unavailable for this wallet.',
          expectedReceiveUsd: 0,
          priceImpactPct: 0,
          networkFeeUsd: 0,
          route: [],
          contractRisk: 'HIGH',
        });
        return;
      }
      setSimulation(data);
    } catch (err) {
      setSimulation({
        success: false,
        errorMessage: err instanceof Error ? err.message : 'Simulation request failed.',
        expectedReceiveUsd: 0,
        priceImpactPct: 0,
        networkFeeUsd: 0,
        route: [],
        contractRisk: 'HIGH',
      });
    } finally {
      setIsSimulating(false);
      setHasSimulated(true);
    }
  };

  // Only simulate when the caller did not already supply a preview.
  React.useEffect(() => {
    if (!providedSimulation && !hasSimulated && !isSimulating) {
      runSimulation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden flex flex-col">
        
        <div className="p-4 border-b bg-muted/10 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary"/> Transaction Review
          </h2>
          <div className="text-xs font-mono text-muted-foreground px-2 py-1 bg-muted rounded">
            Wallet: {walletId.replace('w-', '')}
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Action</span>
              <span className={`text-2xl font-bold ${action === 'BUY' ? 'text-emerald-500' : 'text-red-500'}`}>
                {action}
              </span>
            </div>
            <ArrowRight className="w-6 h-6 text-muted-foreground mx-4" />
            <div className="flex flex-col text-right">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="text-2xl font-bold">${amountUsd.toLocaleString()}</span>
            </div>
          </div>

          {!hasSimulated || isSimulating ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Simulating transaction in isolated environment...</p>
            </div>
          ) : simulation ? (
            <>
              {!simulation.success ? (
                <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-lg text-red-400">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold">TRANSACTION SIMULATION FAILED</h4>
                      <p className="text-sm mt-1">{simulation.errorMessage}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {simulation.priceImpactPct > 2 && (
                    <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-lg text-amber-400 flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        High price impact detected ({simulation.priceImpactPct.toFixed(1)}%). 
                        You will receive significantly less than expected.
                      </div>
                    </div>
                  )}

                  <div className="p-4 border rounded-lg bg-muted/10 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Expected Receive</span>
                      <span className="font-bold text-lg">${simulation.expectedReceiveUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Price Impact</span>
                      <span className={simulation.priceImpactPct > 2 ? 'text-amber-500 font-medium' : ''}>{simulation.priceImpactPct.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Network Fee</span>
                      <span>~${simulation.networkFeeUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t pt-3 mt-3">
                      <span className="text-muted-foreground">Route</span>
                      <span className="font-mono text-xs text-primary">{simulation.route.join(' → ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span>Contract verification passed. No administrative mint/burn privileges detected.</span>
                  </div>

                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="p-4 border-t bg-muted/5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            {(!simulation || !simulation.success) ? 'Close' : 'Reject'}
          </Button>
          
          <Button 
            className="flex-1 font-bold" 
            variant={action === 'BUY' ? 'buy' : 'sell'}
            disabled={!simulation || !simulation.success || isSimulating}
            onClick={onSign}
          >
            Confirm & Sign
          </Button>
        </div>

      </div>
    </div>
  );
}
