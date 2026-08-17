import React from 'react';
import { ExecutionRoute } from '@/lib/execution/types';

interface RouteVisualizerProps {
  routes: ExecutionRoute[];
}

export function RouteVisualizer({ routes }: RouteVisualizerProps) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="space-y-4 p-4 border rounded-md bg-muted/20">
      <h4 className="text-sm font-medium text-muted-foreground">Execution Path</h4>
      <div className="space-y-3">
        {routes.map((route, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="text-xs font-bold text-primary w-12">{route.splitPercentage}%</div>
            <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-2">
              {route.legs.map((leg, j) => (
                <React.Fragment key={j}>
                  <div className="flex items-center gap-1 bg-background border px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                    {leg.tokenIn}
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-2xs text-muted-foreground leading-none">{leg.dexVenue}</span>
                    <span className="text-muted-foreground">→</span>
                  </div>
                  {j === route.legs.length - 1 && (
                    <div className="flex items-center gap-1 bg-background border px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                      {leg.tokenOut}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
