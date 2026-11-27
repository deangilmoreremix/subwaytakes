import { supabase } from './supabase';
import { describeError } from './muapi/client';

/** Calls the admin-credits function. Only users listed in admin_users get answers; everyone else gets a 403. */
export async function adminCall<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-credits', { body });
  if (error) throw new Error(await describeError(error));
  return data as T;
}

/** True only for admins. Any failure (not signed in, not an admin, offline) reads as "not an admin". */
export async function checkAdmin(): Promise<boolean> {
  try { await adminCall({ action: 'whoami' }); return true; } catch { return false; }
}
