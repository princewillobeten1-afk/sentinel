'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { TransactionIntent } from '@/lib/transaction/simulator';

interface TransactionPreviewProps {
  intent: TransactionIntent;
  simulationStatus: 'simulating' | 'passed' | 'failed';
  expectedReceive?: string;
  minimumReceive?: string;
  priceImpact?: string;
  networkFee?: string;
  route?: string;
  simulationError?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function TransactionPreview({
  intent,
  simulationStatus,
  expectedReceive,
  minimumReceive,
  priceImpact,
  networkFee,
  route,
  simulationError,
  onConfirm,
  onCancel,
  isSubmitting
}: TransactionPreviewProps) {
  
  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="text-center pb-2">
        <h3 className="text-xl font-bold">Confirm Transaction</h3>
      </div>
      <div className="space-y-6">
        
        <div className="text-center p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">You&apos;re authorizing</p>
          <p className="text-lg font-semibold">{intent.humanReadable}</p>
        </div>

        <div className="space-y-3 text-sm">
          {expectedReceive && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Expected receive:</span>
              <span className="font-medium text-emerald-500">{expectedReceive}</span>
            </div>
          )}
          {minimumReceive && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Minimum receive:</span>
              <span className="font-medium">{minimumReceive}</span>
            </div>
          )}
          {priceImpact && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Price impact:</span>
              <span className={parseFloat(priceImpact) > 2 ? 'text-amber-500' : ''}>{priceImpact}%</span>
            </div>
          )}
          {networkFee && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Network fee:</span>
              <span>{networkFee}</span>
            </div>
          )}
          {route && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Route:</span>
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{route}</span>
            </div>
          )}
        </div>

        <div className={`p-3 rounded-md border flex items-start gap-3 ${
          simulationStatus === 'simulating' ? 'bg-muted/50 border-muted' :
          simulationStatus === 'passed' ? 'bg-emerald-500/10 border-emerald-500/20' :
          'bg-destructive/10 border-destructive/20'
        }`}>
          {simulationStatus === 'simulating' && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-0.5" />}
          {simulationStatus === 'passed' && <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />}
          {simulationStatus === 'failed' && <XCircle className="w-5 h-5 text-destructive mt-0.5" />}
          
          <div className="flex-1">
            <h4 className={`text-sm font-semibold ${
              simulationStatus === 'simulating' ? 'text-muted-foreground' :
              simulationStatus === 'passed' ? 'text-emerald-500' : 'text-destructive'
            }`}>
              {simulationStatus === 'simulating' ? 'Simulating Transaction...' :
               simulationStatus === 'passed' ? 'Simulation Passed' : 'Simulation Failed'}
            </h4>
            {simulationStatus === 'failed' && simulationError && (
              <p className="text-xs mt-1 text-destructive/80 leading-relaxed">
                {simulationError}
              </p>
            )}
          </div>
        </div>

      </div>
      <div className="flex gap-3 pt-2 mt-4">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button 
          className="flex-1" 
          onClick={onConfirm} 
          disabled={simulationStatus !== 'passed' || isSubmitting}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Sign Transaction
        </Button>
      </div>
    </Card>
  );
}
