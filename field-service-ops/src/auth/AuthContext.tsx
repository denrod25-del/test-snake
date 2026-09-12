import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as demo from '../lib/demo-store';
import { isDemoMode } from '../lib/supabase';
import type { SessionUser, Shop, ShopMember } from '../lib/types';

interface AuthContextValue {
  user: SessionUser | null;
  shop: Shop | null;
  membership: ShopMember | null;
  demoMode: boolean;
  refresh: () => void;
  loginDemo: (email: string) => void;
  logout: () => void;
  signupShop: (name: string, slug: string, email: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (isDemoMode) demo.getState();
  }, []);

  const value = useMemo(() => {
    void tick;
    if (!isDemoMode) {
      return {
        user: null,
        shop: null,
        membership: null,
        demoMode: false,
        refresh,
        loginDemo: () => undefined,
        logout: () => undefined,
        signupShop: () => undefined,
      };
    }
    const state = demo.getState();
    const user = state.user;
    const shop =
      state.shops.find((s) => s.id === state.activeShopId) ||
      (user ? demo.shopsVisibleTo(user.id)[0] : undefined) ||
      null;
    const membership =
      user && shop ? demo.membershipFor(user.id, shop.id) || null : null;
    return {
      user,
      shop,
      membership,
      demoMode: true,
      refresh,
      loginDemo: (email: string) => {
        const stateNow = demo.getState();
        const member = stateNow.members.find((m) => m.email === email);
        if (member) {
          demo.setUser({ id: member.userId, email: member.email });
        } else {
          demo.setUser({ id: `user_${email}`, email });
        }
        refresh();
      },
      logout: () => {
        demo.setUser(null);
        refresh();
      },
      signupShop: (name: string, slug: string, email: string) => {
        demo.createShopWithOwner(name, slug, email);
        refresh();
      },
    };
  }, [tick, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
