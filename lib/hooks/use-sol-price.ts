'use client';

import { useState, useEffect } from 'react';

let cachedSolPrice: number | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 30_000;

export function useSolPrice(): number | null {
  const [price, setPrice] = useState<number | null>(cachedSolPrice);

  useEffect(() => {
    const now = Date.now();
    if (cachedSolPrice !== null && now - lastFetchedAt < CACHE_TTL_MS) {
      setPrice(cachedSolPrice);
      return;
    }

    let isMounted = true;
    fetch('/api/v1/market/sol-price')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!isMounted) return;
        const val = body?.data?.solPriceUsd;
        if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
          cachedSolPrice = val;
          lastFetchedAt = Date.now();
          setPrice(val);
        }
      })
      .catch(() => {
        // Degrade to null rather than inventing a price
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return price;
}
