'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Info, Settings2, ArrowDownUp } from 'lucide-react';
import { Select } from '@/components/ui/select';

export function ConditionalOrderForm() {
  const [orderType, setOrderType] = useState<'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT'>('LIMIT');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [quantityType, setQuantityType] = useState<'ABSOLUTE' | 'PERCENT_POSITION'>('ABSOLUTE');
  const [amount, setAmount] = useState('');
  const [expiration, setExpiration] = useState('30d');

  const currentPrice = 1.00; // Mock current price

  return (
    <Card className="w-full max-w-md mx-auto p-4 border-border/50 bg-background/95 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <Select 
          options={[
            { label: 'Limit', value: 'LIMIT' },
            { label: 'Stop Loss', value: 'STOP_LOSS' },
            { label: 'Take Profit', value: 'TAKE_PROFIT' },
          ]}
          value={orderType} 
          onChange={(val: string) => setOrderType(val as 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT')} 
          className="w-40"
        />
        
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex bg-muted/50 p-1 rounded-lg mb-6">
        <button
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setSide('BUY')}
        >
          BUY
        </button>
        <button
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${side === 'SELL' ? 'bg-rose-500/20 text-rose-400' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setSide('SELL')}
        >
          SELL
        </button>
      </div>

      <div className="space-y-4">
        {/* Trigger Price */}
        <div className="bg-secondary/30 rounded-xl p-3 border border-border/50 focus-within:border-primary/50">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-muted-foreground">Trigger Price</span>
            <span className="text-xs text-muted-foreground">Current: ${currentPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl text-muted-foreground font-semibold">$</span>
            <Input 
              type="number"
              placeholder="0.00"
              value={triggerPrice}
              onChange={(e) => setTriggerPrice(e.target.value)}
              className="border-0 bg-transparent text-2xl p-0 h-auto focus-visible:ring-0 font-semibold"
            />
          </div>
        </div>

        {/* Quantity */}
        <div className="bg-secondary/30 rounded-xl p-3 border border-border/50 focus-within:border-primary/50">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-muted-foreground">Quantity</span>
            <div className="flex gap-1">
              {['25', '50', '75', '100'].map(pct => (
                <button 
                  key={pct}
                  onClick={() => { setQuantityType('PERCENT_POSITION'); setAmount(pct); }}
                  className={`text-2xs px-1.5 py-0.5 rounded border ${quantityType === 'PERCENT_POSITION' && amount === pct ? 'bg-primary/20 border-primary text-primary' : 'border-border/50 text-muted-foreground hover:border-muted-foreground'}`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input 
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => { setQuantityType('ABSOLUTE'); setAmount(e.target.value); }}
              className="border-0 bg-transparent text-2xl p-0 h-auto focus-visible:ring-0 font-semibold"
            />
            <span className="text-sm font-medium">{side === 'BUY' ? 'USDC' : 'TOKEN'}</span>
          </div>
        </div>

        {/* Expiration */}
        <div className="flex items-center justify-between bg-secondary/30 rounded-xl p-3 border border-border/50">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            Expires In <Info className="h-3 w-3" />
          </span>
          <Select 
            options={[
              { label: '1 Day', value: '1d' },
              { label: '7 Days', value: '7d' },
              { label: '30 Days', value: '30d' },
              { label: 'Never', value: 'never' },
            ]}
            value={expiration} 
            onChange={(val: string) => setExpiration(val)}
            className="w-28"
          />
        </div>
        
        {/* Analytics preview */}
        <div className="p-3 bg-card border rounded-lg space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Exitability Score</span>
            <span className="text-emerald-400 font-medium">82 / 100</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Trigger Source</span>
            <span className="font-medium">Aggregated DEX</span>
          </div>
        </div>

        <Button 
          size="lg" 
          className={`w-full text-lg font-semibold h-14 ${side === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
          disabled={!triggerPrice || !amount}
        >
          Create {orderType.replace('_', ' ')}
        </Button>
      </div>
    </Card>
  );
}
