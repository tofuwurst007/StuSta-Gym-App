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
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
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

    // Skip if we already loaded for this user (token refreshes emit new session objects)
    if (lastProfileFor.current === uid) {
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

      // 3) No profile at all. If the account itself is gone (deleted by an admin while
      //    this device was still logged in), end the session instead of faking a member.
      const { error: userErr } = await supabase.auth.getUser();
      if (userErr && [401, 403, 404].includes(userErr.status ?? 0)) {
        console.warn('[Auth] account no longer exists — signing out');
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }

      // Fallback — use session data with member role. Mark as done so this
      // isn't retried on every render (it used to loop endlessly).
      console.warn('[Auth] all DB attempts failed — using session fallback (member role)');
      lastProfileFor.current = uid;
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
      // Not marked as loaded: the next session event (e.g. token refresh) retries
      console.error('[Auth] loadProfile crashed:', err);
      setReady(true);
    }
  }, []);

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
      if (error) throw error; // AuthError keeps .status (e.g. 429) for Login's messages
      // onAuthStateChange → setSession → useEffect → loadProfile
    } finally {
      setLoading(false);
    }
  }

  async function signUp(email: string, password: string, name: string): Promise<void> {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        // The verification link lands on /auth/callback, which confirms and logs the user in
        options: { data: { name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw new Error(error.message);
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: 'signup', email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }

  async function requestPasswordReset(email: string): Promise<void> {
    // GoTrue answers the same whether or not the account exists (no account enumeration)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function updatePassword(password: string): Promise<void> {
    // Works with the session the reset link creates (and for any logged-in user)
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async function logout(): Promise<void> {
    // flushSync forces React to apply the state update synchronously,
    // so the UI reflects currentUser=null before we navigate away.
    flushSync(() => {
      lastProfileFor.current = null;
      setCurrentUser(null);
      setSession(null);
    });
    // If the server can't be reached, still drop the local session so a reload
    // doesn't silently log the user back in (matters on shared devices).
    // signOut() bails out on network errors before clearing storage, and can hang for a
    // minute when the server doesn't answer — so give it 3 s, then remove it directly.
    const { error } = await Promise.race([
      supabase.auth.signOut(),
      new Promise<{ error: Error }>(resolve => setTimeout(() => resolve({ error: new Error('sign-out timed out') }), 3000)),
    ]);
    if (error) {
      const storageKey = (supabase.auth as unknown as { storageKey: string }).storageKey;
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}-code-verifier`);
    }
  }

  async function updateCurrentUser(updates: Partial<User>): Promise<void> {
    if (!currentUser) return;
    const mapped: Record<string, unknown> = {};
    if (updates.name) mapped.name = updates.name;
    if (updates.avatarId) mapped.avatar_id = updates.avatarId;
    if (updates.avatarInitials) mapped.avatar_initials = updates.avatarInitials;
    // Role changes go through the admin user management, never through one's own profile

    const { error } = await supabase.from('profiles').update(mapped).eq('id', currentUser.id);
    if (error) throw new Error(error.message);
    setCurrentUser({ ...currentUser, ...updates });
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, ready, login, signUp, resendVerification, requestPasswordReset, updatePassword, logout, updateCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
