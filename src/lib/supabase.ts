import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Database operations will fail.');
}

// Bringing your own key, the app's tables live in their own schema in a SHARED Supabase project; the credits mode keeps the older `public` tables.
// VITE_SUPABASE_SCHEMA overrides either default.
export const DB_SCHEMA: string = import.meta.env.VITE_SUPABASE_SCHEMA || (import.meta.env.VITE_BILLING_MODE === 'credits' ? 'public' : 'subwaytakes');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { db: { schema: DB_SCHEMA as 'public' } });

export async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}
