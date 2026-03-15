import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
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
    house: String(p.house ?? ''),
    room: String(p.room ?? ''),
    dateOfBirth: String(p.date_of_birth ?? ''),
    membershipStart: String(p.membership_start ?? ''),
    membershipEnd: String(p.membership_end ?? ''),
    createdAt: String(p.created_at ?? ''),
    avatarInitials: String(p.avatar_initials ?? ''),
    avatarId: p.avatar_id ? String(p.avatar_id) : undefined,
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

  // Store session — set synchronously inside onAuthStateChange so the SDK
  // lock is released immediately. Profile loading happens in a separate effect.
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Track the last session id we've fetched a profile for,
  // so we don't re-fetch on duplicate events.
  const lastProfileFor = useRef<string | null>(null);

  // ── 1. Capture session synchronously (no async work here!) ────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        console.log('[Auth] onAuthStateChange event:', _event, sess?.user?.email ?? 'no user');
        setSession(sess);
        setSessionReady(true);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── 2. Load profile (separate from the auth lock) ────────────────────────
  const loadProfile = useCallback(async (s: Session) => {
    const uid = s.user.id;

    // Skip if we already loaded for this user
    if (lastProfileFor.current === uid && currentUser) {
      console.log('[Auth] profile already loaded for', s.user.email);
      setReady(true);
      return;
    }

    console.log('[Auth] loading profile for', s.user.email);

    try {
      // 1) Try reading the existing profile
      const { data: profile, error: selErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (selErr) {
        console.warn('[Auth] SELECT error:', selErr.message);
      }

      if (profile) {
        console.log('[Auth] profile found, role =', profile.role);
        lastProfileFor.current = uid;
        setCurrentUser(profileToUser(profile as Record<string, unknown>, s));
        setReady(true);
        return;
      }

      // 2) No profile row — create one (INSERT only, never overwrites)
      console.log('[Auth] no profile row, creating one...');
      const name = s.user.user_metadata?.name
        ?? s.user.email?.split('@')[0] ?? 'User';

      const { data: created, error: insErr } = await supabase
        .from('profiles')
        .insert({
          id: uid,
          name,
          email: s.user.email ?? '',
          role: 'member',
          avatar_initials: name.charAt(0).toUpperCase(),
        })
        .select()
        .single();

      if (insErr) {
        console.warn('[Auth] INSERT failed:', insErr.message);
        // Row likely already exists — try SELECT one more time
        const { data: retry } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single();
        if (retry) {
          console.log('[Auth] retry SELECT succeeded, role =', retry.role);
          lastProfileFor.current = uid;
          setCurrentUser(profileToUser(retry as Record<string, unknown>, s));
          setReady(true);
          return;
        }
      }

      if (created) {
        console.log('[Auth] created new profile, role =', created.role);
        lastProfileFor.current = uid;
        setCurrentUser(profileToUser(created as Record<string, unknown>, s));
        setReady(true);
        return;
      }

      // 3) Fallback — use session data with member role
      console.warn('[Auth] all DB attempts failed — using session fallback (member role)');
      const name2 = s.user.user_metadata?.name ?? s.user.email?.split('@')[0] ?? 'User';
      setCurrentUser({
        id: uid, name: name2, email: s.user.email ?? '', role: 'member',
        house: '', room: '', dateOfBirth: '',
        membershipStart: '', membershipEnd: '',
        createdAt: s.user.created_at ?? '',
        avatarInitials: name2.charAt(0).toUpperCase(), avatarId: undefined,
      });
      setReady(true);
    } catch (err) {
      console.error('[Auth] loadProfile crashed:', err);
      setReady(true);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!sessionReady) return;

    if (!session) {
      setCurrentUser(null);
      lastProfileFor.current = null;
      setReady(true);
      return;
    }

    loadProfile(session);
  }, [session, sessionReady, loadProfile]);

  // ── Auth actions ──────────────────────────────────────────────────────────
  async function login(email: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      // onAuthStateChange → setSession → useEffect → loadProfile
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
    // flushSync forces React to apply the state update synchronously,
    // so the UI reflects currentUser=null before we navigate away.
    flushSync(() => {
      lastProfileFor.current = null;
      setCurrentUser(null);
      setSession(null);
    });
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
