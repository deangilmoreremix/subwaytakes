import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          await fetchProfile(s.user.id);
        })();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
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
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id);
    }
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function updateProfile(updates: Partial<UserProfile>) {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return { error: error.message };
    await refreshProfile();
    return { error: null };
  }

  async function deductCredits(amount: number, _description: string): Promise<boolean> {
    if (!profile || profile.credits_balance < amount) return false;
    const newBalance = profile.credits_balance - amount;
    const { error } = await supabase
      .from('user_profiles')
      .update({ credits_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (error) return false;
    setProfile(prev => prev ? { ...prev, credits_balance: newBalance } : null);
    return true;
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
      deductCredits,
    }}>
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
  const stored = localStorage.getItem('clip_user_id');
  if (stored) return stored;
  const newId = crypto.randomUUID();
  localStorage.setItem('clip_user_id', newId);
  return newId;
}
