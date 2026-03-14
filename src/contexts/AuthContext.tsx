import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// ── Map a Supabase profile row (or just session data) to our User type ────────
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

/** Build a minimal User from the session alone (fallback when profiles table
 *  is unreachable or has no row for this user). */
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
  currentUser:       User | null;   // null = guest
  loading:           boolean;       // true only during active login / sign-up
  ready:             boolean;       // true once initial session check is done
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

  // ── Load session on mount + subscribe to future auth changes ────────────────
  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) await loadProfile(session);
      })
      .catch((err) => console.error('[Auth] getSession failed:', err))
      .finally(() => setReady(true));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          await loadProfile(session);
        } else {
          setCurrentUser(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch (or create) the profile row and set currentUser ───────────────────
  async function loadProfile(session: Session) {
    try {
      // 1) Try to read the existing profile
      const { data: profile, error: selErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (selErr) {
        console.warn('[Auth] profile SELECT failed:', selErr.message);
      }

      if (profile) {
        setCurrentUser(profileToUser(profile as Record<string, unknown>, session));
        return;   // ← happy path, we're done
      }

      // 2) No profile row — INSERT one (trigger may not have fired yet).
      //    Use INSERT (not upsert!) so we never overwrite an existing row's role.
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
        console.warn('[Auth] profile INSERT failed:', insErr.message,
          '(expected if row already exists — retrying SELECT)');
        // Row likely exists but RLS blocked the first SELECT — retry
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

      // 3) Everything failed — still sign the user in with session-only data
      //    so they don't get stuck as "guest" forever
      console.warn('[Auth] falling back to session-only user');
      setCurrentUser(userFromSession(session));

    } catch (err) {
      console.error('[Auth] loadProfile crashed:', err);
      // Even on crash, treat as signed-in with minimal data
      setCurrentUser(userFromSession(session));
    }
  }

  // ── Email + password sign-in ─────────────────────────────────────────────────
  async function login(email: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      if (data.session) await loadProfile(data.session);
    } finally {
      setLoading(false);
    }
  }

  // ── Email + password sign-up ─────────────────────────────────────────────────
  async function signUp(email: string, password: string, name: string): Promise<void> {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw new Error(error.message);

      // Supabase returns a fake success for existing emails (to prevent
      // email enumeration).  Detect it by checking the identities array.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Sign out ─────────────────────────────────────────────────────────────────
  async function logout(): Promise<void> {
    setCurrentUser(null);
    await supabase.auth.signOut();
  }

  // ── Update profile fields for the current user ───────────────────────────────
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
