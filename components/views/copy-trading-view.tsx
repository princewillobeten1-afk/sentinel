import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { AlertTriangle, TrendingUp, ShieldAlert, Zap, Search } from 'lucide-react';

export function CopyTradingView() {
  const [searchQuery, setSearchQuery] = useState('');

  // Stub data
  const traders = [
    {
      id: '1',
      name: 'Trader Alpha',
      wallet: '2Kvw...9xab',
      score: 92,
      netPnl: '+$284K',
      winRate: '68%',
      risk: 'Moderate',
      drawdown: '14%'
    },
    {
      id: '2',
      name: 'Trader Beta',
      wallet: '8Frt...1yxc',
      score: 85,
      netPnl: '+$193K',
      winRate: '61%',
      risk: 'Low',
      drawdown: '9%'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-emerald-400">Smart Traders</h2>
          <p className="text-muted-foreground mt-1">Discover, analyze, and safely copy top performing wallets.</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="border-emerald-500/20 hover:bg-emerald-500/10">
            My Copy Portfolio
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search wallet address or trader name..." 
            className="pl-9 bg-black/40 border-emerald-500/20 focus-visible:ring-emerald-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="secondary" className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
          Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {traders.map((trader) => (
          <Card key={trader.id} className="bg-black/40 border-emerald-500/20 hover:border-emerald-500/40 transition-colors backdrop-blur-xl group">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center space-x-2 text-slate-200">
                    <span>{trader.name}</span>
                    <Badge variant="outline" className="border-emerald-500 text-emerald-400 text-xs">
                      Score: {trader.score}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{trader.wallet}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Net P&L</span>
                  <div className="text-lg font-bold text-emerald-400 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    {trader.netPnl}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Win Rate</span>
                  <div className="text-lg font-bold text-slate-200">{trader.winRate}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Drawdown</span>
                  <div className="text-sm font-medium text-slate-300 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                    {trader.drawdown}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Risk</span>
                  <div className="text-sm font-medium text-slate-300 flex items-center">
                    <ShieldAlert className="h-3 w-3 mr-1 text-blue-400" />
                    {trader.risk}
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 mt-4">
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold">
                  <Zap className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800">
                  Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
