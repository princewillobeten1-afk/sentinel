import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function TrustBadge({ badgeType, description }: { badgeType: string, description?: string }) {
  const isWarning = badgeType.includes('⚠') || badgeType.includes('🚨');
  const baseColor = isWarning ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className={`px-2 py-1 text-xs font-bold rounded border cursor-pointer ${baseColor}`}>
          {badgeType}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm">
        <div className="font-bold mb-1">Badge: {badgeType}</div>
        <div className="text-muted-foreground">{description || 'Automated trust evaluation based on historical on-chain evidence.'}</div>
        <div className="mt-2 text-xs opacity-50">Sentinel Trust Graph v1.0.0</div>
      </PopoverContent>
    </Popover>
  );
}
