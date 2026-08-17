import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface AlertStoryProps {
  alertId: string;
}

export function AlertStoryView({ alertId }: AlertStoryProps) {
  const [story, setStory] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/v1/alerts/${alertId}`)
      .then(res => res.json())
      .then(data => setStory(data));
  }, [alertId]);

  if (!story) return <div>Loading story...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4 border-b pb-4">
        <span className="text-4xl">🚨</span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-red-500">{story.title}</h1>
          <p className="text-muted-foreground">Detailed event correlation and timeline.</p>
        </div>
      </div>

      <Card className="border-red-500/50 bg-red-500/5">
        <CardHeader>
          <CardTitle className="text-lg">AI Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed font-medium">
            {story.aiExplanation}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Event Timeline</h3>
        <div className="relative border-l border-border ml-3 space-y-6 pl-6">
          {story.timeline.map((fact: any, i: number) => (
            <div key={i} className="relative">
              <span className="absolute -left-[33px] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
              <div className="text-sm font-medium text-muted-foreground">
                {new Date(fact.timestamp).toLocaleTimeString()}
              </div>
              <div className="mt-1 font-medium">
                {fact.metricName} changed from <span className="text-muted-foreground">{fact.previousValue}</span> to <span className="font-bold">{fact.newValue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        {story.suggestedActions.map((action: string) => (
          <button key={action} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80">
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
