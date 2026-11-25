'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { readJsonResponse } from '@/lib/response';

export interface AppSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: { id: string; email?: string | null };
}

export interface Profile {
  id: string;
  full_name: string;
  designation: string | null;
  application_status: string;
}

export interface AuthState {
  session: AppSession | null;
  loading: boolean;
  roles: string[];
  profile: Profile | null;
  startSession: (nextSession: AppSession, nextRoles?: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'uok-demo-session';

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  roles: [],
  profile: null,
  startSession: async () => {},
  refresh: async () => {},
  signOut: async () => {},
});

async function loadUserData(token: string): Promise<{ roles: string[]; profile: Profile | null }> {
  const response = await fetch('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) return { roles: [], profile: null };
  const data = await readJsonResponse<{ roles?: string[]; profile?: Profile | null }>(response);
  return {
    roles: Array.isArray(data.roles) ? data.roles : [],
    profile: data.profile || null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const startSession = async (nextSession: AppSession, nextRoles: string[] = []) => {
    setSession(nextSession);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    if (nextRoles.length > 0) {
      setRoles(nextRoles);
    }
    const userData = await loadUserData(nextSession.access_token);
    if (userData.roles.length > 0) setRoles(userData.roles);
    setProfile(userData.profile);
  };

  const refresh = async () => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setSession(null);
      setRoles([]);
      setProfile(null);
      return;
    }
    try {
      const savedSession = JSON.parse(saved) as AppSession;
      setSession(savedSession);
      const userData = await loadUserData(savedSession.access_token);
      setRoles(userData.roles);
      setProfile(userData.profile);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setRoles([]);
      setProfile(null);
    }
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setRoles([]);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, roles, profile, startSession, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthToken(): string | null {
  return useAuth().session?.access_token ?? null;
}
