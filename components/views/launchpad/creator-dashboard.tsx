import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Activity, Users, AlertTriangle } from 'lucide-react';

export function CreatorDashboard() {
  const [stats, setStats] = useState({
    reputation: 78,
    launches: 14,
    successful: 8,
    highRisk: 2,
    organicAvg: 81
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Creator Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your launches and monitor your reputation.</p>
        </div>
        <div className="flex items-center gap-4 bg-muted px-4 py-2 rounded-lg">
          <ShieldCheck className="w-8 h-8 text-green-500" />
          <div>
            <div className="text-sm font-medium text-muted-foreground">Reputation Score</div>
            <div className="text-xl font-bold text-green-500">{stats.reputation} / 100</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Launches</div>
            <div className="text-3xl font-bold mt-2">{stats.launches}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Graduated / Successful</div>
            <div className="text-3xl font-bold mt-2 text-green-500">{stats.successful}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Flagged High-Risk</div>
            <div className="text-3xl font-bold mt-2 text-red-500">{stats.highRisk}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Avg. Organic Score</div>
            <div className="text-3xl font-bold mt-2">{stats.organicAvg}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Launches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Mocked row */}
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary">SNT</div>
                <div>
                  <div className="font-semibold">Sentinel (SNT)</div>
                  <div className="text-sm text-muted-foreground">Launched 2 days ago</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Fairness</div>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-600">91 / 100</Badge>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant="default">TRADING</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
