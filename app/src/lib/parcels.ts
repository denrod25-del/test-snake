import type { Parcel, ParcelStatus } from './types';
import { supabase } from './supabase';

const STORAGE_KEY = 'ftdr.parcels.v1';

export const STATUS_OPTIONS: { value: ParcelStatus; label: string }[] = [
  { value: 'researching', label: 'Researching' },
  { value: 'ready',       label: 'Ready to Bid' },
  { value: 'passed',      label: 'Passed' },
  { value: 'won',         label: 'Won' },
  { value: 'lost',        label: 'Lost' },
];

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return ([1e7] as unknown as string + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
  );
}

export function loadParcels(): Parcel[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Parcel[];
  } catch {
    return [];
  }
}

export function saveParcels(arr: Parcel[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function createBlankParcel(countySlug: string): Parcel {
  const now = Date.now();
  return {
    id: newId(),
    countySlug,
    parcelId: '',
    address: '',
    owner: '',
    assessed: '',
    opening: '',
    max: '',
    liens: '',
    notes: '',
    status: 'researching',
    created: now,
    updated: now,
  };
}

// ---- Cloud sync (Pro tier) -------------------------------------------------
type DbRow = {
  id: string; user_id: string; county_slug: string;
  parcel_id: string | null; address: string | null; owner: string | null;
  assessed: string | null; opening_bid: string | null; max_bid: string | null;
  liens: string | null; notes: string | null; status: string | null;
  created_at: string; updated_at: string;
};

function rowToParcel(r: DbRow): Parcel {
  return {
    id: r.id,
    countySlug: r.county_slug,
    parcelId: r.parcel_id ?? '',
    address: r.address ?? '',
    owner: r.owner ?? '',
    assessed: r.assessed ?? '',
    opening: r.opening_bid ?? '',
    max: r.max_bid ?? '',
    liens: r.liens ?? '',
    notes: r.notes ?? '',
    status: (r.status as ParcelStatus) ?? 'researching',
    created: new Date(r.created_at).getTime(),
    updated: new Date(r.updated_at).getTime(),
  };
}

export async function pullCloudParcels(userId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('watchlist_parcels')
    .select('*')
    .eq('user_id', userId);
  if (error || !data) return;
  if (data.length) {
    saveParcels((data as DbRow[]).map(rowToParcel));
  } else {
    const local = loadParcels();
    for (const p of local) await pushParcelToCloud(userId, p);
  }
}

export async function pushParcelToCloud(userId: string, p: Parcel): Promise<void> {
  if (!supabase) return;
  await supabase.from('watchlist_parcels').upsert(
    {
      id: p.id,
      user_id: userId,
      county_slug: p.countySlug,
      parcel_id: p.parcelId,
      address: p.address,
      owner: p.owner,
      assessed: p.assessed,
      opening_bid: p.opening,
      max_bid: p.max,
      liens: p.liens,
      notes: p.notes,
      status: p.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
}

export async function deleteParcelFromCloud(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('watchlist_parcels').delete().eq('id', id).eq('user_id', userId);
}
