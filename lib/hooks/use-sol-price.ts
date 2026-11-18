'use client';

import { useState, useEffect } from 'react';

let cachedSolPrice: number | null = null;
let lastAttemptAt = 0;
let inFlight: Promise<number | null> | null = null;
const CACHE_TTL_MS = 30_000;
const ERROR_RETRY_MS = 15_000;
const listeners = new Set<(price: number | null) => void>();

function fetchSharedSolPrice(): Promise<number | null> {
  const now = Date.now();
  const ttl = cachedSolPrice !== null ? CACHE_TTL_MS : ERROR_RETRY_MS;
  if (lastAttemptAt > 0 && now - lastAttemptAt < ttl) {
    return Promise.resolve(cachedSolPrice);
  }
  if (inFlight) return inFlight;

  inFlight = fetch('/api/v1/market/sol-price')
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      const val = body?.data?.solPriceUsd;
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        cachedSolPrice = val;
        listeners.forEach((notify) => notify(val));
      }
      lastAttemptAt = Date.now();
      return cachedSolPrice;
    })
    .catch(() => {
      // Negative-cache failures briefly so 50 mounted cards never storm-retry
      lastAttemptAt = Date.now();
      return cachedSolPrice;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function useSolPrice(): number | null {
  const [price, setPrice] = useState<number | null>(cachedSolPrice);

  useEffect(() => {
    let isMounted = true;
    const onPrice = (val: number | null) => {
      if (isMounted) setPrice(val);
    };
    listeners.add(onPrice);
    if (cachedSolPrice !== null) {
      setPrice(cachedSolPrice);
    }

    void fetchSharedSolPrice().then((val) => {
      if (isMounted && val !== null) {
        setPrice(val);
      }
    });

    return () => {
      isMounted = false;
      listeners.delete(onPrice);
    };
  }, []);

  return price;
}
