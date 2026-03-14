import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { pb } from '../lib/pocketbase';

// Detect if running inside a Capacitor native shell
const isNative = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

// Map a PocketBase record to our User type
function recordToUser(r: Record<string, unknown>): User {
  return {
    id:               String(r.id ?? ''),
    name:             String(r.name ?? ''),
    email:            String(r.email ?? ''),
    role:             (r.role as User['role']) ?? 'member',
    house:            String(r.house ?? ''),
    room:             String(r.room ?? ''),
    dateOfBirth:      String(r.dateOfBirth ?? ''),
    membershipStart:  String(r.membershipStart ?? ''),
    membershipEnd:    String(r.membershipEnd ?? ''),
    createdAt:        String(r.created ?? r.createdAt ?? ''),
    avatarInitials:   String(r.avatarInitials ?? ''),
    avatarId:         r.avatarId ? String(r.avatarId) : undefined,
  };
}

interface AuthContextType {
  currentUser:       User | null;       // null = guest (not logged in)
  loading:           boolean;
  login:             (email: string, password: string) => Promise<void>;
  loginWithGoogle:   () => Promise<void>;
  logout:            () => void;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Restore from PocketBase's persisted auth token on first load
    const model = pb.authStore.model;
    return model ? recordToUser(model as Record<string, unknown>) : null;
  });
  const [loading, setLoading] = useState(false);

  // Keep context in sync whenever the PocketBase auth store changes
  // (e.g. token refresh, OAuth2 callback, explicit logout)
  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      const model = pb.authStore.model;
      setCurrentUser(model ? recordToUser(model as Record<string, unknown>) : null);
    });
    return () => unsubscribe();
  }, []);

  /** Email + password login */
  async function login(email: string, password: string): Promise<void> {
    setLoading(true);
    try {
      await pb.collection('users').authWithPassword(email, password);
      // authStore.onChange fires above — no need to call setCurrentUser manually
    } finally {
      setLoading(false);
    }
  }

  /** Google OAuth2 login.
   *  - Web: PocketBase SDK opens a popup + uses SSE to return the token.
   *  - Android/iOS (Capacitor): opens the OAuth page in the system browser
   *    (Custom Tabs / SFSafariViewController) so Google OAuth works correctly. */
  async function loginWithGoogle(): Promise<void> {
    setLoading(true);
    try {
      if (isNative) {
        // Capacitor: open OAuth in system browser, handle deep-link redirect
        const { Browser } = await import('@capacitor/browser');
        await pb.collection('users').authWithOAuth2({
          provider: 'google',
          urlCallback: async (url) => {
            await Browser.open({ url, windowName: '_self' });
          },
        });
      } else {
        // Web: PocketBase popup + SSE flow
        await pb.collection('users').authWithOAuth2({ provider: 'google' });
      }
    } finally {
      setLoading(false);
    }
  }

  /** Clear session and return to guest state */
  function logout(): void {
    pb.authStore.clear();
  }

  /** Update profile fields for the currently logged-in user */
  async function updateCurrentUser(updates: Partial<User>): Promise<void> {
    if (!currentUser) return;
    const updated = await pb.collection('users').update(currentUser.id, updates);
    setCurrentUser(recordToUser(updated as unknown as Record<string, unknown>));
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, loginWithGoogle, logout, updateCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
