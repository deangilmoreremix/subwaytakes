import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface EdgeFunctionOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Call a Supabase edge function with the CURRENT USER's access token.
 *
 * All legacy call sites used to send the anon key, which made edge-function
 * ownership checks impossible (and broke auth in functions that validate the
 * JWT). Guest sessions are anonymous Supabase users, so a session always
 * exists once AuthProvider has mounted.
 */
export async function callEdgeFunction<T = unknown>(
  name: string,
  body: unknown,
  options: EdgeFunctionOptions = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;

  const controller = new AbortController();
  const timeoutId = options.timeoutMs
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : undefined;
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!response.ok) {
      const message =
        (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
          ? (data as { error: string }).error
          : `Edge function ${name} failed with status ${response.status}`);
      throw new EdgeFunctionError(message, response.status, data);
    }

    return data as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export class EdgeFunctionError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.status = status;
    this.data = data;
  }
}
