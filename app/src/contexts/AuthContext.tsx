import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { pullCloudParcels } from '../lib/parcels';
import { getAuthRedirectUrl } from '../lib/config';
import type { Profile } from '../lib/types';

interface AuthValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isPro: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  startCheckout: () => Promise<void>;
  openBillingPortal: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_plan, current_period_end')
    .eq('id', userId)
    .single();
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setProfile(null); return; }
    setProfile(await fetchProfile(user.id));
  }, [user]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const p = await fetchProfile(u.id);
        if (cancelled) return;
        setProfile(p);
        if (p?.subscription_plan === 'pro') await pullCloudParcels(u.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const p = await fetchProfile(u.id);
        setProfile(p);
        if (p?.subscription_plan === 'pro') await pullCloudParcels(u.id);
      } else {
        setProfile(null);
      }
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const isPro =
    profile?.subscription_plan === 'pro' &&
    ['active', 'trialing'].includes(profile?.subscription_status ?? '');

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Auth not configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && /not confirmed|email.*confirm/i.test(error.message)) {
      return { error: 'Email not confirmed yet. Check your inbox for the confirmation link, then sign in again.' };
    }
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, full_name: string) => {
    if (!supabase) return { error: 'Auth not configured', needsConfirm: false };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) return { error: error.message, needsConfirm: false };
    return { error: null, needsConfirm: !!data.user && !data.session };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const startCheckout = async () => {
    if (!supabase) return;
    await supabase.auth.refreshSession();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: session.access_token }),
    });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else alert(j.error ?? 'Could not start checkout.');
  };

  const openBillingPortal = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const r = await fetch('/api/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: session.access_token }),
    });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
    else alert(j.error ?? 'Could not open billing portal.');
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isPro, signIn, signUp, signOut, startCheckout, openBillingPortal, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
