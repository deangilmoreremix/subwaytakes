import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Palette } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { DEFAULT_BRAND_KIT, LOGO_TYPES, logoProblem, uploadLogo, validateBrand, type BrandKit } from '../lib/brand';
import { useBrandKit } from '../lib/brand/useBrandKit';
import { useBilling } from '../lib/billing/useBilling';
import { UnlockPrompt } from './UnlockPrompt';
import { Label, inputCls } from './studio/ui';

/** Logo, colours, channel handle and sponsor line. Applied to every project's title graphics and exports. */
export function BrandKitCard() {
  const { isGuest } = useAuth();
  const { has, loaded: billingLoaded } = useBilling();
  const { kit, loaded, save } = useBrandKit();
  const [draft, setDraft] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [busy, setBusy] = useState<'' | 'save' | 'logo'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  // fill the form from the saved kit once, and never over something the customer has already started typing
  const dirty = useRef(false);
  useEffect(() => { if (loaded && !dirty.current) setDraft(kit ?? DEFAULT_BRAND_KIT); }, [loaded, kit]);

  if (isGuest) return null;
  const entitled = has('brand');
  const set = <K extends keyof BrandKit>(k: K, v: BrandKit[K]) => { dirty.current = true; setDraft(d => ({ ...d, [k]: v })); };
  const problems = validateBrand(draft);

  async function onLogo(f: File | undefined) {
    if (!f) return;
    const p = logoProblem(f); if (p) { setMsg({ ok: false, text: p }); return; }
    setBusy('logo'); setMsg(null);
    try { set('logoUrl', await uploadLogo(f)); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Upload failed.' }); } finally { setBusy(''); if (file.current) file.current.value = ''; }
  }
  async function onSave() {
    setBusy('save'); setMsg(null);
    try { await save(draft); dirty.current = false; setMsg({ ok: true, text: 'Brand kit saved. It is applied to your projects.' }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' }); } finally { setBusy(''); }
  }

  return (
    <section className="rounded-2xl border border-line bg-ink-850 p-5 shadow-panel" aria-label="Brand kit">
      <div className="flex items-center gap-2 font-semibold text-white"><Palette className="h-4 w-4 text-accent" />Brand kit</div>
      <p className="mt-1 text-[12px] text-zinc-500">Your logo, colours, handle and a sponsor line on every episode.</p>
      {billingLoaded && !entitled && <UnlockPrompt feature="brand" className="mt-3" />}
      <fieldset disabled={!entitled || !!busy || !loaded} className="mt-3 space-y-3 disabled:opacity-50">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Channel handle</Label><input className={inputCls} aria-label="Channel handle" placeholder="@yourchannel" maxLength={31} value={draft.handle} onChange={e => set('handle', e.target.value)} /></div>
          <div><Label>Sponsor line (end card)</Label><input className={inputCls} aria-label="Sponsor line" placeholder="Brought to you by Acme" maxLength={80} value={draft.sponsorText} onChange={e => set('sponsorText', e.target.value)} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([['primaryColor', 'Main colour (badges)'], ['accentColor', 'Text colour (handle)']] as const).map(([k, label]) => (
            <div key={k}><Label>{label}</Label>
              <div className="flex items-center gap-2">
                <input type="color" aria-label={`${label} picker`} value={/^#[0-9a-fA-F]{6}$/.test(draft[k]) ? draft[k] : '#ffffff'} onChange={e => set(k, e.target.value)} className="h-9 w-12 rounded border border-line bg-ink-800" />
                <input className={`${inputCls} w-28`} aria-label={label} value={draft[k]} maxLength={7} onChange={e => set(k, e.target.value)} />
              </div>
            </div>
          ))}
        </div>
        <div><Label>Logo</Label>
          <div className="flex items-center gap-3">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-line bg-ink-950">
              {busy === 'logo' ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : draft.logoUrl ? <img src={draft.logoUrl} alt="Your logo" className="max-h-full max-w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-zinc-600" />}
            </div>
            <input ref={file} type="file" accept={LOGO_TYPES.join(',')} aria-label="Upload logo" onChange={e => onLogo(e.target.files?.[0])} className="text-[12px] text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[12px] file:text-zinc-100" />
            {draft.logoUrl && <button type="button" onClick={() => set('logoUrl', null)} className="text-[12px] text-zinc-500 hover:text-red-300">Remove</button>}
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">PNG, JPEG or WebP, under 2 MB. A transparent PNG works best.</p>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-zinc-300"><input type="checkbox" checked={!draft.showWatermark} onChange={e => set('showWatermark', !e.target.checked)} />Remove the "Made with SubwayTakes Studio" mark from my exports</label>
        {problems.length > 0 && <p className="text-[12px] text-amber-300">{problems[0]}</p>}
        <button type="button" onClick={onSave} disabled={problems.length > 0} className="h-9 rounded-xl bg-accent px-4 text-[12px] font-semibold text-black disabled:opacity-50">{busy === 'save' ? 'Saving…' : 'Save brand kit'}</button>
      </fieldset>
      {msg && <p role="status" className={`mt-2 text-[12px] ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
    </section>
  );
}
