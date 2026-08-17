import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrustBadge } from '@/components/ui/trust-badge';
import { EntityType, ReputationProfile } from '@/lib/trust/types';

export function ReputationProfileView({ entityType, entityId }: { entityType: EntityType, entityId: string }) {
  const [profile, setProfile] = useState<ReputationProfile | null>(null);

  useEffect(() => {
    fetch(`/api/v1/reputation/${entityType}/${entityId}`)
      .then(r => r.json())
      .then(setProfile);
  }, [entityType, entityId]);

  if (!profile) return <div>Loading Reputation Profile...</div>;

  const isUnknown = profile.reputationCategory === 'UNKNOWN' || profile.reputationCategory === 'NEW';
  const scoreDisplay = profile.overallScore !== null ? profile.overallScore : 'N/A';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start border-b pb-4">
        <div>
          <div className="text-sm font-medium text-muted-foreground uppercase">{profile.entityType} REPUTATION</div>
          <h1 className="text-3xl font-bold font-mono">{profile.entityId}</h1>
          <div className="flex gap-2 mt-2">
            {profile.badges.map(b => <TrustBadge key={b} badgeType={b} />)}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${isUnknown ? 'text-muted-foreground' : (profile.overallScore! > 70 ? 'text-green-500' : 'text-primary')}`}>
            {scoreDisplay}
            {profile.overallScore !== null && <span className="text-lg text-muted-foreground">/100</span>}
          </div>
          <div className="text-sm font-medium mt-1">Confidence: <span className={profile.confidenceLevel === 'HIGH' ? 'text-green-500' : 'text-yellow-500'}>{profile.confidenceLevel}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Dimensions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isUnknown ? (
              <div className="text-muted-foreground text-sm">Insufficient history to calculate dimensions.</div>
            ) : (
              profile.dimensions.map(d => (
                <div key={d.dimension} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{d.dimension}</span>
                  <div className="flex items-center gap-2 w-1/2">
                    <div className="w-full bg-secondary h-2 rounded overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${Math.max(0, Math.min(100, d.score))}%` }} />
                    </div>
                    <span className="text-xs font-bold w-6 text-right">{Math.max(0, Math.min(100, d.score))}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top Evidence</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {profile.topEvidence.length === 0 ? (
              <div className="text-muted-foreground text-sm">No significant evidence on record.</div>
            ) : (
              profile.topEvidence.map(ev => (
                <div key={ev.id} className="border-l-2 pl-3 py-1 space-y-1" style={{ borderLeftColor: ev.impact > 0 ? 'green' : 'red' }}>
                  <div className="text-sm font-bold">{ev.claim}</div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{ev.source}</span>
                    <span>Confidence: {ev.confidenceScore}%</span>
                  </div>
                </div>
              ))
            )}
            <button className="text-xs text-primary font-bold hover:underline">View Full Evidence Log →</button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
