import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function profileToUser(p: Record<string, unknown>, s: Session): User {
  return {
    id: String(p.id ?? s.user.id),
    name: String(p.name ?? ''),
    email: String(p.email ?? s.user.email ?? ''),
    role: (p.role as User['role']) ?? 'member',
    house: '', room: '', dateOfBirth: '',
    membershipStart: '', membershipEnd: '',
    createdAt: String(p.created_at ?? ''),
    avatarInitials: String(p.avatar_initials ?? ''),
    avatarId: p.avatar_id ? String(p.avatar_id) : undefined,
  };
}

function userFromSession(s: Session): User {
  const name = String(s.user.user_metadata?.name ?? s.user.email?.split('@')[0] ?? 'User');
  return {
    id: s.user.id, name, email: s.user.email ?? '', role: 'member',
    house: '', room: '', dateOfBirth: '',
    membershipStart: '', membershipEnd: '',
    createdAt: s.user.created_at ?? '',
    avatarInitials: name.charAt(0).toUpperCase(), avatarId: undefined,
  };
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Store the raw Supabase session — updated synchronously inside
  // onAuthStateChange so the SDK lock is released immediately.
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // ── 1. Capture session synchronously (no async work here!) ────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        // Synchronous — just set state, don't fetch anything.
        setSession(sess);
        setSessionReady(true);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── 2. Load profile in a separate effect (outside the lock) ───────────────
  const profileLock = useRef(false);

  useEffect(() => {
    if (!sessionReady) return;

    if (!session) {
      setCurrentUser(null);
      setReady(true);
      return;
    }

    let cancelled = false;

    async function fetchProfile(s: Session) {
      if (profileLock.current) return;
      profileLock.current = true;

      try {
        // 1) Try reading the existing profile
        const { data: profile, error: selErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', s.user.id)
          .single();

        if (selErr) console.warn('[Auth] SELECT error:', selErr.message);

        if (profile && !cancelled) {
          setCurrentUser(profileToUser(profile as Record<string, unknown>, s));
          return;
        }

        // 2) No profile — create one (INSERT, not upsert, to preserve roles)
        const name = s.user.user_metadata?.name
          ?? s.user.email?.split('@')[0] ?? 'User';

        const { data: created, error: insErr } = await supabase
          .from('profiles')
          .insert({
            id: s.user.id,
            name,
            email: s.user.email ?? '',
            role: 'member',
            avatar_initials: name.charAt(0).toUpperCase(),
          })
          .select()
          .single();

        if (insErr) {
          console.warn('[Auth] INSERT failed:', insErr.message, '— retrying SELECT');
          const { data: retry } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', s.user.id)
            .single();
          if (retry && !cancelled) {
            setCurrentUser(profileToUser(retry as Record<string, unknown>, s));
            return;
          }
        }

        if (created && !cancelled) {
          setCurrentUser(profileToUser(created as Record<string, unknown>, s));
          return;
        }

        // 3) Fallback — use session data so user isn't stuck as guest
        if (!cancelled) {
          console.warn('[Auth] falling back to session-only user');
          setCurrentUser(userFromSession(s));
        }
      } catch (err) {
        console.error('[Auth] loadProfile crashed:', err);
        if (!cancelled) setCurrentUser(userFromSession(s));
      } finally {
        profileLock.current = false;
        if (!cancelled) setReady(true);
      }
    }

    fetchProfile(session);

    return () => { cancelled = true; };
  }, [session, sessionReady]);

  // ── Auth actions ──────────────────────────────────────────────────────────
  async function login(email: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      // onAuthStateChange will fire → setSession → useEffect → loadProfile
      // Wait for profile to load before caller navigates
      await new Promise<void>((resolve) => {
        const t = setInterval(() => {
          if (!profileLock.current) { clearInterval(t); resolve(); }
        }, 50);
        setTimeout(() => { clearInterval(t); resolve(); }, 3000);
      });
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, name: string): Promise<void> {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { name } },
      });
      if (error) throw new Error(error.message);
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function logout(): Promise<void> {
    setCurrentUser(null);
    await supabase.auth.signOut();
  }

  async function updateCurrentUser(updates: Partial<User>): Promise<void> {
    if (!currentUser) return;
    const mapped: Record<string, unknown> = {};
    if (updates.name) mapped.name = updates.name;
    if (updates.avatarId) mapped.avatar_id = updates.avatarId;
    if (updates.avatarInitials) mapped.avatar_initials = updates.avatarInitials;
    if (updates.role) mapped.role = updates.role;

    const { error } = await supabase.from('profiles').update(mapped).eq('id', currentUser.id);
    if (error) throw new Error(error.message);
    setCurrentUser({ ...currentUser, ...updates });
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, ready, login, signUp, logout, updateCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
