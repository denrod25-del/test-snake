import { useEffect, useState } from 'react';
import type { UpcomingSale } from '../lib/types';
import { FALLBACK_UPCOMING } from '../data/schedules';

let cache: Record<string, UpcomingSale[]> | null = null;
let pending: Promise<Record<string, UpcomingSale[]>> | null = null;

async function load(): Promise<Record<string, UpcomingSale[]>> {
  if (cache) return cache;
  if (pending) return pending;
  pending = fetch('/sales.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      // Accept either { sales: { County: [...] } } or { County: [...] } shape
      const sales = j?.sales ?? j ?? {};
      const merged: Record<string, UpcomingSale[]> =
        Object.keys(sales).length ? { ...FALLBACK_UPCOMING, ...sales } : FALLBACK_UPCOMING;
      cache = merged;
      return merged;
    })
    .catch(() => {
      cache = FALLBACK_UPCOMING;
      return FALLBACK_UPCOMING;
    });
  return pending;
}

export function useUpcoming(): Record<string, UpcomingSale[]> {
  const [data, setData] = useState<Record<string, UpcomingSale[]>>(cache ?? FALLBACK_UPCOMING);
  useEffect(() => {
    void load().then(setData);
  }, []);
  return data;
}
