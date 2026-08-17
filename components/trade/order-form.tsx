'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, ArrowDownUp, Info } from 'lucide-react';

interface OrderFormProps {
  onReviewOrder: (orderData: any) => void;
}

export function OrderForm({ onReviewOrder }: OrderFormProps) {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    
    onReviewOrder({
      side,
      amount,
      tokenIn: side === 'BUY' ? 'USDC' : 'TOKEN',
      tokenOut: side === 'BUY' ? 'TOKEN' : 'USDC',
      slippageTolerance: parseFloat(slippage)
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto p-4 border-border/50 bg-background/95 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex bg-muted/50 p-1 rounded-lg">
          <button
            type="button"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setSide('BUY')}
          >
            BUY
          </button>
          <button
            type="button"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${side === 'SELL' ? 'bg-rose-500/20 text-rose-400' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setSide('SELL')}
          >
            SELL
          </button>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleReview} className="space-y-4">
        {/* Input Amount */}
        <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 transition-colors focus-within:border-primary/50">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">You pay</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              Available: 4,200 <span className="text-foreground">Max</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Input 
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-0 bg-transparent text-3xl p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/30 font-semibold"
            />
            <div className="shrink-0 flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border border-border/50">
              <div className="w-5 h-5 rounded-full bg-blue-500"></div>
              <span className="font-medium">{side === 'BUY' ? 'USDC' : 'TOKEN'}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center -my-3 relative z-10">
          <button type="button" className="bg-background border border-border/50 rounded-xl p-1.5 hover:bg-secondary transition-colors" onClick={() => setSide(side === 'BUY' ? 'SELL' : 'BUY')}>
            <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Output Amount (Mocked expectation) */}
        <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">You receive</span>
          </div>
          <div className="flex items-center gap-3">
            <Input 
              type="text"
              readOnly
              placeholder="0.00"
              value={amount ? (parseFloat(amount) * (side === 'BUY' ? 0.5 : 2.0)).toFixed(2) : ''}
              className="border-0 bg-transparent text-3xl p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/30 font-semibold text-muted-foreground"
            />
            <div className="shrink-0 flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border border-border/50">
              <div className="w-5 h-5 rounded-full bg-emerald-500"></div>
              <span className="font-medium">{side === 'BUY' ? 'TOKEN' : 'USDC'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 py-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 cursor-help">Slippage Tolerance <Info className="h-3 w-3" /></span>
            <div className="flex gap-2">
              {['0.1', '0.5', '1.0'].map(val => (
                <button 
                  key={val} 
                  type="button" 
                  onClick={() => setSlippage(val)}
                  className={`px-1.5 rounded ${slippage === val ? 'bg-primary/20 text-primary' : 'hover:text-foreground'}`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Price Impact</span>
            <span className="text-emerald-400">{'< 0.1%'}</span>
          </div>
        </div>

        <Button 
          type="submit" 
          size="lg" 
          className={`w-full text-lg font-semibold h-14 ${side === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
          disabled={!amount}
        >
          Review Order
        </Button>
      </form>
    </Card>
  );
}
