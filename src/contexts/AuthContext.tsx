import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';

const AUTH_INIT_TIMEOUT_MS = 5000;
const PROFILE_FETCH_TIMEOUT_MS = 5000;

function timeout<T>(ms: number, label: string) {
  return new Promise<T>((_, reject) => {
    window.setTimeout(() => reject(new Error(label)), ms);
  });
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null; session: Session | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        timeout<any>(PROFILE_FETCH_TIMEOUT_MS, 'Profile fetch timeout'),
      ]);

      if (error) {
        console.warn('[auth] Profile fetch error:', error);
        return null;
      }
      return data ?? null;
    } catch (e) {
      console.warn('[auth] Profile fetch failed (non-blocking):', e);
      return null;
    }
  }, []);

  const setAuthSession = useCallback((session: Session | null) => {
    setState(prev => ({
      ...prev,
      user: session?.user ?? null,
      session,
      // IMPORTANT: auth must never block the UI indefinitely
      isLoading: false,
      isAuthenticated: !!session?.user,
    }));
  }, []);

  const hydrateProfileAsync = useCallback(
    async (userId: string) => {
      const profile = await fetchProfile(userId);
      setState(prev => {
        // Avoid writing a stale profile if user changed mid-flight
        if (prev.user?.id !== userId) return prev;
        return { ...prev, profile };
      });
    },
    [fetchProfile]
  );

  // Set up auth state listener FIRST, then check session
  useEffect(() => {
    let isMounted = true;
    let initResolved = false;

    // Set up listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        // Resolve initialization as soon as we receive any auth state.
        if (!initResolved) {
          initResolved = true;
          window.clearTimeout(timeoutId);
        }

        // Update global auth state immediately (do NOT block on profile)
        setAuthSession(session);

        // Hydrate profile in background
        if (session?.user?.id) {
          void hydrateProfileAsync(session.user.id);
        } else {
          setState(prev => ({ ...prev, profile: null }));
        }
      }
    );

    // Check for existing session (with timeout fallback so UI never gets stuck on Loading)
    const timeoutId = window.setTimeout(() => {
      if (!isMounted || initResolved) return;
      initResolved = true;
      console.warn(`[auth] Init timeout after ${AUTH_INIT_TIMEOUT_MS}ms; falling back to logged-out state.`);
      setState({
        user: null,
        session: null,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }, AUTH_INIT_TIMEOUT_MS);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted || initResolved) return;
        initResolved = true;
        window.clearTimeout(timeoutId);

        // IMPORTANT: allow app entry based on session immediately
        setAuthSession(session);

        // Non-blocking profile fetch
        if (session?.user?.id) {
          void hydrateProfileAsync(session.user.id);
        }
      } catch (e) {
        console.warn('[auth] Error initializing session; falling back to logged-out state:', e);
        if (!isMounted || initResolved) return;
        initResolved = true;
        setState({
          user: null,
          session: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
        });
      } finally {
        // If getSession resolved we clear in the happy-path; keep timeout alive otherwise.
      }
    })();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, [hydrateProfileAsync, setAuthSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    // Return session info so caller can decide whether to navigate or show verification message
    return { error, session: data?.session };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.refreshSession();
    setAuthSession(session);
    if (session?.user?.id) {
      void hydrateProfileAsync(session.user.id);
    } else {
      setState(prev => ({ ...prev, profile: null }));
    }
  }, [hydrateProfileAsync, setAuthSession]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signInWithMagicLink,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Protected route wrapper
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Declarative redirect prevents effect-driven redirect loops.
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
