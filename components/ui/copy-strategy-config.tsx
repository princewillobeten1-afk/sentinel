import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './card';
import { Button } from './button';
import { Input } from './input';
import { ShieldAlert, Zap, AlertCircle } from 'lucide-react';
import { Alert } from './alert';

interface CopyStrategyConfigProps {
  traderName: string;
  traderRisk: string;
  onConfirm: (config: any) => void;
}

export function CopyStrategyConfig({ traderName, traderRisk, onConfirm }: CopyStrategyConfigProps) {
  const [allocation, setAllocation] = useState('5000');
  const [maxPosition, setMaxPosition] = useState('500');
  const [maxDailyLoss, setMaxDailyLoss] = useState('300');
  const [minExitability, setMinExitability] = useState('65');
  const [maxSlippage, setMaxSlippage] = useState('4');

  const handleConfirm = () => {
    onConfirm({
      allocation: parseFloat(allocation),
      maxPosition: parseFloat(maxPosition),
      maxDailyLoss: parseFloat(maxDailyLoss),
      minExitability: parseFloat(minExitability),
      maxSlippage: parseFloat(maxSlippage)
    });
  };

  return (
    <Card className="bg-black/60 border-emerald-500/30 backdrop-blur-xl w-full max-w-2xl mx-auto animate-in zoom-in-95 duration-300">
      <CardHeader className="border-b border-emerald-500/20 pb-4">
        <CardTitle className="text-2xl font-bold flex items-center text-emerald-400">
          <Zap className="h-6 w-6 mr-2" />
          Copy {traderName}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your risk limits and execution rules before activating this strategy.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Total Allocation ($)</label>
            <Input 
              type="number" 
              value={allocation} 
              onChange={(e) => setAllocation(e.target.value)}
              className="bg-black/40 border-slate-700 focus-visible:ring-emerald-500"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Max Position Size ($)</label>
            <Input 
              type="number" 
              value={maxPosition} 
              onChange={(e) => setMaxPosition(e.target.value)}
              className="bg-black/40 border-slate-700 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Max Daily Loss ($)</label>
            <Input 
              type="number" 
              value={maxDailyLoss} 
              onChange={(e) => setMaxDailyLoss(e.target.value)}
              className="bg-black/40 border-slate-700 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Max Slippage (%)</label>
            <Input 
              type="number" 
              value={maxSlippage} 
              onChange={(e) => setMaxSlippage(e.target.value)}
              className="bg-black/40 border-slate-700 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Minimum Exitability Score (0-100)</label>
            <Input 
              type="number" 
              value={minExitability} 
              onChange={(e) => setMinExitability(e.target.value)}
              className="bg-black/40 border-slate-700 focus-visible:ring-emerald-500"
            />
          </div>
        </div>

        <Alert className="bg-blue-500/10 border-blue-500/20 mt-4">
          <ShieldAlert className="h-4 w-4 text-blue-400" />
          <div className="text-slate-300 ml-2">
            Trader Risk Profile is <strong>{traderRisk}</strong>. Trades that violate your configured exitability or token risk limits will be automatically blocked.
          </div>
        </Alert>

        <Alert className="bg-amber-500/10 border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <div className="text-slate-300 ml-2">
            You are allocating up to ${allocation} to this strategy. Ensure you have sufficient balance in your primary wallet.
          </div>
        </Alert>
      </CardContent>

      <CardFooter className="border-t border-emerald-500/20 pt-4 flex justify-end space-x-2">
        <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
          Cancel
        </Button>
        <Button onClick={handleConfirm} className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
          Start Copying
        </Button>
      </CardFooter>
    </Card>
  );
}
