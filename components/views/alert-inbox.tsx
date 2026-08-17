import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BellRing, Check, ShieldAlert, TrendingUp, Wallet, EyeOff } from 'lucide-react';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData } from '@/lib/api/response';

/** Matches the event DTO returned by `/api/v1/alerts`. */
interface Alert {
  id: string;
  ruleId: string;
  category: string | null;
  severity: string | null;
  title: string | null;
  summary: string | null;
  token: string | null;
  readState: string;
  timestamp: string;
}

export function AlertInbox() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'CRITICAL' | 'SMART' | 'MARKET'>('ALL');

  // Reads the real event feed. Previously `/api/alerts`, an unversioned route
  // that returned one hardcoded alert to every caller regardless of auth.
  useEffect(() => {
    fetch(apiUrl(endpoints.alerts.events, { limit: 50 }), { credentials: 'include' })
      .then(res => readApiData<{ alerts: Alert[] }>(res))
      .then(data => {
        if (data.alerts) setAlerts(data.alerts);
      })
      .catch(err => console.error('Failed to load alerts', err));
  }, []);

  const markAsRead = (id: string) => {
    const previous = alerts;
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, readState: 'READ' } : a));
    // The old POST logged to the server console and returned success without
    // writing anything, so the change never survived a refresh.
    fetch(apiUrl(endpoints.alerts.event(id)), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ readState: 'READ' })
    })
      .then(res => { if (!res.ok) setAlerts(previous); })
      .catch(() => setAlerts(previous));
  };

  const getIcon = (category: string | null) => {
    switch (category) {
      case 'SECURITY': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'VOLUME':
      case 'PRICE': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'WALLET': return <Wallet className="w-5 h-5 text-blue-500" />;
      default: return <BellRing className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'CRITICAL') return a.severity === 'CRITICAL';
    if (activeTab === 'SMART') return a.category ? ['VOLUME', 'LIQUIDITY', 'OWNERSHIP'].includes(a.category) : false;
    if (activeTab === 'MARKET') return a.category === 'MARKET';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-background border-r w-96">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BellRing className="w-5 h-5" />
          Inbox
        </h2>
        <Badge variant="secondary">{alerts.filter(a => a.readState === 'UNREAD').length} new</Badge>
      </div>

      <div className="flex p-2 gap-2 border-b overflow-x-auto">
        <Button variant={activeTab === 'ALL' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('ALL')}>All</Button>
        <Button variant={activeTab === 'CRITICAL' ? 'destructive' : 'ghost'} size="sm" onClick={() => setActiveTab('CRITICAL')}>Critical</Button>
        <Button variant={activeTab === 'SMART' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('SMART')}>Smart</Button>
        <Button variant={activeTab === 'MARKET' ? 'default' : 'ghost'} size="sm" onClick={() => setActiveTab('MARKET')}>Market</Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-2">
          {filteredAlerts.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">No alerts found</div>
          ) : (
            filteredAlerts.map(alert => (
              <Card key={alert.id} className={`cursor-pointer transition-colors hover:bg-muted/50 ${alert.readState === 'UNREAD' ? 'border-primary/50' : 'opacity-70'}`}>
                <CardHeader className="p-3 pb-0 flex flex-row items-center gap-3 space-y-0">
                  {getIcon(alert.category)}
                  <div className="flex-1 font-medium">{alert.title || alert.summary || 'Threat Alert'}</div>
                  {alert.readState === 'UNREAD' && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markAsRead(alert.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-3 pt-2 text-sm text-muted-foreground">
                  {alert.summary && <p className="text-xs text-slate-300">{alert.summary}</p>}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="secondary" className="w-full">Review</Button>
                    <Button size="sm" variant="outline" className="w-full">Dismiss</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
