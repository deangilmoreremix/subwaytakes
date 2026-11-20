/**
 * The customer's own muapi key. It lives ONLY in this browser (localStorage, with an in-memory fallback when storage is blocked) and is sent
 * per request to the muapi-byok proxy, which forwards it and never stores or logs it. Never put it in a project, a cloud save, a URL or an error report.
 */
const STORAGE_KEY = 'subwaytakes.muapi.key';

let memory: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

/** Why this text cannot be a key, or null when the shape is plausible. (muapi decides if it is really valid.) */
export function keyProblem(raw: string): string | null {
  const k = raw.trim();
  if (!k) return 'Paste your muapi key.';
  if (/\s/.test(k)) return 'A key has no spaces or line breaks. Copy it again.';
  if (k.length < 16) return 'That looks too short to be a key.';
  if (k.length > 200) return 'That looks too long to be a key.';
  if (!/^[\x21-\x7e]+$/.test(k)) return 'A key only uses plain letters, numbers and symbols.';
  return null;
}

/** "sk-a…9xyz": enough to recognise, never enough to use. */
export function maskKey(k: string): string {
  const t = k.trim();
  return t.length <= 8 ? '••••' : `${t.slice(0, 4)}••••••••${t.slice(-4)}`;
}

export function getKey(): string | null {
  try { const v = localStorage.getItem(STORAGE_KEY); if (v) return v; } catch { /* blocked */ }
  return memory;
}

export function setKey(raw: string): void {
  const k = raw.trim();
  const problem = keyProblem(k);
  if (problem) throw new Error(problem);
  memory = k;
  try { localStorage.setItem(STORAGE_KEY, k); } catch { /* memory copy still works for this tab */ }
  emit();
}

export function clearKey(): void {
  memory = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  emit();
}

export const hasKey = (): boolean => !!getKey();
export function subscribeKey(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

/** Remove a key from any text before it is logged or reported. */
export function scrubKey(text: string): string {
  const k = getKey();
  return k ? text.split(k).join('[key removed]') : text;
}

// ---- the modal: any button or error can ask for it
export interface KeyModalState { open: boolean; reason?: string }
let modal: KeyModalState = { open: false };
const modalListeners = new Set<() => void>();
export const getKeyModal = (): KeyModalState => modal;
export function openKeyModal(reason?: string): void { modal = { open: true, reason }; modalListeners.forEach(l => l()); }
export function closeKeyModal(): void { modal = { open: false }; modalListeners.forEach(l => l()); }
export function subscribeKeyModal(l: () => void): () => void { modalListeners.add(l); return () => { modalListeners.delete(l); }; }

// ---- the muapi wallet balance (shown in the pill and the modal)
export interface KeyBalance { amount: number | null; checkedAt: number }
let bal: KeyBalance | null = null;
const balListeners = new Set<() => void>();
export const getKeyBalance = (): KeyBalance | null => bal;
export function publishKeyBalance(amount: number | null): void { bal = { amount, checkedAt: Date.now() }; balListeners.forEach(l => l()); }
export function subscribeKeyBalance(l: () => void): () => void { balListeners.add(l); return () => { balListeners.delete(l); }; }

/** muapi does not document the balance shape: accept a plain number or the usual field names. */
export function parseBalance(json: unknown): number | null {
  if (typeof json === 'number' && Number.isFinite(json)) return json;
  if (typeof json === 'string' && json.trim() && Number.isFinite(Number(json))) return Number(json);
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    for (const k of ['balance', 'credits', 'credit_balance', 'wallet_balance', 'amount', 'data']) {
      if (k in o) { const v = parseBalance(o[k]); if (v !== null) return v; }
    }
  }
  return null;
}

// ---- errors the client raises so the UI can react (open the modal, show a top-up hint)
export class MissingKeyError extends Error { constructor() { super('Add your muapi key to generate.'); this.name = 'MissingKeyError'; } }
export class InvalidKeyError extends Error { constructor(message = 'muapi did not accept this key.') { super(message); this.name = 'InvalidKeyError'; } }
export class MuapiBalanceError extends Error { constructor(message = 'Your muapi balance is too low. Top up your muapi account and try again.') { super(message); this.name = 'MuapiBalanceError'; } }
