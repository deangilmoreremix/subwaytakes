import { useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { areaForCrop, cropFromArea, MAX_ZOOM, MIN_ZOOM, normalizeCrop, type ClipCrop } from '../../lib/timeline/crop';
import { extractFrames } from '../../lib/recast/frames';

/**
 * Reframe a video clip: drag and zoom over a still from the clip, and the exported video is framed the same way.
 * Only a zoom and a focal point are stored on the clip (see lib/timeline/crop.ts); the video file is not changed.
 */
export function ClipReframe({ src, atSeconds, frameAspect, crop, onChange }: { src: string; atSeconds: number; frameAspect: number; crop?: ClipCrop; onChange: (c: ClipCrop | undefined) => void }) {
  const [poster, setPoster] = useState<{ url: string; aspect: number } | null>(null);
  const [error, setError] = useState('');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(crop?.zoom ?? 1);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    setPoster(null); setError('');
    extractFrames(src, [Math.max(0, atSeconds)], 720).then(async ([blob]) => {
      const url = URL.createObjectURL(blob); urlRef.current = url;
      const img = new Image(); img.src = url; await img.decode();
      if (live) setPoster({ url, aspect: img.naturalWidth / img.naturalHeight });
    }).catch(e => { if (live) setError(e instanceof Error ? e.message : 'Could not read a picture from this clip.'); });
    return () => { live = false; if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; } };
  }, [src, atSeconds]);

  if (error) return <p className="flex items-start gap-1.5 text-[11px] text-amber-300" role="alert"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>;
  if (!poster) return <p className="flex items-center gap-1.5 text-[11px] text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading a picture from the clip…</p>;

  const initial = areaForCrop(crop, poster.aspect, frameAspect);
  return (
    <div className="space-y-2" data-testid="reframe">
      <div className="relative h-72 overflow-hidden rounded-xl border border-line bg-black">
        <Cropper image={poster.url} crop={pos} zoom={zoom} aspect={frameAspect} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} showGrid
          initialCroppedAreaPercentages={initial}
          onCropChange={setPos} onZoomChange={setZoom}
          onCropComplete={area => onChange(cropFromArea(area, zoom) ?? undefined)} />
      </div>
      <div className="flex items-center gap-2 text-[12px] text-zinc-400">
        <label htmlFor="reframe-zoom" className="shrink-0">Zoom</label>
        <input id="reframe-zoom" type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="min-w-0 flex-1 accent-amber-400" data-testid="reframe-zoom" />
        <span className="tnum w-10 text-right">{zoom.toFixed(1)}×</span>
        <button onClick={() => { setPos({ x: 0, y: 0 }); setZoom(1); onChange(undefined); }} aria-label="Reset framing" className="rounded-lg border border-line p-1.5 text-zinc-400 hover:text-white"><RotateCcw className="h-3.5 w-3.5" /></button>
      </div>
      <p className="text-[11px] text-zinc-600">{normalizeCrop(crop) ? 'Reframed. The clip file itself is not changed.' : 'Drag to choose what stays in the middle, zoom to crop in.'}</p>
    </div>
  );
}
