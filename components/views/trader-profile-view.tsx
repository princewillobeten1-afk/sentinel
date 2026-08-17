import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { TrendingUp, ShieldAlert, Zap, Activity, Info, AlertTriangle } from 'lucide-react';

interface TraderProfileViewProps {
  traderId: string;
}

export function TraderProfileView({ traderId }: TraderProfileViewProps) {
  // Stub data
  const trader = {
    name: 'Trader Alpha',
    wallet: '2Kvw...9xab',
    score: 92,
    metrics: {
      netPnl: '+$284K',
      roi: '187%',
      winRate: '68%',
      maxDrawdown: '14%',
      trades: 412,
      avgHold: '3h 12m'
    },
    risk: 'Moderate',
    style: 'Momentum / Meme',
    reasonsToCopy: [
      '412 completed trades with consistent profitability',
      'Positive net P&L over 7 months',
      'Low drawdown for crypto markets (14%)',
      'Strong liquidity discipline',
      'Low insider exposure'
    ],
    warnings: [
      'High execution sensitivity (requires fast copying)',
      'Slightly elevated exposure to newly launched tokens'
    ]
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-4xl font-black text-slate-100">{trader.name}</h1>
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 text-sm px-3 py-1">
              Score: {trader.score}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono mt-2">{trader.wallet}</p>
        </div>
        <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-8 py-6 text-lg h-auto shadow-lg shadow-emerald-500/20">
          <Zap className="h-5 w-5 mr-2" />
          Setup Copy Strategy
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Net P&L</div>
            <div className="text-3xl font-bold text-emerald-400">{trader.metrics.netPnl}</div>
          </CardContent>
        </Card>
        <Card className="bg-black/40 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">ROI</div>
            <div className="text-3xl font-bold text-emerald-400">{trader.metrics.roi}</div>
          </CardContent>
        </Card>
        <Card className="bg-black/40 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Win Rate</div>
            <div className="text-3xl font-bold text-slate-200">{trader.metrics.winRate}</div>
          </CardContent>
        </Card>
        <Card className="bg-black/40 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Max Drawdown</div>
            <div className="text-3xl font-bold text-amber-500">{trader.metrics.maxDrawdown}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card className="bg-black/40 border-slate-700 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-blue-400" />
              Trader Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Trades Completed</span>
                <p className="text-lg font-medium text-slate-300">{trader.metrics.trades}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Avg Hold Time</span>
                <p className="text-lg font-medium text-slate-300">{trader.metrics.avgHold}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Primary Style</span>
                <p className="text-lg font-medium text-slate-300">{trader.style}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Risk Assessment</span>
                <p className="text-lg font-medium text-slate-300">{trader.risk}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-emerald-400 font-semibold mb-3 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                Why copy this trader?
              </h3>
              <ul className="space-y-2">
                {trader.reasonsToCopy.map((reason, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-300">
                    <span className="text-emerald-500 mr-2">✓</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-amber-500 font-semibold mb-3 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Why you shouldn't copy
              </h3>
              <ul className="space-y-2">
                {trader.warnings.map((warning, i) => (
                  <li key={i} className="flex items-start text-sm text-slate-300">
                    <span className="text-amber-500 mr-2">⚠</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <ShieldAlert className="h-5 w-5 text-blue-400" />
            <AlertTitle className="text-blue-400 font-semibold">Trust Score: High</AlertTitle>
            <AlertDescription className="text-slate-300 mt-2 text-sm leading-relaxed">
              This wallet has passed rigorous anti-sybil and wash trading checks. 
              Performance data is verified with a high degree of confidence.
            </AlertDescription>
          </Alert>

          <Card className="bg-emerald-500/5 border-emerald-500/30">
            <CardHeader>
              <CardTitle className="text-sm text-slate-200">Execution Quality</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Slippage Tolerance</span>
                    <span className="text-slate-300">Excellent</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 w-[90%] h-full"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Liquidity Awareness</span>
                    <span className="text-slate-300">Very High</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 w-[95%] h-full"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
