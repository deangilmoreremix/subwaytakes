import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

let _currentAuthUserId: string | null = null;

export function setCurrentAuthUser(userId: string | null) {
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
  const [isGuest, setIsGuest] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
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
    setLoading(false);
  }, []);

  const initAuth = useCallback(async (authUser: User) => {
    setCurrentAuthUser(authUser.id);
    setIsGuest(authUser.is_anonymous ?? false);
    await fetchProfile(authUser.id);
  }, [fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          await initAuth(s.user);
        })().catch(console.error);
      } else if (event === 'SIGNED_OUT') {
        setCurrentAuthUser(null);
        setProfile(null);
        setIsGuest(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        initAuth(s.user);
      } else {
        supabase.auth.signInAnonymously().then(({ error }) => {
          if (error) setLoading(false);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [initAuth]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (user?.is_anonymous) {
      const { error } = await supabase.auth.updateUser({ email, password });
      if (error) return { error: error.message };
      setIsGuest(false);
      return { error: null };
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const handleSignOut = useCallback(async () => {
    setCurrentAuthUser(null);
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
    isGuest,
    signUp,
    signIn,
    signOut: handleSignOut,
    refreshProfile,
    updateProfile,
    deductCredits,
  }), [user, session, profile, loading, isGuest, signUp, signIn, handleSignOut, refreshProfile, updateProfile, deductCredits]);

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
  if (_currentAuthUserId) return _currentAuthUserId;
  return '';
}
