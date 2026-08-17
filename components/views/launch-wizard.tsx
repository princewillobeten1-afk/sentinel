import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { LaunchConfig, LaunchMode, LaunchRiskScore } from '@/lib/launchpad/types';

export function LaunchWizard() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Partial<LaunchConfig>>({
    name: '',
    symbol: '',
    totalSupply: '1000000000',
    launchMode: LaunchMode.BONDING_CURVE,
    creatorAllocation: { walletAddress: '', percentage: 0, isVested: false }
  });
  const [risk, setRisk] = useState<LaunchRiskScore | null>(null);

  const analyzePreflight = async () => {
    const res = await fetch('/api/v1/launches', {
      method: 'POST',
      body: JSON.stringify({ action: 'ANALYZE', config })
    });
    const data = await res.json();
    setRisk(data.risk);
    setStep(4); // Move to review
  };

  const handleDeploy = async () => {
    const res = await fetch('/api/v1/launches', {
      method: 'POST',
      body: JSON.stringify({ action: 'DEPLOY', config })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      alert(`Token deployed! Launch ID: ${data.deployment.launchId}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Launch a Token</h1>
      
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>1. Token Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input 
              className="w-full bg-background border p-2 rounded" 
              placeholder="Name (e.g. Sentinel Token)" 
              value={config.name} 
              onChange={e => setConfig({...config, name: e.target.value})} 
            />
            <input 
              className="w-full bg-background border p-2 rounded" 
              placeholder="Symbol (e.g. SNTL)" 
              value={config.symbol} 
              onChange={e => setConfig({...config, symbol: e.target.value})} 
            />
          </CardContent>
          <CardFooter>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded ml-auto" onClick={() => setStep(2)}>Next</button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>2. Economics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Launch Mode</label>
              <select 
                className="w-full bg-background border p-2 rounded mt-1"
                value={config.launchMode}
                onChange={e => setConfig({...config, launchMode: e.target.value as LaunchMode})}
              >
                <option value={LaunchMode.BONDING_CURVE}>Bonding Curve (Fair)</option>
                <option value={LaunchMode.FAIR}>Direct Pool (Fair)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Creator Allocation (%)</label>
              <input 
                type="number" 
                className="w-full bg-background border p-2 rounded mt-1" 
                value={config.creatorAllocation?.percentage || 0} 
                onChange={e => setConfig({...config, creatorAllocation: { ...config.creatorAllocation!, percentage: Number(e.target.value) }})} 
              />
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <button className="px-4 py-2 border rounded" onClick={() => setStep(1)}>Back</button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded" onClick={analyzePreflight}>Analyze Risk & Review</button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && risk && (
        <Card className={risk.riskLevel === 'CRITICAL' ? 'border-red-500' : ''}>
          <CardHeader>
            <CardTitle>Review & Pre-flight Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`p-4 rounded-md border ${risk.riskLevel === 'CRITICAL' || risk.riskLevel === 'HIGH' ? 'bg-red-500/10 border-red-500' : 'bg-green-500/10 border-green-500'}`}>
              <h3 className="font-bold mb-2">Launch Risk: {risk.riskLevel}</h3>
              <div className="text-sm space-y-1">
                <div>Overall Score: {risk.overallScore}/100</div>
                <div>Effective Ownership: {risk.effectiveOwnershipPercentage}%</div>
                <div>Creator Reputation: {risk.creatorReputationScore}/100</div>
                {risk.primaryConcern && <div className="text-red-500 mt-2 font-medium">⚠ {risk.primaryConcern}</div>}
              </div>
            </div>
            <div className="text-sm">
              <p>By deploying, this token will be instantly indexed and evaluated by Sentinel's intelligence engines.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <button className="px-4 py-2 border rounded" onClick={() => setStep(2)}>Back</button>
            <button 
              className="px-4 py-2 bg-primary text-primary-foreground rounded font-bold disabled:opacity-50" 
              disabled={risk.riskLevel === 'CRITICAL'}
              onClick={handleDeploy}
            >
              Deploy Token
            </button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
