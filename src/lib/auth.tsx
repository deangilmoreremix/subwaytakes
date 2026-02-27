import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

let _currentAuthUserId: string | null = null;

function setCurrentAuthUser(userId: string | null) {
  _currentAuthUserId = userId;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_city_style: string | null;
  default_duration: number | null;
  credits_balance: number;
  subscription_tier: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: string | null }>;
  deductCredits: (amount: number, description: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const isAuthenticated = !!user;
  const isGuest = !!user?.is_anonymous;

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .upsert({
            id: userId,
            credits_balance: 100,
            subscription_tier: 'free',
            default_city_style: 'nyc',
            default_duration: 6,
          }, { onConflict: 'id' })
          .select()
          .maybeSingle();
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch {
      setProfile(null);
    }
  }, []);

  const applySession = useCallback((s: Session | null) => {
    setSession(s);
    const authUser = s?.user ?? null;
    setUser(authUser);

    if (authUser) {
      setCurrentAuthUser(authUser.id);
      fetchProfile(authUser.id).finally(() => setLoading(false));
    } else {
      setCurrentAuthUser(null);
      setProfile(null);
      setLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        applySession(s);
      } else {
        supabase.auth.signInAnonymously().then(({ error }) => {
          if (error) applySession(null);
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const handleSignOut = useCallback(async () => {
    setCurrentAuthUser(null);
    setProfile(null);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return { error: error.message };
    await fetchProfile(user.id);
    return { error: null };
  }, [user, fetchProfile]);

  const deductCredits = useCallback(async (amount: number, _description: string): Promise<boolean> => {
    if (!profile || profile.credits_balance < amount) return false;
    const { data, error } = await supabase
      .rpc('deduct_credits', { p_user_id: profile.id, p_amount: amount });
    if (error || data === false) return false;
    if (user) await fetchProfile(user.id);
    return true;
  }, [profile, user, fetchProfile]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    loading,
    isAuthenticated,
    isGuest,
    signUp,
    signIn,
    signOut: handleSignOut,
    refreshProfile,
    updateProfile,
    deductCredits,
  }), [user, session, profile, loading, isAuthenticated, isGuest, signUp, signIn, handleSignOut, refreshProfile, updateProfile, deductCredits]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getUserId(): string {
  if (!_currentAuthUserId) {
    throw new Error('Not authenticated');
  }
  return _currentAuthUserId;
}
