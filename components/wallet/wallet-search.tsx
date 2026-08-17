'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Target, TrendingUp, AlertTriangle } from 'lucide-react';
import { WalletProfile, WalletRiskScore } from '@/lib/wallet/intelligence';

interface WalletSearchProps {
  onSearch: (address: string) => Promise<{ profile: WalletProfile, risk: WalletRiskScore } | null>;
}

export function WalletSearch({ onSearch }: WalletSearchProps) {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ profile: WalletProfile, risk: WalletRiskScore } | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await onSearch(address);
      if (data) {
        setResult(data);
      } else {
        setError('No intelligence data found for this wallet address.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during search.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <div className="pb-4">
          <h3 className="text-2xl font-bold">Wallet Intelligence Search</h3>
          <p className="text-sm text-muted-foreground mt-1">Enter a wallet address to analyze its trading behavior and risk profile.</p>
        </div>
        <div>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Search wallet address..." 
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={isLoading || !address}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Search'}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
          </div>
      </Card>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
          <Card className="p-6">
            <div className="pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Trading Profile
              </h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Trader Type</p>
                  <p className="font-semibold capitalize">{result.profile.traderType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Activity Level</p>
                  <p className="font-semibold capitalize">{result.profile.activityLevel}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="font-semibold">{(result.profile.winRate * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Typical Size</p>
                  <p className="font-semibold">${result.profile.typicalTradeSize.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${result.risk.score > 50 ? 'text-destructive' : 'text-amber-500'}`} />
                Risk Analysis
              </h3>
            </div>
            <div>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Risk Score</span>
                  <span className={`font-bold ${result.risk.score > 70 ? 'text-destructive' : 'text-amber-500'}`}>
                    {result.risk.score}/100
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${result.risk.score > 70 ? 'bg-destructive' : result.risk.score > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${result.risk.score}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Key Factors:</p>
                {result.risk.factors.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {result.risk.factors.map((factor, i) => (
                      <li key={i} className="text-sm text-muted-foreground">{factor}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No significant risk factors detected.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
