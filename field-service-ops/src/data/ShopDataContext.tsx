import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as demo from '../lib/demo-store';
import {
  assignJobLive,
  confirmRequestLive,
  createCustomerLive,
  createJobLive,
  declineRequestLive,
  loadShopSnapshot,
  saveInvoiceLive,
  updateJobNotesLive,
  updateJobStatusLive,
  uploadJobPhotoLive,
  upsertPricebookLive,
  type ShopSnapshot,
} from '../lib/live-data';
import { supabase } from '../lib/supabase';
import type {
  Customer,
  Invoice,
  InvoiceLine,
  Job,
  Payment,
  PricebookItem,
  ServiceRequest,
  ShopMember,
  Trade,
} from '../lib/types';

const empty: ShopSnapshot = {
  customers: [],
  requests: [],
  jobs: [],
  pricebook: [],
  invoices: [],
  payments: [],
  members: [],
};

interface ShopDataValue extends ShopSnapshot {
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  createCustomer: (data: Omit<Customer, 'id' | 'shopId'>) => Promise<Customer>;
  createJob: (data: {
    customerId: string | null;
    trade: Trade;
    description: string;
    address: string;
    preferredWindow: string;
  }) => Promise<Job>;
  confirmRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  assignJob: (jobId: string, techUserId: string, scheduledDate: string) => Promise<void>;
  updateJobStatus: (jobId: string, status: Job['status']) => Promise<void>;
  updateJobNotes: (jobId: string, notes: string, photoFile?: File) => Promise<void>;
  upsertPricebookItem: (
    item: Omit<PricebookItem, 'id' | 'shopId'> & { id?: string },
  ) => Promise<void>;
  saveInvoice: (jobId: string, lines: InvoiceLine[]) => Promise<Invoice>;
  collectDemoPayment: (invoiceId: string, amountCents: number, succeed: boolean) => Promise<void>;
}

const ShopDataContext = createContext<ShopDataValue | null>(null);

function demoSnapshot(shopId: string): ShopSnapshot {
  const state = demo.getState();
  return {
    customers: state.customers.filter((c) => c.shopId === shopId),
    requests: state.requests.filter((r) => r.shopId === shopId),
    jobs: state.jobs.filter((j) => j.shopId === shopId),
    pricebook: state.pricebook.filter((p) => p.shopId === shopId),
    invoices: state.invoices.filter((i) => i.shopId === shopId),
    payments: state.payments.filter((p) => p.shopId === shopId),
    members: state.members.filter((m) => m.shopId === shopId),
  };
}

export function ShopDataProvider({ children }: { children: React.ReactNode }) {
  const { shop, user, demoMode, refresh: refreshAuth } = useAuth();
  const [snap, setSnap] = useState<ShopSnapshot>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refreshData = useCallback(async () => {
    if (!shop) {
      setSnap(empty);
      return;
    }
    setError(null);
    if (demoMode) {
      setSnap(demoSnapshot(shop.id));
      return;
    }
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setLoading(true);
    try {
      setSnap(await loadShopSnapshot(supabase, shop.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load shop data');
    } finally {
      setLoading(false);
    }
  }, [shop, demoMode]);

  useEffect(() => {
    void refreshData();
  }, [refreshData, tick]);

  const bump = useCallback(() => {
    setTick((t) => t + 1);
    refreshAuth();
  }, [refreshAuth]);

  const value = useMemo<ShopDataValue>(() => {
    const shopId = shop?.id;
    const userId = user?.id;

    return {
      ...snap,
      loading,
      error,
      refreshData,
      createCustomer: async (data) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          const c = demo.createCustomer(shopId, userId, data);
          bump();
          return c;
        }
        if (!supabase) throw new Error('Supabase not configured');
        const c = await createCustomerLive(supabase, shopId, data);
        bump();
        return c;
      },
      createJob: async (data) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          const j = demo.createJob(shopId, userId, data);
          bump();
          return j;
        }
        if (!supabase) throw new Error('Supabase not configured');
        const j = await createJobLive(supabase, shopId, data);
        bump();
        return j;
      },
      confirmRequest: async (requestId) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          demo.confirmRequest(shopId, userId, requestId);
          bump();
          return;
        }
        if (!supabase) throw new Error('Supabase not configured');
        await confirmRequestLive(supabase, requestId);
        bump();
      },
      declineRequest: async (requestId) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          demo.declineRequest(shopId, userId, requestId);
          bump();
          return;
        }
        if (!supabase) throw new Error('Supabase not configured');
        await declineRequestLive(supabase, shopId, requestId);
        bump();
      },
      assignJob: async (jobId, techUserId, scheduledDate) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          demo.assignJob(shopId, userId, jobId, techUserId, scheduledDate);
          bump();
          return;
        }
        if (!supabase) throw new Error('Supabase not configured');
        await assignJobLive(supabase, shopId, jobId, techUserId, scheduledDate);
        bump();
      },
      updateJobStatus: async (jobId, status) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          demo.updateJobStatus(shopId, userId, jobId, status);
          bump();
          return;
        }
        if (!supabase) throw new Error('Supabase not configured');
        await updateJobStatusLive(supabase, shopId, jobId, status);
        bump();
      },
      updateJobNotes: async (jobId, notes, photoFile) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          let dataUrl: string | undefined;
          if (photoFile) {
            dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error('Read failed'));
              reader.readAsDataURL(photoFile);
            });
          }
          demo.updateJobNotes(shopId, userId, jobId, notes, dataUrl);
          bump();
          return;
        }
        if (!supabase) throw new Error('Supabase not configured');
        await updateJobNotesLive(supabase, shopId, jobId, notes);
        if (photoFile) await uploadJobPhotoLive(supabase, shopId, jobId, photoFile);
        bump();
      },
      upsertPricebookItem: async (item) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          demo.upsertPricebookItem(shopId, userId, item);
          bump();
          return;
        }
        if (!supabase) throw new Error('Supabase not configured');
        await upsertPricebookLive(supabase, shopId, item);
        bump();
      },
      saveInvoice: async (jobId, lines) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (demoMode) {
          const inv = demo.saveInvoice(shopId, userId, jobId, lines);
          bump();
          return inv;
        }
        if (!supabase) throw new Error('Supabase not configured');
        const inv = await saveInvoiceLive(supabase, shopId, jobId, lines);
        bump();
        return inv;
      },
      collectDemoPayment: async (invoiceId, amountCents, succeed) => {
        if (!shopId || !userId) throw new Error('Not signed in');
        if (!demoMode) throw new Error('Demo payment only available in demo mode');
        demo.collectDemoPayment(shopId, userId, invoiceId, amountCents, succeed);
        bump();
      },
    };
  }, [snap, loading, error, refreshData, shop, user, demoMode, bump]);

  return <ShopDataContext.Provider value={value}>{children}</ShopDataContext.Provider>;
}

export function useShopData(): ShopDataValue {
  const ctx = useContext(ShopDataContext);
  if (!ctx) throw new Error('useShopData outside provider');
  return ctx;
}

export type { Payment };
