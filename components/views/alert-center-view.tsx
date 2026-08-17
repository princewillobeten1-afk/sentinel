import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertSeverity } from '@/lib/alert/types';

export function AlertCenterView() {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    // Stub fetch
    fetch('/api/v1/alerts')
      .then(res => res.json())
      .then(data => setAlerts(data));
  }, []);

  const criticalCount = alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length;
  const highCount = alerts.filter(a => a.severity === AlertSeverity.HIGH).length;
  const mediumCount = alerts.filter(a => a.severity === AlertSeverity.MEDIUM).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alert Center</h1>
        <p className="text-muted-foreground">Smart event correlation and intelligence summaries.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <span className="text-red-500 font-bold">🔴</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
            <span className="text-orange-500 font-bold">🟠</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{highCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium</CardTitle>
            <span className="text-yellow-500 font-bold">🟡</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{mediumCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <Card key={alert.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="text-2xl">
                {alert.severity === AlertSeverity.CRITICAL ? '🚨' : 
                 alert.title.includes('SMART MONEY') ? '🧠' : '🐋'}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{alert.token} — {alert.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{alert.summary}</p>
                <div className="flex gap-2 pt-2">
                  <button className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded">
                    View Token
                  </button>
                  <button className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded">
                    Dismiss
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
