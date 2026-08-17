import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Activity, Users, AlertTriangle, TrendingUp, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { endpoints, apiUrl } from '@/lib/api/endpoints';
import { readApiData } from '@/lib/api/response';

export function LaunchTokenView({ launchId = 'mock-id' }: { launchId?: string }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [ownership, setOwnership] = useState<any>(null);
  const [risk, setRisk] = useState<any>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Reads the launch endpoints that actually exist.
   *
   * This previously fetched `/api/launches/:id/analytics`, `/ownership` and
   * `/risk`. There is no `app/api/launches` directory — all three 404'd, and
   * because the guard below waits for all three to be non-null, the view sat on
   * "Loading launch intelligence..." forever with no error shown.
   *
   * `/api/v1/launches/:id` and `/:id/intelligence` are the real routes. Note
   * that both are still server-side stubs: the launch detail route returns a
   * fixed "Mock Token Alpha" payload and `getLaunchIntelligence` returns five
   * constants. The wiring is now correct, but the ownership and analytics
   * breakdowns this view renders have no backing data model yet.
   */
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(apiUrl(endpoints.launches.byId(launchId)), { credentials: 'include' }),
      fetch(apiUrl(endpoints.launches.intelligence(launchId)), { credentials: 'include' }),
    ])
      .then(([detailRes, intelRes]) =>
        Promise.all([
          readApiData<any>(detailRes, `Launch ${launchId} could not be loaded`),
          readApiData<any>(intelRes, `Launch ${launchId} intelligence could not be loaded`),
        ]),
      )
      .then(([detail, intel]) => {
        if (cancelled) return;
        setAnalytics({
          liquidity: Number(detail?.bondingCurve?.reserveBalance ?? 0),
          organicParticipation: intel?.organicVolume ?? null,
        });
        setRisk({
          riskScore: intel?.integrity ?? null,
          fairnessScore: intel?.exitability ?? null,
          warnings: [],
          strengths: [],
        });
        // No ownership endpoint exists; rendered as unavailable rather than faked.
        setOwnership(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [launchId]);

  if (loadError) {
    return <div className="p-8 text-center text-muted-foreground">{loadError}</div>;
  }

  // Only the fields that have a real source are required to render.
  if (!analytics || !risk) {
    return <div className="p-8 text-center text-muted-foreground">Loading launch intelligence...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center font-bold text-xl text-primary">SNT</div>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                Sentinel <Badge variant="secondary">SNT</Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Smart Token Infrastructure</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500"/> Risk: {risk.riskScore}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500"/> Organic: {analytics.organicParticipation}
          </Badge>
          <Badge variant="outline" className="px-3 py-1 text-sm flex items-center gap-2 bg-primary/10">
            <Users className="w-4 h-4"/> Fairness: {risk.fairnessScore}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Stats & Risk */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Executable Liquidity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${analytics.liquidity.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Locked for 180 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="w-5 h-5 text-amber-500"/> Risk Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2 text-green-500">Strengths</div>
                <ul className="space-y-1">
                  {risk.strengths.map((s: string, i: number) => <li key={i} className="text-sm flex items-start gap-2">✓ {s}</li>)}
                </ul>
              </div>
              {risk.warnings.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-sm font-medium mb-2 text-amber-500">Warnings</div>
                  <ul className="space-y-1">
                    {risk.warnings.map((w: string, i: number) => <li key={i} className="text-sm flex items-start gap-2">⚠ {w}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle Column: Ownership */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Effective Ownership</span>
                <span className="text-sm font-normal text-muted-foreground flex items-center gap-1"><Info className="w-4 h-4"/> Live Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* No ownership-breakdown endpoint exists yet. Saying so beats
                  rendering four bars of invented percentages — and beats the
                  crash that dereferencing a null ownership object produced. */}
              {!ownership ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Ownership breakdown is not available for this launch yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Creator &amp; Team</span>
                      <span>{ownership.creator + ownership.knownTeam}%</span>
                    </div>
                    <Progress value={ownership.creator + ownership.knownTeam} className="h-2 bg-muted" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Top 50 Holders</span>
                      <span>{ownership.topHolders}%</span>
                    </div>
                    <Progress value={ownership.topHolders} className="h-2 bg-muted" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-amber-500">Suspected Clusters <Info className="w-3 h-3"/></span>
                      <span className="text-amber-500">{ownership.suspectedClusters}%</span>
                    </div>
                    <Progress value={ownership.suspectedClusters} className="h-2 bg-muted [&>div]:bg-amber-500" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Liquidity Pool</span>
                      <span>{ownership.liquidity}%</span>
                    </div>
                    <Progress value={ownership.liquidity} className="h-2 bg-muted [&>div]:bg-blue-500" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Placeholder for Trading Interface */}
          <Card className="border-primary/50">
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <Activity className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2">Trading Terminal</h3>
              <p className="text-muted-foreground max-w-md">The standard Sentinel trading terminal is embedded here, utilizing the Bonding Curve or DEX Liquidity depending on the token&apos;s launch phase.</p>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
