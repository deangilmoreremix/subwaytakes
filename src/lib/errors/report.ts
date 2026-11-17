import { supabase } from '../supabase';

// Browser error reporting. Reports go to a rate-limited database function; the page never fails because a report failed, and the same
// message is not sent twice in a row. No user text, prompts or URLs with queries are included.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
let sent: number[] = [];
let last = '';

/** Strip query strings and hashes from a URL so no tokens or invite codes are reported. */
export function cleanUrl(u: string): string { try { const x = new URL(u); return `${x.origin}${x.pathname}`; } catch { return ''; } }

/** Decide whether to send: not a repeat of the last one, and at most a handful per minute. Pure apart from the module counters. */
export function shouldSend(message: string, now = Date.now()): boolean {
  if (!message || message === last) return false;
  sent = sent.filter(t => now - t < WINDOW_MS);
  if (sent.length >= MAX_PER_WINDOW) return false;
  sent.push(now); last = message;
  return true;
}
export function resetReporter(): void { sent = []; last = ''; }

export function reportError(message: string, stack?: string): void {
  if (!shouldSend(message)) return;
  try { void Promise.resolve(supabase.rpc('client_error_log', { p_message: message, p_stack: stack ?? null, p_url: cleanUrl(window.location.href) })).then(() => undefined, () => undefined); } catch { /* reporting must never throw */ }
}

/** Install once at startup. */
export function installErrorReporting(): void {
  window.addEventListener('error', e => reportError(String(e.message || 'error'), e.error instanceof Error ? e.error.stack : undefined));
  window.addEventListener('unhandledrejection', e => { const r = e.reason; reportError(r instanceof Error ? r.message : String(r ?? 'unhandled rejection'), r instanceof Error ? r.stack : undefined); });
}
