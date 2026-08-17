'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ShieldAlert, Loader2, ArrowRight } from 'lucide-react';
import { OrderStatus } from '@/lib/order/service';

interface OrderReviewProps {
  orderData: any;
  status: OrderStatus;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

export function OrderReview({ orderData, status, onConfirm, onCancel, isExecuting }: OrderReviewProps) {
  const { quote, side, tokenIn, tokenOut, amount, riskResult } = orderData;
  const isBlocked = riskResult?.decision === 'BLOCK';
  
  return (
    <Card className="w-full max-w-md mx-auto p-4 border-border/50 bg-background/95 backdrop-blur shadow-2xl">
      <div className="text-center pb-4 border-b border-border/50 mb-4">
        <h3 className="text-xl font-bold uppercase tracking-wide">Review {side} Order</h3>
      </div>
      
      <div className="space-y-6">
        
        {/* Assets Flow */}
        <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl">
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Spend</p>
            <p className="font-semibold text-lg">{amount} {tokenIn}</p>
          </div>
          <div className="text-muted-foreground px-4">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Receive</p>
            <p className="font-semibold text-lg text-emerald-400">~{quote.expectedOutput} {tokenOut}</p>
          </div>
        </div>

        {/* Execution Details */}
        <div className="space-y-3 text-sm px-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Minimum receive</span>
            <span className="font-medium">{quote.minimumOutput} {tokenOut}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price impact</span>
            <span className={quote.priceImpact > 2 ? 'text-amber-500 font-medium' : ''}>{quote.priceImpact}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network fee</span>
            <span>~${quote.gas.usdValue.toFixed(3)}</span>
          </div>
        </div>

        {/* Risk & Simulation status */}
        <div className="space-y-2">
          {/* Risk */}
          <div className={`p-3 rounded-lg border flex items-start gap-3 ${
            riskResult?.decision === 'BLOCK' ? 'bg-destructive/10 border-destructive/20' :
            riskResult?.decision === 'WARN' ? 'bg-amber-500/10 border-amber-500/20' :
            'bg-emerald-500/10 border-emerald-500/20'
          }`}>
            {riskResult?.decision === 'ALLOW' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <ShieldAlert className={`w-5 h-5 mt-0.5 shrink-0 ${riskResult?.decision === 'BLOCK' ? 'text-destructive' : 'text-amber-500'}`} />
            )}
            <div>
              <p className={`text-sm font-semibold ${
                riskResult?.decision === 'BLOCK' ? 'text-destructive' :
                riskResult?.decision === 'WARN' ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                Risk Engine: {riskResult?.decision}
              </p>
              {riskResult?.reasoning.map((r: string, i: number) => (
                <p key={i} className="text-xs text-muted-foreground mt-1">{r}</p>
              ))}
            </div>
          </div>

          {/* Simulation */}
          <div className={`p-3 rounded-lg border flex items-center gap-3 ${
            status === 'SIMULATING' ? 'bg-muted/50 border-muted' : 'bg-emerald-500/10 border-emerald-500/20'
          }`}>
            {status === 'SIMULATING' ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            )}
            <p className={`text-sm font-semibold ${status === 'SIMULATING' ? 'text-muted-foreground' : 'text-emerald-500'}`}>
              {status === 'SIMULATING' ? 'Simulating Transaction...' : 'Simulation Passed'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-6 mt-2">
        <Button variant="outline" className="flex-1 h-12" onClick={onCancel} disabled={isExecuting}>
          Cancel
        </Button>
        <Button 
          className="flex-1 h-12 text-md font-semibold" 
          onClick={onConfirm} 
          disabled={isExecuting || isBlocked || status === 'SIMULATING'}
        >
          {isExecuting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {isExecuting ? 'Executing...' : 'Confirm Order'}
        </Button>
      </div>
    </Card>
  );
}
