'use client';

import { useEffect, useState } from 'react';
import { BirdeyeWSClient } from '@/lib/api/birdeye/ws';
import { getBirdeyeWsToken } from '@/lib/actions/birdeye';

// Global singleton instance
let globalWsClient: BirdeyeWSClient | null = null;
let initPromise: Promise<BirdeyeWSClient> | null = null;

export function useBirdeyeWS() {
  const [client, setClient] = useState<BirdeyeWSClient | null>(globalWsClient);
  const [isReady, setIsReady] = useState(!!globalWsClient);

  useEffect(() => {
    if (globalWsClient) {
      setClient(globalWsClient);
      setIsReady(true);
      return;
    }

    if (!initPromise) {
      initPromise = (async () => {
        const apiKey = await getBirdeyeWsToken();
        const newClient = new BirdeyeWSClient(apiKey);
        await newClient.connect();
        return newClient;
      })();
    }

    initPromise.then((resolvedClient) => {
      globalWsClient = resolvedClient;
      setClient(resolvedClient);
      setIsReady(true);
    }).catch((err) => {
      console.error('Failed to initialize Birdeye WS Client', err);
      initPromise = null;
    });
  }, []);

  return { client, isReady };
}
