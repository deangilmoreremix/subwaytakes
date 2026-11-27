import { useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { AlertCircle, Check, Crop, Loader2, X } from 'lucide-react';
import { ASPECT_CHOICES } from '../../lib/timeline/crop';
import { cropToBlob } from '../../lib/images/cropBrowser';
import { uploadMedia } from '../../lib/storage';

type Area = { x: number; y: number; width: number; height: number };

/** Crop a portrait to a shape (9:16, 1:1 or 16:9). Nothing is uploaded until "Use this crop". */
export function PortraitCrop({ portraitUrl, onUse, onClose }: { portraitUrl: string; onUse: (url: string) => Promise<void>; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [aspect, setAspect] = useState<(typeof ASPECT_CHOICES)[number]['id']>('9:16');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(portraitUrl).then(async r => { if (!r.ok) throw new Error(`Could not read the portrait (${r.status}).`); const u = URL.createObjectURL(await r.blob()); urlRef.current = u; if (live) setSrc(u); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : 'Could not read the portrait.'); });
    return () => { live = false; if (urlRef.current) URL.revokeObjectURL(urlRef.current); };
  }, [portraitUrl]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  async function use() {
    if (!src || !area) return;
    setSaving(true); setError('');
    try { const blob = await cropToBlob(src, area); await onUse(await uploadMedia(blob, 'portrait-crop.png')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the crop.'); setSaving(false); }
  }

  const ratio = ASPECT_CHOICES.find(a => a.id === aspect)!.ratio;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="crop-title" data-testid="crop-modal"
      onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-ink-850 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="crop-title" className="flex items-center gap-2 font-display text-[15px] font-semibold text-white"><Crop className="h-4 w-4 text-accent" />Crop the portrait</h2>
          <button onClick={onClose} disabled={saving} aria-label="Close" className="text-zinc-500 hover:text-white disabled:opacity-30"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          <div className="relative h-80 overflow-hidden rounded-xl border border-line bg-black">
            {src ? <Cropper image={src} crop={pos} zoom={zoom} aspect={ratio} minZoom={1} maxZoom={4} showGrid onCropChange={setPos} onZoomChange={setZoom} onCropComplete={(_a, px) => setArea(px)} />
              : <div className="grid h-full place-items-center text-[12px] text-zinc-500">{error ? '' : <span className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" />Loading…</span>}</div>}
          </div>
          <div role="radiogroup" aria-label="Shape" className="flex flex-wrap gap-1.5">
            {ASPECT_CHOICES.map(a => <button key={a.id} role="radio" aria-checked={aspect === a.id} disabled={saving} onClick={() => { setAspect(a.id); setPos({ x: 0, y: 0 }); setZoom(1); }} data-aspect={a.id}
              className={`rounded-lg border px-2.5 py-1 text-[12px] ${aspect === a.id ? 'border-accent bg-accent-soft text-white' : 'border-line text-zinc-400 hover:border-zinc-500'}`}>{a.label}</button>)}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-zinc-400"><label htmlFor="crop-zoom">Zoom</label><input id="crop-zoom" type="range" min={1} max={4} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="min-w-0 flex-1 accent-amber-400" data-testid="crop-zoom" /></div>
          {error && <p className="flex items-start gap-1.5 text-[12px] text-red-300" role="alert" data-testid="crop-error"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button onClick={onClose} disabled={saving} className="h-9 rounded-xl border border-line px-4 text-[13px] text-zinc-300 disabled:opacity-40">Cancel</button>
          <button onClick={() => void use()} disabled={saving || !area} data-testid="crop-use" className="flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-black disabled:opacity-40">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Use this crop</button>
        </div>
      </div>
    </div>
  );
}
