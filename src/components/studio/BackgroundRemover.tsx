import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Eraser, Loader2, X } from 'lucide-react';
import { BACKGROUND_CHOICES, type BackgroundId } from '../../lib/images/cutout';
import { cutoutSupported, removeBackground } from '../../lib/images/cutoutBrowser';
import { uploadMedia } from '../../lib/storage';

const STAGE_TEXT = { model: 'Loading the model (first time only)…', segment: 'Finding the person…', compose: 'Cutting out…' } as const;

/**
 * Remove the background of a portrait, free and on this device. Pick a background, preview before and after, and only
 * "Use this portrait" uploads anything (to your own media folder).
 */
export function BackgroundRemover({ portraitUrl, onUse, onClose }: { portraitUrl: string; onUse: (url: string) => Promise<void>; onClose: () => void }) {
  const [bg, setBg] = useState<BackgroundId>('grey');
  const [stage, setStage] = useState<keyof typeof STAGE_TEXT | 'saving' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null);
  const alive = useRef(true);
  const supported = cutoutSupported();

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !stage) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, onClose]);

  async function run() {
    setError(''); setResult(null); setStage('model');
    try {
      const res = await fetch(portraitUrl);
      if (!res.ok) throw new Error(`Could not read the portrait (${res.status}).`);
      const out = await removeBackground(await res.blob(), bg, s => { if (alive.current) setStage(s); });
      if (alive.current) setResult({ url: URL.createObjectURL(out.blob), blob: out.blob });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Could not remove the background.'); }
    finally { if (alive.current) setStage(null); }
  }

  async function use() {
    if (!result) return;
    setStage('saving'); setError('');
    try { const url = await uploadMedia(result.blob, 'portrait-cutout.png'); await onUse(url); }
    catch (e) { if (alive.current) { setError(e instanceof Error ? e.message : 'Could not save the portrait.'); setStage(null); } }
  }

  const busy = stage !== null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bg-title" data-testid="bg-modal"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-ink-850 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="bg-title" className="flex items-center gap-2 font-display text-[15px] font-semibold text-white"><Eraser className="h-4 w-4 text-accent" />Remove the background</h2>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="text-zinc-500 hover:text-white disabled:opacity-30"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {!supported && <p className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-[12px] text-amber-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />This browser cannot run the on-device model.</p>}
          <div className="grid grid-cols-2 gap-3">
            <figure><figcaption className="mb-1 text-[11px] text-zinc-500">Before</figcaption><img src={portraitUrl} alt="Portrait before" crossOrigin="anonymous" className="aspect-[9/16] w-full rounded-xl border border-line bg-ink-950 object-cover" /></figure>
            <figure><figcaption className="mb-1 text-[11px] text-zinc-500">After</figcaption>
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-line" style={{ backgroundImage: 'repeating-conic-gradient(#2a2a30 0% 25%, #1d1d22 0% 50%)', backgroundSize: '16px 16px' }}>
                {result ? <img src={result.url} alt="Portrait after" data-testid="bg-after" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-3 text-center text-[11px] text-zinc-600">{busy ? <span className="flex items-center gap-1.5 text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" />{stage === 'saving' ? 'Saving…' : STAGE_TEXT[stage as keyof typeof STAGE_TEXT]}</span> : 'Press "Remove background"'}</div>}
              </div>
            </figure>
          </div>

          <div role="radiogroup" aria-label="New background" className="flex flex-wrap gap-1.5">
            {BACKGROUND_CHOICES.map(c => (
              <button key={c.id} role="radio" aria-checked={bg === c.id} disabled={busy} onClick={() => { setBg(c.id); setResult(null); }} data-bg={c.id}
                className={`rounded-lg border px-2.5 py-1 text-[12px] transition ${bg === c.id ? 'border-accent bg-accent-soft text-white' : 'border-line text-zinc-400 hover:border-zinc-500'}`}>{c.label}</button>
            ))}
          </div>

          {error && <p className="flex items-start gap-1.5 text-[12px] text-red-300" role="alert" data-testid="bg-error"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}
          <p className="text-[11px] leading-relaxed text-zinc-600">Runs on this device with Google's open MediaPipe model (downloaded the first time, then cached). Your picture is not uploaded until you press “Use this portrait”.</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button onClick={() => void run()} disabled={busy || !supported} data-testid="bg-run" className="h-9 rounded-xl border border-accent/50 px-4 text-[13px] font-semibold text-accent disabled:opacity-40">{result ? 'Try again' : 'Remove background'}</button>
          <button onClick={() => void use()} disabled={busy || !result} data-testid="bg-use" className="flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-black disabled:opacity-40">{stage === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Use this portrait</button>
        </div>
      </div>
    </div>
  );
}
