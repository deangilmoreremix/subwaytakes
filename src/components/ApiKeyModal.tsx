import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertCircle, Check, ExternalLink, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import { Label, inputCls } from './studio/ui';
import { refreshKeyBalance } from '../lib/muapi/client';
import {
  clearKey, closeKeyModal, getKey, getKeyBalance, getKeyModal, keyProblem, maskKey, publishKeyBalance, setKey,
  subscribeKey, subscribeKeyBalance, subscribeKeyModal, InvalidKeyError, MuapiBalanceError,
} from '../lib/muapi/key';

export const MUAPI_SITE = 'https://muapi.ai';

type Check =
  | { s: 'idle' }
  | { s: 'checking' }
  | { s: 'valid'; balance: number | null }
  | { s: 'invalid'; message: string }
  | { s: 'problem'; message: string };   // the key may be fine: the check itself failed (network, proxy, no balance)

/** "12.5" -> "12.50", whatever unit muapi reports (shown as muapi's own wallet number). */
const fmtBalance = (n: number | null): string => (n === null ? 'balance not shown by muapi' : `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} muapi credits`);

/**
 * The BYOK key dialog. Mounted once (StudioShell); any button or error can open it with openKeyModal(reason).
 * The key is only ever saved in this browser and sent to our proxy to forward to muapi.
 */
