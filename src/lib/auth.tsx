import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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

function buildGuestProfile(): UserProfile {
  const guestId = getGuestId();
  const now = new Date().toISOString();
  return {
    id: guestId,
    display_name: 'Guest',
    avatar_url: null,
    default_city_style: 'nyc',
    default_duration: 6,
    credits_balance: 100,
    subscription_tier: 'free',
    created_at: now,
    updated_at: now,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const handleAuthUser = useCallback(async (authUser: User, isNewLogin: boolean) => {
    setCurrentAuthUser(authUser.id);
    setIsGuest(false);
    if (isNewLogin) {
      await migrateGuestDataToUser(authUser.id);
    }
    await fetchProfile(authUser.id);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setCurrentAuthUser(s.user.id);
        fetchProfile(s.user.id);
      } else {
        setCurrentAuthUser(null);
        activateGuestMode();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const isNewLogin = event === 'SIGNED_IN';
        (async () => {
          await handleAuthUser(s.user, isNewLogin);
        })().catch(console.error);
      } else {
        setCurrentAuthUser(null);
        activateGuestMode();
      }
    });

    return () => subscription.unsubscribe();
  }, [handleAuthUser]);

  function activateGuestMode() {
    setIsGuest(true);
    setProfile(buildGuestProfile());
    setLoading(false);
  }

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
    setCurrentAuthUser(null);
    await supabase.auth.signOut();
    activateGuestMode();
  }

  async function updateProfile(updates: Partial<UserProfile>) {
    if (isGuest) {
      setProfile(prev => prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : null);
      return { error: null };
    }
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return { error: error.message };
    await refreshProfile();
    return { error: null };
  }

  async function deductCredits(amount: number, description: string): Promise<boolean> {
    if (!profile || profile.credits_balance < amount) return false;
    if (isGuest) {
      const guestKey = `guest_credits_${getUserId()}`;
      const stored = localStorage.getItem(guestKey);
      const currentBalance = stored !== null ? Number(stored) : profile.credits_balance;
      if (currentBalance < amount) return false;
      const newBalance = currentBalance - amount;
      localStorage.setItem(guestKey, String(newBalance));
      setProfile(prev => prev ? { ...prev, credits_balance: newBalance } : null);
      return true;
    }
    const { data, error } = await supabase
      .rpc('deduct_credits', { p_user_id: profile.id, p_amount: amount });
    if (error || data === false) return false;
    await refreshProfile();
    return true;
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      isGuest,
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
  if (_currentAuthUserId) return _currentAuthUserId;
  const stored = localStorage.getItem('clip_user_id');
  if (stored) return stored;
  const newId = crypto.randomUUID();
  localStorage.setItem('clip_user_id', newId);
  return newId;
}

export function getGuestId(): string {
  const stored = localStorage.getItem('clip_user_id');
  if (stored) return stored;
  const newId = crypto.randomUUID();
  localStorage.setItem('clip_user_id', newId);
  return newId;
}

const TABLES_WITH_USER_ID = [
  'clips',
  'episodes',
  'episode_scripts',
  'character_bibles',
  'compilations',
  'video_exports',
] as const;

export async function migrateGuestDataToUser(authUserId: string): Promise<void> {
  const guestId = localStorage.getItem('clip_user_id');
  if (!guestId || guestId === authUserId) return;

  for (const table of TABLES_WITH_USER_ID) {
    const { error } = await supabase
      .from(table)
      .update({ user_id: authUserId })
      .eq('user_id', guestId);
    if (error) {
      console.error(`Failed to migrate ${table}:`, error);
    }
  }

  localStorage.removeItem('clip_user_id');
}
