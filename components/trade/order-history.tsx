'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { Order } from '@/lib/order/service';

interface OrderHistoryProps {
  orders: Order[];
}

export function OrderHistory({ orders }: OrderHistoryProps) {
  
  if (orders.length === 0) {
    return (
      <Card>
        <div className="py-8 text-center text-muted-foreground">
          No orders found.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id} className="overflow-hidden border-border/50">
          <div className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-secondary/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold ${order.side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {order.side}
                </span>
                <span className="font-bold">{order.amount} {order.tokenIn}</span>
                <span className="text-muted-foreground text-sm">for</span>
                <span className="font-bold">{order.route?.expectedOutput || '?'} {order.tokenOut}</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Order ID: {order.id.slice(0, 8)}...
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {order.status === 'FILLED' && <Badge variant="success" className="bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Filled</Badge>}
              {order.status === 'FAILED' && <Badge variant="danger" className="bg-destructive/10 text-destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>}
              {order.status === 'CANCELLED' && <Badge variant="neutral">Cancelled</Badge>}
              {['CREATED', 'QUOTING', 'RISK_CHECK', 'SIMULATING', 'AWAITING_SIGNATURE', 'SIGNED', 'SUBMITTED', 'EXECUTING', 'PARTIALLY_FILLED'].includes(order.status) && (
                <Badge variant="warning" className="bg-amber-500/10 text-amber-500">Pending</Badge>
              )}
            </div>
          </div>
          
          {(order.status === 'FILLED' || order.status === 'FAILED') && order.executionRecords.length > 0 && (
            <div className="p-4 border-t border-border/50 text-sm bg-background">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Execution Price</p>
                  <p className="font-medium">${order.route?.executionPrice?.toFixed(4) || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Price Impact</p>
                  <p className="font-medium">{order.route?.priceImpact?.toFixed(2) || '-'}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Network Fee</p>
                  <p className="font-medium">${order.route?.gas?.usdValue?.toFixed(3) || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Transaction</p>
                  {order.executionRecords[order.executionRecords.length - 1]?.transactionHash ? (
                    <a href="#" className="text-blue-400 hover:underline flex items-center gap-1 font-mono text-xs">
                      {order.executionRecords[order.executionRecords.length - 1].transactionHash?.slice(0, 6)}...
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-muted-foreground">-</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