export function ApiKeyModal() {
  const modal = useSyncExternalStore(subscribeKeyModal, getKeyModal);
  const saved = useSyncExternalStore(subscribeKey, getKey);
  const balance = useSyncExternalStore(subscribeKeyBalance, getKeyBalance);
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [check, setCheck] = useState<Check>({ s: 'idle' });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  // a fresh dialog every time it opens
  useEffect(() => {
    if (!modal.open) return;
    setDraft(''); setShow(false); setCheck({ s: 'idle' }); setConfirmRemove(false);
    const t = setTimeout(() => input.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [modal.open]);

  useEffect(() => {
    if (!modal.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeKeyModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal.open]);

  if (!modal.open) return null;

  const typed = draft.trim();
  const shapeError = typed ? keyProblem(typed) : null;
  const busy = check.s === 'checking';

  async function verify() {
    const problem = keyProblem(typed);
    if (problem) { setCheck({ s: 'invalid', message: problem }); return; }
    const mine = ++seq.current;
    setCheck({ s: 'checking' });
    // test the typed key without disturbing a saved one until it is accepted
    const previous = getKey();
    try {
      setKey(typed);
      const n = await refreshKeyBalance();
      if (mine !== seq.current) return;
      setCheck({ s: 'valid', balance: n });
    } catch (e) {
      if (mine !== seq.current) return;
      if (previous) setKey(previous); else clearKey();
      if (e instanceof InvalidKeyError) setCheck({ s: 'invalid', message: e.message });
      else if (e instanceof MuapiBalanceError) setCheck({ s: 'problem', message: e.message });
      else setCheck({ s: 'problem', message: e instanceof Error ? e.message : 'Could not check the key.' });
    }
  }

  function save() {
    // a verified key is already stored by verify(); saving anyway (network problem) stores what was typed
    if (check.s !== 'valid') { const p = keyProblem(typed); if (p) { setCheck({ s: 'invalid', message: p }); return; } setKey(typed); }
    closeKeyModal();
  }

  function remove() {
    clearKey(); publishKeyBalance(null); setDraft(''); setCheck({ s: 'idle' }); setConfirmRemove(false);
  }

  const canSave = !busy && !!typed && !shapeError && check.s !== 'invalid';

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="key-title" data-testid="key-modal"
      onMouseDown={e => { if (e.target === e.currentTarget) closeKeyModal(); }}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-ink-850 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="key-title" className="flex items-center gap-2 font-display text-[15px] font-semibold text-white"><KeyRound className="h-4 w-4 text-accent" />Connect your muapi key</h2>
          <button onClick={closeKeyModal} aria-label="Close" className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {modal.reason && check.s !== 'valid' && <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent-soft p-3 text-[12px] text-accent" data-testid="key-reason"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{modal.reason}</div>}

          <p className="text-[13px] leading-relaxed text-zinc-300">
            SubwayTakes Studio makes your videos with <strong className="font-semibold text-white">your own muapi account</strong>. You pay muapi directly for what you generate, and you see a price before each run.
          </p>

          {saved && (
            <div className="rounded-xl border border-line bg-ink-950 p-3" data-testid="key-saved">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">Saved key</div>
                  <div className="truncate font-mono text-[13px] text-zinc-200" data-testid="key-masked">{maskKey(saved)}</div>
                  {balance && <div className="mt-0.5 text-[11px] text-emerald-400" data-testid="key-balance">{fmtBalance(balance.amount)}</div>}
                </div>
                {!confirmRemove
                  ? <button onClick={() => setConfirmRemove(true)} className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[12px] text-zinc-300 hover:border-red-400/50 hover:text-red-300">Remove</button>
                  : <div className="flex shrink-0 items-center gap-1.5 text-[12px]"><span className="text-zinc-400">Remove it?</span>
                      <button onClick={remove} className="rounded-lg bg-red-500/90 px-2.5 py-1 font-semibold text-white" data-testid="key-remove-yes">Yes</button>
                      <button onClick={() => setConfirmRemove(false)} className="rounded-lg border border-line px-2.5 py-1 text-zinc-300">No</button></div>}
              </div>
            </div>
          )}

          <div>
            <Label hint={<a href={MUAPI_SITE} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-accent hover:underline">Get a key <ExternalLink className="h-3 w-3" /></a>}>{saved ? 'Use a different key' : 'Your muapi API key'}</Label>
            <div className="relative">
              <input ref={input} type={show ? 'text' : 'password'} value={draft} onChange={e => { seq.current++; setDraft(e.target.value); setCheck({ s: 'idle' }); }}
                onKeyDown={e => { if (e.key === 'Enter' && typed) { e.preventDefault(); if (check.s === 'valid') save(); else void verify(); } }}
                autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Paste your key here" aria-label="muapi API key" aria-invalid={check.s === 'invalid' || !!shapeError}
                className={`${inputCls} pr-10 font-mono`} data-testid="key-input" />
              <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide key' : 'Show key'} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            {shapeError && typed.length > 3 && <p className="mt-1.5 text-[12px] text-amber-300" data-testid="key-shape">{shapeError}</p>}

            <div className="mt-2 min-h-[20px] text-[12px]" aria-live="polite" data-testid="key-status">
              {check.s === 'checking' && <span className="inline-flex items-center gap-1.5 text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking with muapi…</span>}
              {check.s === 'valid' && <span className="inline-flex items-center gap-1.5 text-emerald-400"><Check className="h-3.5 w-3.5" />Key accepted and saved. {fmtBalance(check.balance)}.</span>}
              {check.s === 'invalid' && <span className="inline-flex items-start gap-1.5 text-red-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{check.message}</span>}
              {check.s === 'problem' && <span className="inline-flex items-start gap-1.5 text-amber-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{check.message} You can still save the key and try again later.</span>}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-ink-950 p-3 text-[11px] leading-relaxed text-zinc-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>Your key is saved <strong className="text-zinc-300">only in this browser</strong>. It is sent with each request to our proxy, which passes it to muapi and does not store or log it. It is never saved in your projects. Anyone using this browser profile can use the key, so remove it on a shared computer.</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button onClick={closeKeyModal} className="h-9 rounded-xl border border-line px-4 text-[13px] text-zinc-300 hover:border-zinc-500">{saved && !typed ? 'Close' : 'Cancel'}</button>
          <button onClick={() => void verify()} disabled={!typed || !!shapeError || busy} data-testid="key-verify" className="h-9 rounded-xl border border-accent/50 px-4 text-[13px] font-semibold text-accent disabled:opacity-40">Verify</button>
          <button onClick={save} disabled={!canSave} data-testid="key-save" className="h-9 rounded-xl bg-accent px-4 text-[13px] font-semibold text-black disabled:opacity-40">{check.s === 'valid' ? 'Save and close' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
