import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ── Map a Supabase profile row to our User type ──────────────────────────────
function profileToUser(
  profile: Record<string, unknown>,
  session: Session
): User {
  return {
    id:              String(profile.id ?? session.user.id),
    name:            String(profile.name ?? ''),
    email:           String(profile.email ?? session.user.email ?? ''),
    role:            (profile.role as User['role']) ?? 'member',
    house:           '',
    room:            '',
    dateOfBirth:     '',
    membershipStart: '',
    membershipEnd:   '',
    createdAt:       String(profile.created_at ?? ''),
    avatarInitials:  String(profile.avatar_initials ?? ''),
    avatarId:        profile.avatar_id ? String(profile.avatar_id) : undefined,
  };
}

/** Minimal user from session alone — last-resort fallback. */
function userFromSession(session: Session): User {
  const meta = session.user.user_metadata ?? {};
  const name = String(meta.name ?? session.user.email?.split('@')[0] ?? 'User');
  return {
    id:              session.user.id,
    name,
    email:           session.user.email ?? '',
    role:            'member',
    house:           '',
    room:            '',
    dateOfBirth:     '',
    membershipStart: '',
    membershipEnd:   '',
    createdAt:       session.user.created_at ?? '',
    avatarInitials:  name.charAt(0).toUpperCase(),
    avatarId:        undefined,
  };
}

interface AuthContextType {
  currentUser:       User | null;
  loading:           boolean;
  ready:             boolean;
  login:             (email: string, password: string) => Promise<void>;
  logout:            () => Promise<void>;
  signUp:            (email: string, password: string, name: string) => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading]         = useState(false);
  const [ready, setReady]             = useState(false);

  // Concurrency guard — only one loadProfile at a time
  const profileLock = useRef(false);

  // ── Single source of truth: onAuthStateChange ─────────────────────────────
  // It fires INITIAL_SESSION on mount (replaces getSession), SIGNED_IN on
  // login, SIGNED_OUT on logout, TOKEN_REFRESHED on refresh, etc.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          await loadProfile(session);
        } else {
          setCurrentUser(null);
        }
        // Mark ready after the very first event (INITIAL_SESSION)
        setReady(true);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch (or create) the profile row ──────────────────────────────────────
  async function loadProfile(session: Session) {
    // Skip if another loadProfile is already running
    if (profileLock.current) return;
    profileLock.current = true;

    try {
      // 1) Read existing profile
      const { data: profile, error: selErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (selErr) {
        console.warn('[Auth] profile SELECT error:', selErr.message);
      }

      if (profile) {
        setCurrentUser(profileToUser(profile as Record<string, unknown>, session));
        return;
      }

      // 2) No profile — INSERT a new row (never upsert, to preserve existing roles)
      const name = session.user.user_metadata?.name
        ?? session.user.email?.split('@')[0]
        ?? 'User';

      const { data: created, error: insErr } = await supabase
        .from('profiles')
        .insert({
          id:               session.user.id,
          name,
          email:            session.user.email ?? '',
          role:             'member',
          avatar_initials:  name.charAt(0).toUpperCase(),
        })
        .select()
        .single();

      if (insErr) {
        console.warn('[Auth] profile INSERT failed:', insErr.message, '— retrying SELECT');
        // Row probably exists; retry the read
        const { data: retry } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (retry) {
          setCurrentUser(profileToUser(retry as Record<string, unknown>, session));
          return;
        }
      }

      if (created) {
        setCurrentUser(profileToUser(created as Record<string, unknown>, session));
        return;
      }

      // 3) Everything failed — use session-only data so user isn't stuck as guest
      console.warn('[Auth] falling back to session-only user');
      setCurrentUser(userFromSession(session));

    } catch (err) {
      console.error('[Auth] loadProfile crashed:', err);
      setCurrentUser(userFromSession(session));
    } finally {
      profileLock.current = false;
    }
  }

  // ── Sign in ────────────────────────────────────────────────────────────────
  // Does NOT call loadProfile — onAuthStateChange(SIGNED_IN) handles it.
  async function login(email: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      // onAuthStateChange will fire SIGNED_IN → loadProfile → setCurrentUser
      // Wait briefly for the state to settle before the caller navigates
      await new Promise(r => setTimeout(r, 300));
    } finally {
      setLoading(false);
    }
  }

  // ── Sign up ────────────────────────────────────────────────────────────────
  async function signUp(email: string, password: string, name: string): Promise<void> {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw new Error(error.message);

      // Supabase returns fake success for existing emails — detect via identities
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  async function logout(): Promise<void> {
    setCurrentUser(null);
    await supabase.auth.signOut();
  }

  // ── Update profile ─────────────────────────────────────────────────────────
  async function updateCurrentUser(updates: Partial<User>): Promise<void> {
    if (!currentUser) return;

    const mapped: Record<string, unknown> = {};
    if (updates.name)           mapped.name            = updates.name;
    if (updates.avatarId)       mapped.avatar_id       = updates.avatarId;
    if (updates.avatarInitials) mapped.avatar_initials = updates.avatarInitials;
    if (updates.role)           mapped.role            = updates.role;

    const { error } = await supabase
      .from('profiles')
      .update(mapped)
      .eq('id', currentUser.id);

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
