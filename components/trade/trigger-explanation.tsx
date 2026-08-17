import React from 'react';
import { Card } from '@/components/ui/card';
import { Target, Activity, Clock, ShieldCheck } from 'lucide-react';

interface TriggerExplanationProps {
  orderType: string;
  token: string;
  triggerPrice: number;
  actualPrice: number;
  source: string;
  latencyMs: number;
}

export function TriggerExplanation({ orderType, token, triggerPrice, actualPrice, source, latencyMs }: TriggerExplanationProps) {
  return (
    <Card className="p-5 border-border/50 bg-background/95 max-w-sm">
      <div className="flex items-center gap-2 mb-4 text-emerald-500">
        <ShieldCheck className="w-5 h-5" />
        <h4 className="font-semibold uppercase tracking-wider text-sm">{orderType} Triggered</h4>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Why?</p>
          <p className="text-sm">
            <span className="font-bold">{token}</span> reached <span className="font-bold text-primary">${actualPrice.toFixed(4)}</span>
          </p>
        </div>

        <div className="bg-secondary/30 rounded-lg p-3 space-y-2 border border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Your Target</span>
            <span className="font-medium">${triggerPrice.toFixed(4)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Source</span>
            <span className="font-medium text-xs">{source}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Engine Latency</span>
            <span className="font-medium text-emerald-400">{latencyMs}ms</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic leading-relaxed">
          Order was instantly validated against risk parameters and executed via Sentinel&apos;s routing engine.
        </p>
      </div>
    </Card>
  );
}
