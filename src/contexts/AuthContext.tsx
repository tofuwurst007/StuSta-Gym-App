import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Map a Supabase profile row + session to our User type
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

interface AuthContextType {
  currentUser:       User | null;   // null = guest
  loading:           boolean;
  login:             (email: string, password: string) => Promise<void>;
  logout:            () => Promise<void>;
  signUp:            (email: string, password: string, name: string) => Promise<void>;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);

  // Load current session on mount + subscribe to auth changes
  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) await loadProfile(session);
      setLoading(false);
    });

    // Listen for sign-in / sign-out events
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

  async function loadProfile(session: Session) {
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    // If the trigger didn't create a profile yet, create one now
    if (!profile) {
      const name = session.user.user_metadata?.name
        ?? session.user.email?.split('@')[0]
        ?? 'User';
      const { data: created } = await supabase.from('profiles').upsert({
        id: session.user.id,
        name,
        email: session.user.email ?? '',
        role: 'member',
        avatar_initials: name.charAt(0).toUpperCase(),
      }).select().single();
      profile = created;
    }

    if (profile) {
      setCurrentUser(profileToUser(profile as Record<string, unknown>, session));
    }
  }

  /** Email + password sign-in */
  async function login(email: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    } finally {
      setLoading(false);
    }
  }

  /** Email + password sign-up */
  async function signUp(email: string, password: string, name: string): Promise<void> {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw new Error(error.message);
    } finally {
      setLoading(false);
    }
  }

  /** Sign out */
  async function logout(): Promise<void> {
    await supabase.auth.signOut();
  }

  /** Update profile fields for the logged-in user */
  async function updateCurrentUser(updates: Partial<User>): Promise<void> {
    if (!currentUser) return;

    const mapped: Record<string, unknown> = {};
    if (updates.name)          mapped.name           = updates.name;
    if (updates.avatarId)      mapped.avatar_id      = updates.avatarId;
    if (updates.avatarInitials) mapped.avatar_initials = updates.avatarInitials;
    if (updates.role)          mapped.role           = updates.role;

    const { error } = await supabase
      .from('profiles')
      .update(mapped)
      .eq('id', currentUser.id);

    if (error) throw new Error(error.message);
    setCurrentUser({ ...currentUser, ...updates });
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, signUp, logout, updateCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
