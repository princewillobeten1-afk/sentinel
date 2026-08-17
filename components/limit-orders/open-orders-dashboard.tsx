'use client';

import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, ShieldCheck, ShieldAlert, RefreshCw, X, HelpCircle, Check, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LimitOrder, ConditionEvaluationReport } from '@/lib/limit-order/types';

interface OpenOrdersDashboardProps {
  currentPrice: number;
}

export function OpenOrdersDashboard({ currentPrice }: OpenOrdersDashboardProps) {
  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDiagnosticOrderId, setSelectedDiagnosticOrderId] = useState<string | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<ConditionEvaluationReport | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/limit-orders?currentPrice=${currentPrice}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Failed to fetch limit orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice]);

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/limit-orders/${orderId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      }
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  };

  const handleRunDiagnostics = async (orderId: string) => {
    setSelectedDiagnosticOrderId(orderId);
    setIsEvaluating(true);
    try {
      const res = await fetch(`/api/v1/limit-orders/${orderId}/conditions?currentPrice=${currentPrice}`);
      const data = await res.json();
      if (data.success) {
        setDiagnosticReport(data.report);
      }
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="rounded-xl border border-sentinel-750 bg-sentinel-850 p-4 space-y-3">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white">Active Persistent Limit Orders</h3>
          <Badge variant="risk-low" size="sm">{orders.filter(o => o.status === 'OPEN' || o.status === 'MONITORING' || o.status === 'WAITING_FOR_SAFETY').length} Active</Badge>
        </div>
        <Button variant="ghost" size="xs" onClick={fetchOrders} leftIcon={<RefreshCw className="w-3 h-3" />}>
          Refresh
        </Button>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 font-mono animate-pulse">
          Loading active limit orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-sentinel-750 rounded-xl font-mono">
          No open limit orders. Click &quot;LIMIT&quot; in the terminal execution panel to create one.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-numeric border-collapse">
            <thead>
              <tr className="border-b border-sentinel-750 text-2xs text-slate-400 font-mono uppercase">
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Target Price</th>
                <th className="py-2 px-3">Current</th>
                <th className="py-2 px-3">Distance</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Health / Status</th>
                <th className="py-2 px-3 text-right">Actions / Diagnostics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sentinel-800">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-sentinel-800/30 transition">
                  <td className="py-2.5 px-3">
                    <span className={`font-bold uppercase ${ord.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      LIMIT {ord.side}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-white">
                    ${ord.targetPrice.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    ${currentPrice.toFixed(4)}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    <span className={ord.distancePct && ord.distancePct < 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                      {ord.distancePct !== undefined ? `${ord.distancePct > 0 ? '+' : ''}${ord.distancePct}%` : '-'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-200">
                    {ord.amountIn} SOL
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-2xs font-mono uppercase ${
                        ord.status === 'WAITING_FOR_SAFETY' 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                          : ord.status === 'FILLED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : ord.status === 'CANCELLED'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-sky-500/20 text-sky-300'
                      }`}>
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRunDiagnostics(ord.id)}
                        className="text-2xs text-sky-400 hover:text-sky-300 underline font-mono flex items-center gap-1"
                      >
                        <HelpCircle className="w-3 h-3" /> Why isn&apos;t this executing?
                      </button>

                      {ord.status !== 'FILLED' && ord.status !== 'CANCELLED' && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleCancelOrder(ord.id)}
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* "Why Isn't My Order Executing?" Diagnostic Modal */}
      {selectedDiagnosticOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-sentinel-850 w-full max-w-md rounded-2xl border border-sentinel-700 shadow-2xl p-5 space-y-4">
            
            <div className="flex items-center justify-between border-b border-sentinel-750 pb-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <HelpCircle className="w-5 h-5" /> Condition Diagnostics Report
              </div>
              <button
                onClick={() => {
                  setSelectedDiagnosticOrderId(null);
                  setDiagnosticReport(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isEvaluating || !diagnosticReport ? (
              <div className="py-8 text-center text-xs text-slate-400 font-mono animate-pulse">
                Evaluating real-time safety guardrails & market condition streams...
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                  diagnosticReport.passed
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                }`}>
                  {diagnosticReport.passed ? (
                    <ShieldCheck className="w-6 h-6 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {diagnosticReport.passed ? 'Execution Conditions Passed' : 'Execution Halted by Safety Guardrails'}
                    </h4>
                    <p className="text-2xs opacity-90 mt-0.5">
                      {diagnosticReport.passed
                        ? 'All target price and safety condition checks passed.'
                        : 'Price target or safety guardrails are currently blocking automatic execution.'}
                    </p>
                  </div>
                </div>

                {/* Condition Breakdown List */}
                <div className="space-y-2">
                  <span className="text-2xs text-slate-400 uppercase font-mono tracking-wider">Live Condition Checklist</span>
                  
                  {diagnosticReport.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-sentinel-800 bg-sentinel-900 flex items-center justify-between gap-3 font-numeric"
                    >
                      <div className="flex items-center gap-2">
                        {item.status === 'PASSED' ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : item.status === 'FAILED' ? (
                          <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                            <X className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                            <Ban className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-200">{item.label}</p>
                          <p className="text-2xs text-slate-400">{item.message}</p>
                        </div>
                      </div>

                      <div className="text-right font-mono text-2xs">
                        <span className="text-slate-400 block text-2xs">Req: {item.required}</span>
                        <span className={`font-bold ${item.status === 'PASSED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {item.current}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-sentinel-750 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDiagnosticOrderId(null);
                      setDiagnosticReport(null);
                    }}
                  >
                    Close Report
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
