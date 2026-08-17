'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Target, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OpenOrdersDashboard() {
  const currentPrice = 1.00;
  const mockOrders = [
    {
      id: '1',
      token: 'TOKEN',
      type: 'STOP_LOSS',
      side: 'SELL',
      triggerPrice: 0.82,
      distance: -18,
      status: 'MONITORING',
      amount: '5,000'
    },
    {
      id: '2',
      token: 'TOKEN',
      type: 'TAKE_PROFIT',
      side: 'SELL',
      triggerPrice: 1.40,
      distance: 40,
      status: 'MONITORING',
      amount: '50%'
    }
  ];

  return (
    <div className="space-y-4 w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-lg font-semibold tracking-wide">Open Conditional Orders</h3>
        <Badge variant="neutral" className="font-mono">{mockOrders.length} Active</Badge>
      </div>

      <div className="grid gap-3">
        {mockOrders.map(order => (
          <Card key={order.id} className="p-4 border-border/50 bg-background/50 hover:bg-background/80 transition-colors flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Type Badge */}
              <div className="w-28">
                <Badge variant={order.type === 'STOP_LOSS' ? 'danger' : 'success'} className={`
                  ${order.type === 'STOP_LOSS' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}
                `}>
                  {order.type.replace('_', ' ')}
                </Badge>
              </div>

              {/* Token & Amount */}
              <div className="w-32">
                <p className="font-bold">{order.token}</p>
                <p className="text-xs text-muted-foreground">{order.side} {order.amount}</p>
              </div>

              {/* Price Flow */}
              <div className="flex items-center gap-4 w-48 text-sm">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-0.5">Current</p>
                  <p className="font-medium">${currentPrice.toFixed(2)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Trigger</p>
                  <p className="font-bold">${order.triggerPrice.toFixed(2)}</p>
                </div>
              </div>

              {/* Distance Warning */}
              <div className="w-24">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full w-fit ${
                  Math.abs(order.distance) < 5 ? 'bg-amber-500/10 text-amber-500' : 'bg-secondary text-muted-foreground'
                }`}>
                  {Math.abs(order.distance) < 5 && <AlertCircle className="w-3 h-3" />}
                  {order.distance > 0 ? '+' : ''}{order.distance}%
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8">Modify</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
