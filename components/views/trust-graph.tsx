import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EntityType, TrustGraphData } from '@/lib/trust/types';

// NOTE: In a full implementation, this would use react-flow or vis.js.
// For this UI, we present a dense tabular/list view mapping the relationships for clarity.

export function TrustGraphVisualizer({ entityType, entityId }: { entityType: EntityType, entityId: string }) {
  const [graph, setGraph] = useState<TrustGraphData | null>(null);

  useEffect(() => {
    fetch(`/api/v1/trust/${entityType}/${entityId}/relationships`)
      .then(r => r.json())
      .then(setGraph);
  }, [entityType, entityId]);

  if (!graph) return <div>Loading Graph...</div>;

  const getEntityLabel = (id: string) => graph.nodes.find(n => n.id === id)?.label || id;
  const getEntityType = (id: string) => graph.nodes.find(n => n.id === id)?.type || 'UNKNOWN';
  
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Trust Graph Connections</CardTitle>
      </CardHeader>
      <CardContent>
        {graph.edges.length === 0 ? (
          <div className="text-muted-foreground text-sm">No known connections found.</div>
        ) : (
          <div className="space-y-4">
            {graph.edges.map((edge, idx) => (
              <div key={idx} className="p-3 border rounded bg-muted/30">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono bg-secondary px-2 py-1 rounded text-xs">{getEntityLabel(edge.sourceId)}</span>
                    <span className="text-xs font-bold text-primary">→ {edge.relationshipType} →</span>
                    <span className="font-mono bg-secondary px-2 py-1 rounded text-xs">{getEntityLabel(edge.targetId)}</span>
                  </div>
                  <div className={`text-xs font-bold ${edge.confidence > 90 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {edge.confidence}% Confidence
                  </div>
                </div>
                <div className="text-xs text-muted-foreground pl-1 border-l-2 border-primary/20">
                  <span className="font-bold mr-1">Evidence:</span> 
                  {edge.evidence.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
