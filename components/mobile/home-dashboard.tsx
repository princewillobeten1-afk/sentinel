import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export function MobileHomeDashboard() {
  return (
    <div className="p-4 space-y-6">
      {/* Header & Portfolio */}
      <section>
        <div className="text-sm text-muted-foreground font-medium">Good morning</div>
        <div className="text-3xl font-bold font-mono tracking-tight mt-1">$24,821.40</div>
        <div className="text-sm font-medium text-green-500 mt-1">+$842.12 (3.51%)</div>
      </section>

      {/* Critical Alerts */}
      <section>
        <Card className="bg-red-500/10 border-red-500/20 shadow-none">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">⚠</span>
              <div>
                <div className="text-sm font-bold text-red-500">Risk Alert: TOKEN D</div>
                <div className="text-xs text-muted-foreground mt-0.5">Creator-linked wallet is selling. High risk of dump.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Trending */}
      <section>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">🔥 Trending</h2>
        <div className="space-y-2">
          {['TOKEN A', 'TOKEN B', 'TOKEN C'].map((token, i) => (
            <div key={token} className="flex justify-between items-center p-3 bg-muted/40 rounded-lg active:bg-muted/60 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">{token[6]}</div>
                <div>
                  <div className="font-bold text-sm">{token}</div>
                  <div className="text-xs text-muted-foreground">Vol: $1.2M</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-medium">$0.0042</div>
                <div className="text-xs text-green-500 font-medium">+{42 - (i * 12)}%</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Watchlist */}
      <section>
        <h2 className="text-lg font-bold mb-3">Your Watchlist</h2>
        <div className="space-y-2">
          {['TOKEN X', 'TOKEN Y'].map((token) => (
            <div key={token} className="flex justify-between items-center p-3 border rounded-lg">
              <div className="font-bold text-sm">{token}</div>
              <div className="text-right">
                <div className="text-sm font-mono font-medium">$0.019</div>
                <div className="text-xs text-muted-foreground font-medium">-1.2%</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
