import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as demo from '../lib/demo-store';
import { isDemoMode, supabase } from '../lib/supabase';
import type { SessionUser, Shop, ShopMember } from '../lib/types';

interface AuthContextValue {
  user: SessionUser | null;
  shop: Shop | null;
  membership: ShopMember | null;
  accessToken: string | null;
  demoMode: boolean;
  loading: boolean;
  refresh: () => void;
  loginDemo: (email: string) => void;
  loginLive: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signupShop: (name: string, slug: string, email: string, password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapMember(row: Record<string, unknown>): ShopMember {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    userId: String(row.user_id),
    email: String(row.email || ''),
    isOwner: !!row.is_owner,
    isCsr: !!row.is_csr,
    isDispatcher: !!row.is_dispatcher,
    isTech: !!row.is_tech,
  };
}

function mapShop(row: Record<string, unknown>): Shop {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    stripeConnectAccountId: (row.stripe_connect_account_id as string) || null,
    hasSpiKey: false,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(!isDemoMode);
  const [liveUser, setLiveUser] = useState<SessionUser | null>(null);
  const [liveToken, setLiveToken] = useState<string | null>(null);
  const [liveShop, setLiveShop] = useState<Shop | null>(null);
  const [liveMembership, setLiveMembership] = useState<ShopMember | null>(null);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const loadLiveShop = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data: members } = await supabase
      .from('shop_members')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    const memberRow = members?.[0];
    if (!memberRow) {
      setLiveMembership(null);
      setLiveShop(null);
      return;
    }
    setLiveMembership(mapMember(memberRow as Record<string, unknown>));
    const { data: shop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', memberRow.shop_id)
      .maybeSingle();
    if (shop) {
      const mapped = mapShop(shop as Record<string, unknown>);
      const { data: secret } = await supabase
        .from('shop_spi_secrets')
        .select('shop_id')
        .eq('shop_id', mapped.id)
        .maybeSingle();
      // members cannot select secrets — presence check may fail; Settings will set hasSpiKey via API success
      mapped.hasSpiKey = !!secret;
      setLiveShop(mapped);
    } else {
      setLiveShop(null);
    }
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      demo.getState();
      setLoading(false);
      return;
    }
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const session = data.session;
      if (session?.user) {
        setLiveUser({ id: session.user.id, email: session.user.email || '' });
        setLiveToken(session.access_token);
        await loadLiveShop(session.user.id);
      }
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setLiveUser(null);
        setLiveToken(null);
        setLiveShop(null);
        setLiveMembership(null);
        return;
      }
      setLiveUser({ id: session.user.id, email: session.user.email || '' });
      setLiveToken(session.access_token);
      await loadLiveShop(session.user.id);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadLiveShop]);

  useEffect(() => {
    if (!isDemoMode && liveUser) {
      void loadLiveShop(liveUser.id);
    }
  }, [tick, isDemoMode, liveUser, loadLiveShop]);

  const value = useMemo<AuthContextValue>(() => {
    if (!isDemoMode) {
      return {
        user: liveUser,
        shop: liveShop,
        membership: liveMembership,
        accessToken: liveToken,
        demoMode: false,
        loading,
        refresh,
        loginDemo: () => undefined,
        loginLive: async (email, password) => {
          if (!supabase) throw new Error('Supabase not configured');
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          refresh();
        },
        logout: async () => {
          if (supabase) await supabase.auth.signOut();
          setLiveUser(null);
          setLiveToken(null);
          setLiveShop(null);
          setLiveMembership(null);
        },
        signupShop: async (name, slug, email, password) => {
          if (!supabase) throw new Error('Supabase not configured');
          if (!password) throw new Error('Password required');
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          if (!data.user) throw new Error('Signup failed');
          const { error: rpcErr } = await supabase.rpc('create_shop_with_owner', {
            p_name: name,
            p_slug: slug,
          });
          if (rpcErr) throw rpcErr;
          refresh();
        },
      };
    }

    void tick;
    const state = demo.getState();
    const user = state.user;
    const shop =
      state.shops.find((s) => s.id === state.activeShopId) ||
      (user ? demo.shopsVisibleTo(user.id)[0] : undefined) ||
      null;
    const membership = user && shop ? demo.membershipFor(user.id, shop.id) || null : null;
    return {
      user,
      shop,
      membership,
      accessToken: user ? `demo-token-${user.id}` : null,
      demoMode: true,
      loading: false,
      refresh,
      loginDemo: (email: string) => {
        const stateNow = demo.getState();
        const member = stateNow.members.find((m) => m.email === email);
        if (member) demo.setUser({ id: member.userId, email: member.email });
        else demo.setUser({ id: `user_${email}`, email });
        refresh();
      },
      loginLive: async () => undefined,
      logout: async () => {
        demo.setUser(null);
        refresh();
      },
      signupShop: async (name, slug, email) => {
        demo.createShopWithOwner(name, slug, email);
        refresh();
      },
    };
  }, [tick, refresh, liveUser, liveShop, liveMembership, liveToken, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
