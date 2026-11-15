// Operator actions on credits. Pure decision logic with injected dependencies (tested without Deno or Supabase).
export interface AdminCaller { id: string }
export interface AdminDeps {
  isAdmin(userId: string): Promise<boolean>;
  findUser(email: string): Promise<string | null>;
  balance(userId: string): Promise<number>;
  ledger(userId: string, limit: number): Promise<Array<Record<string, unknown>>>;
  apply(userId: string, delta: number, kind: 'grant' | 'adjust', reason: string, ref: string, actor: string): Promise<number>;
  stats(): Promise<unknown>;
  getSettings(): Promise<Record<string, unknown>>;
  setSettings(patch: Record<string, unknown>): Promise<void>;
  setModel(slug: string, patch: { enabled?: boolean; margin?: number | null; minCredits?: number }): Promise<void>;
  newRef(): string;
  log(event: string, data: Record<string, unknown>): void;
}
export interface AdminResponse { status: number; body: unknown }

const MAX_AMOUNT = 100_000;
const bad = (error: string): AdminResponse => ({ status: 400, body: { error } });
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export async function adminHandle(caller: AdminCaller | null, req: unknown, deps: AdminDeps): Promise<AdminResponse> {
  if (!caller) return { status: 401, body: { error: 'Sign in.' } };
  if (!(await deps.isAdmin(caller.id))) return { status: 403, body: { error: 'Not an admin.' } };
  if (!isObj(req) || typeof req.action !== 'string') return bad('Missing action.');

  switch (req.action) {
    case 'whoami': return { status: 200, body: { admin: true } };
    case 'stats': return { status: 200, body: await deps.stats() };
    case 'settings': return { status: 200, body: await deps.getSettings() };
    case 'lookup': {
      const email = String(req.email ?? '').trim();
      const id = email ? await deps.findUser(email) : null;
      if (!id) return { status: 404, body: { error: 'No user with that email.' } };
      return { status: 200, body: { userId: id, balance: await deps.balance(id), ledger: await deps.ledger(id, 25) } };
    }
    case 'grant':
    case 'adjust': {
      const email = String(req.email ?? '').trim();
      const reason = String(req.reason ?? '').trim();
      if (!email) return bad('Email is required.');
      if (!reason) return bad('A reason is required.');
      if (req.action === 'grant' ? !isInt(req.amount, 1, MAX_AMOUNT) : !(isInt(req.amount, -MAX_AMOUNT, MAX_AMOUNT) && req.amount !== 0)) {
        return bad(req.action === 'grant' ? `Amount must be a whole number from 1 to ${MAX_AMOUNT}.` : `Amount must be a non-zero whole number up to ${MAX_AMOUNT} either way.`);
      }
      const id = await deps.findUser(email);
      if (!id) return { status: 404, body: { error: 'No user with that email.' } };
      const ref = typeof req.ref === 'string' && req.ref.trim() ? `admin:${req.ref.trim().slice(0, 80)}` : `admin:${deps.newRef()}`;
      try {
        const balance = await deps.apply(id, req.amount as number, req.action, reason.slice(0, 200), ref, caller.id);
        deps.log('admin_credit', { action: req.action, userId: id, amount: req.amount, by: caller.id });
        return { status: 200, body: { balance } };
      } catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m.includes('would_go_negative')) return bad('That adjustment would take the balance below zero.');
        if (m.includes('ref_conflict')) return bad('That reference was already used for a different credit change. Use a new reference.');
        throw e;
      }
    }
    case 'set_settings': {
      const p = isObj(req.patch) ? req.patch : {};
      const out: Record<string, unknown> = {};
      if ('margin' in p) { if (typeof p.margin !== 'number' || p.margin < 1 || p.margin > 20) return bad('Margin must be between 1 and 20.'); out.margin = p.margin; }
      if ('maxCreditsPerCall' in p) { if (!isInt(p.maxCreditsPerCall, 1, 100_000)) return bad('Per-call cap must be a whole number.'); out.max_credits_per_call = p.maxCreditsPerCall; }
      if ('maxCallsPerMinute' in p) { if (!isInt(p.maxCallsPerMinute, 1, 1000)) return bad('Calls per minute must be a whole number.'); out.max_calls_per_minute = p.maxCallsPerMinute; }
      if ('maxOpenHolds' in p) { if (!isInt(p.maxOpenHolds, 1, 200)) return bad('Open holds must be a whole number.'); out.max_open_holds = p.maxOpenHolds; }
      if ('dailyCreditCap' in p) { if (!isInt(p.dailyCreditCap, 1, 1_000_000)) return bad('Daily cap must be a whole number.'); out.daily_credit_cap = p.dailyCreditCap; }
      if ('killSwitch' in p) { if (typeof p.killSwitch !== 'boolean') return bad('Kill switch must be true or false.'); out.kill_switch = p.killSwitch; }
      if (!Object.keys(out).length) return bad('Nothing to change.');
      await deps.setSettings(out);
      deps.log('admin_settings', { keys: Object.keys(out), by: caller.id });
      return { status: 200, body: await deps.getSettings() };
    }
    case 'set_model': {
      const slug = String(req.slug ?? '');
      if (!/^[\w.-]{1,100}$/.test(slug)) return bad('Bad model name.');
      const patch: { enabled?: boolean; margin?: number | null; minCredits?: number } = {};
      if ('enabled' in req) { if (typeof req.enabled !== 'boolean') return bad('enabled must be true or false.'); patch.enabled = req.enabled; }
      if ('margin' in req) { if (req.margin !== null && (typeof req.margin !== 'number' || req.margin < 1 || req.margin > 20)) return bad('Margin must be between 1 and 20, or null.'); patch.margin = req.margin as number | null; }
      if ('minCredits' in req) { if (!isInt(req.minCredits, 1, 10_000)) return bad('Minimum credits must be a whole number.'); patch.minCredits = req.minCredits; }
      if (!Object.keys(patch).length) return bad('Nothing to change.');
      await deps.setModel(slug, patch);
      deps.log('admin_model', { slug, by: caller.id });
      return { status: 200, body: { ok: true } };
    }
    default: return bad('Unknown action.');
  }
}
