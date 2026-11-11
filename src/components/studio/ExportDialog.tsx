import { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, CheckCircle2, AlertCircle, Film } from 'lucide-react';
import { Segmented, Label } from './ui';
import { checkExportSupport, exportEpisode, type ExportContainer, type ExportResolution } from '../../lib/timeline/export';
import { projectDuration } from '../../lib/timeline/ops';
import type { Project } from '../../lib/timeline/types';
import type { Aspect } from '../../lib/muapi/registry';

type Phase = 'idle' | 'checking' | 'rendering' | 'done' | 'error';

export function ExportDialog({ project, aspect, onClose }: { project: Project; aspect: Aspect; onClose: () => void }) {
  const [container, setContainer] = useState<ExportContainer>('mp4');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<{ url: string; mb: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const secs = projectDuration(project) / project.fps;

  useEffect(() => () => { abort.current?.abort(); if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'rendering') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [phase, onClose]);

  async function start() {
    setError(''); setWarnings([]); setPhase('checking');
    try {
      const support = await checkExportSupport(project, aspect, container, resolution);
      setWarnings(support.issues.filter(i => i.severity === 'warning').map(i => i.message));
      if (!support.canRender) {
        const msg = support.issues.filter(i => i.severity === 'error').map(i => i.message).join(' ');
        throw new Error(msg || 'This browser cannot render video. Use a recent Chrome or Edge.');
      }
      abort.current = new AbortController();
      setPhase('rendering'); setProgress(0);
      const blob = await exportEpisode(project, {
        aspect, container, resolution, signal: abort.current.signal,
        onProgress: p => { setProgress(p.progress); setEta(p.renderEstimatedTime > 0 ? p.renderEstimatedTime : null); },
      });
      setResult({ url: URL.createObjectURL(blob), mb: blob.size / 1_048_576 });
      setPhase('done');
    } catch (e) {
      if (abort.current?.signal.aborted) { setPhase('idle'); return; }
      const m = e instanceof Error ? e.message : 'Export failed';
      setError(/cors|cross-origin|taint|security/i.test(m) ? `${m} The clip host may block cross-origin reads; re-generate or save the clip to storage first.` : m);
      setPhase('error');
    }
  }

  const busy = phase === 'checking' || phase === 'rendering';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Export episode">
      <div className="w-full max-w-md rounded-2xl border border-line bg-ink-850 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-white"><Film className="h-4 w-4 text-accent" />Export episode</div>
          <button onClick={() => { if (!busy) onClose(); }} disabled={busy} aria-label="Close" className="text-zinc-500 hover:text-white disabled:opacity-30"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          {(phase === 'idle' || phase === 'error') && (<>
            <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
              {[['Length', `${secs.toFixed(1)}s`], ['Shots', String(project.clips.filter(c => c.kind === 'video').length)], ['Aspect', aspect]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line bg-ink-950 py-2"><div className="text-zinc-500">{k}</div><div className="tnum font-medium text-zinc-200">{v}</div></div>
              ))}
            </div>
            <div><Label>Format</Label><Segmented value={container} onChange={setContainer} options={[{ value: 'mp4', label: 'MP4 (H.264)' }, { value: 'webm', label: 'WebM (VP8)' }]} /></div>
            <div><Label>Resolution</Label><Segmented value={resolution} onChange={setResolution} options={[{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }]} /></div>
            <p className="text-[11px] text-zinc-600">Rendering runs in your browser. Keep this tab in the foreground until it finishes.</p>
          </>)}
          {phase === 'error' && <div className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-[12px] text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          {busy && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between text-[12px] text-zinc-300">
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-accent" />{phase === 'checking' ? 'Checking browser support…' : 'Rendering'}</span>
                <span className="tnum">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-950"><div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hot transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              {eta !== null && <p className="text-[11px] text-zinc-600 tnum">About {Math.max(1, Math.round(eta / 1000))}s remaining</p>}
            </div>
          )}
          {warnings.length > 0 && busy && <p className="text-[11px] text-amber-400/80">{warnings.join(' ')}</p>}
          {phase === 'done' && result && (
            <div className="space-y-3 py-1 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
              <p className="text-[13px] font-medium text-white">Export ready</p>
              <p className="text-[12px] text-zinc-500 tnum">{container.toUpperCase()} · {resolution} · {result.mb.toFixed(1)} MB</p>
              <a href={result.url} download={`subwaytakes-episode.${container}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-5 text-[13px] font-semibold text-black shadow-glow"><Download className="h-4 w-4" />Download</a>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          {phase === 'rendering' && <button onClick={() => abort.current?.abort()} className="h-9 rounded-xl bg-white/5 px-4 text-[13px] font-medium text-zinc-200 hover:bg-white/10">Cancel</button>}
          {(phase === 'idle' || phase === 'error') && <>
            <button onClick={onClose} className="h-9 rounded-xl px-4 text-[13px] font-medium text-zinc-400 hover:text-white">Close</button>
            <button onClick={start} className="h-9 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black">{phase === 'error' ? 'Try again' : 'Start export'}</button>
          </>}
          {phase === 'done' && <button onClick={onClose} className="h-9 rounded-xl bg-white/5 px-4 text-[13px] font-medium text-zinc-200 hover:bg-white/10">Done</button>}
        </div>
      </div>
    </div>
  );
}
