'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ArrowRight, CheckCircle2, XCircle, FileWarning } from 'lucide-react';

interface AuditLogEvent {
  id: string;
  token: string;
  leaderAction: string;
  leaderAmountUsd: number;
  decision: 'COPY' | 'COPY_WITH_REDUCTION' | 'SKIP';
  followerAmountUsd: number;
  reason: string;
  timestamp: string;
}

export function CopyAuditLog({ events }: { events: AuditLogEvent[] }) {
  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      <h3 className="text-lg font-semibold tracking-wide flex items-center gap-2">
        <FileWarning className="w-5 h-5 text-muted-foreground" />
        Copy Audit Log
      </h3>
      
      <div className="grid gap-3">
        {events.map(event => (
          <Card key={event.id} className="p-4 border-border/50 bg-background/50">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {event.decision === 'COPY' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {event.decision === 'COPY_WITH_REDUCTION' && <ShieldAlert className="w-5 h-5 text-amber-500" />}
                {event.decision === 'SKIP' && <XCircle className="w-5 h-5 text-rose-500" />}
                
                <div>
                  <h4 className="font-bold">{event.token}</h4>
                  <p className="text-xs text-muted-foreground">{event.timestamp}</p>
                </div>
              </div>
              
              <Badge variant={
                event.decision === 'COPY' ? 'success' : 
                event.decision === 'SKIP' ? 'danger' : 'warning'
              }>
                {event.decision.replace(/_/g, ' ')}
              </Badge>
            </div>

            <div className="bg-secondary/30 rounded-lg p-3 text-sm flex items-center justify-between mb-3 border border-border/50">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Leader {event.leaderAction}</p>
                <p className="font-mono font-medium">${event.leaderAmountUsd.toLocaleString()}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Your Execution</p>
                <p className={`font-mono font-medium ${event.followerAmountUsd === 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ${event.followerAmountUsd.toLocaleString()}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic leading-relaxed bg-background/50 p-2 rounded border border-border/30">
              <span className="font-semibold text-foreground not-italic mr-1">Reason:</span> 
              {event.reason}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
