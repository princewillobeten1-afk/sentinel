'use client';

import React from 'react';
import { TokenDiscoveryCard } from './token-card';
import type { DiscoveryToken } from '@/lib/discovery/types';

interface DiscoveryMobileCardProps {
  token: DiscoveryToken;
}

export function DiscoveryMobileCard({ token }: DiscoveryMobileCardProps) {
  return <TokenDiscoveryCard token={token} variant="compact" />;
}
