import { scrubKey } from '../muapi/key';
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

/** Remove query strings and hashes from any URL inside a message or stack, and cap the length (a rejection reason can carry a signed URL or a prompt). */
export function scrub(text: string, max: number): string { return scrubKey(text).replace(/(https?:\/\/[^\s)'"]+?)[?#][^\s)'"]*/g, '$1').slice(0, max); }

export function reportError(rawMessage: string, rawStack?: string): void {
  const message = scrub(rawMessage, 300); const stack = rawStack ? scrub(rawStack, 2000) : undefined;
  if (!shouldSend(message)) return;
  // the server only takes reports from signed-in users, so a signed-out visitor's report would just be refused
  try {
    void Promise.resolve(supabase.auth.getSession())
      .then(({ data }) => (data?.session ? supabase.rpc('client_error_log', { p_message: message, p_stack: stack ?? null, p_url: cleanUrl(window.location.href) }) : undefined))
      .then(() => undefined, () => undefined);
  } catch { /* reporting must never throw */ }
}

/** Install once at startup. */
export function installErrorReporting(): void {
  window.addEventListener('error', e => reportError(String(e.message || 'error'), e.error instanceof Error ? e.error.stack : undefined));
  window.addEventListener('unhandledrejection', e => { const r = e.reason; reportError(r instanceof Error ? r.message : String(r ?? 'unhandled rejection'), r instanceof Error ? r.stack : undefined); });
}
