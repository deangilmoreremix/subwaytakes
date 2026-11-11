import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles, KeyRound } from 'lucide-react';
import type { PlayerRef } from '@remotion/player';
import { PreviewCanvas, type Running } from '../components/studio/PreviewCanvas';
import { Inspector } from '../components/studio/Inspector';
import { TimelineEditor } from '../components/studio/TimelineEditor';
import { Kbd } from '../components/studio/ui';
import { ExportDialog } from '../components/studio/ExportDialog';
import { DEFAULT_TAKE, type TakeSpec } from '../lib/muapi/prompt';
import { NATIVE_MODELS, chooseNativeModel } from '../lib/muapi/registry';
import { getMuapiKey } from '../lib/muapi/client';
import { runNativeJob, listJobs, type ClipJob } from '../lib/muapi/jobs';
import { useProject } from '../lib/timeline/useProject';
import { addClip, newId, projectDuration, updateClip } from '../lib/timeline/ops';
import { probeDuration } from '../lib/timeline/media';

export function CreateTakePage() {
  const [spec, setSpec] = useState<TakeSpec>(DEFAULT_TAKE);
  const [slug, setSlug] = useState('veo3.1-fast-text-to-video');
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const hasKey = !!getMuapiKey();

  const { project, set: setProject, checkpoint, undo, redo } = useProject();
  const [selectedClip, setSelectedClip] = useState<string>();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const hasClips = project.clips.length > 0;

  // bind to the Remotion Player (mounted only once the timeline has clips)
  useEffect(() => {
    const pl = playerRef.current; if (!pl) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true), onPause = () => setPlaying(false);
    pl.addEventListener('frameupdate', onFrame); pl.addEventListener('play', onPlay); pl.addEventListener('pause', onPause);
    return () => { pl.removeEventListener('frameupdate', onFrame); pl.removeEventListener('play', onPlay); pl.removeEventListener('pause', onPause); };
  }, [hasClips, running]);

  const seek = useCallback((f: number) => { setFrame(f); playerRef.current?.seekTo(f); }, []);
  const toggle = useCallback(() => { if (hasClips) playerRef.current?.toggle(); }, [hasClips]);

  const refresh = () => listJobs().then(j => { setJobs(j); return j; }).catch(() => [] as ClipJob[]).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);

  const set = <K extends keyof TakeSpec>(k: K, v: TakeSpec[K]) => setSpec(s => {
    const next = { ...s, [k]: v };
    if (k === 'aspect' && !NATIVE_MODELS.find(m => m.slug === slug)?.aspects.includes(v as TakeSpec['aspect'])) {
      setSlug(chooseNativeModel('fast', 'text', v as TakeSpec['aspect']).slug);
    }
    return next;
  });

  const addJobToTimeline = useCallback(async (job: ClipJob) => {
    if (!job.output_url) return;
    const fps = project.fps;
    const hinted = Number(job.input?.duration) || 5;
    const secs = await probeDuration(job.output_url).catch(() => hinted);
    const frames = Math.max(6, Math.round(secs * fps));
    const track = project.tracks.find(t => t.kind === 'video')!;
    const end = project.clips.filter(c => c.trackId === track.id).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const id = newId();
    setProject(addClip(project, { id, trackId: track.id, kind: 'video', label: typeof job.input?.take === 'string' ? job.input.take : job.model, start: end, duration: frames, trimStart: 0, sourceFrames: frames, src: job.output_url, volume: 1 }));
    setSelectedClip(id);
  }, [project, setProject]);

  async function generate() {
    if (running || !hasKey) return;
    setError(''); setRunning({ status: 'queued', startedAt: Date.now() });
    try {
      const job = await runNativeJob({ spec, tier: 'fast', modelSlug: slug, onUpdate: p => setRunning(r => r && { ...r, status: p.status }) });
      await refresh();
      setRunning(null);
      await addJobToTimeline(job);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      await refresh();
    } finally { setRunning(null); }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  const model = NATIVE_MODELS.find(m => m.slug === slug);
  const clip = useMemo(() => project.clips.find(c => c.id === selectedClip), [project, selectedClip]);
  const usedUrls = useMemo(() => new Set(project.clips.map(c => c.src).filter((s): s is string => !!s)), [project]);
  const latestFailed = !hasClips ? jobs.find(j => j.status === 'failed') : undefined;
  const previewJob = hasClips ? undefined : (jobs.find(j => j.output_url) ?? latestFailed);

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:overflow-hidden">
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="h-[min(56vh,520px)] min-h-[380px] lg:h-auto lg:min-h-0 lg:flex-1">
            <PreviewCanvas aspect={spec.aspect} job={previewJob} running={running} take={spec.take} hasKey={hasKey} project={project} playerRef={playerRef} />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-ink-850 p-2 shadow-panel">
            <input value={spec.take} onChange={e => set('take', e.target.value)} placeholder="Type a hot take…" maxLength={220}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none" />
            <span className="hidden items-center gap-1 text-[11px] text-zinc-600 xl:flex"><Kbd>Ctrl</Kbd><Kbd>↵</Kbd></span>
            {hasKey ? (
              <button onClick={generate} disabled={!!running}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black shadow-glow transition hover:brightness-110 disabled:opacity-60">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {running ? 'Rendering' : 'Generate'}
                {model && <span className="hidden rounded-md bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold sm:inline">{model.label}</span>}
              </button>
            ) : (
              <Link to="/settings" className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 text-[13px] font-semibold text-accent"><KeyRound className="h-4 w-4" />Add muapi key</Link>
            )}
          </div>
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{error}</p>}
        </div>
        <div className="min-w-0 lg:min-h-0">
          <Inspector spec={spec} set={set} slug={slug} setSlug={setSlug} jobs={jobs} loading={loading} onAddJob={addJobToTimeline} usedUrls={usedUrls}
            clip={clip} onClipChange={patch => clip && setProject(updateClip(project, clip.id, patch), false)} fps={project.fps} />
        </div>
      </div>
      <TimelineEditor project={project} setProject={setProject} checkpoint={checkpoint} undo={undo} redo={redo}
        frame={Math.min(frame, Math.max(0, projectDuration(project)))} playing={playing} onSeek={seek} onToggle={toggle}
        selectedId={selectedClip} onSelect={setSelectedClip} captionDefault={spec.take} onExport={() => setExporting(true)} />
      {exporting && <ExportDialog project={project} aspect={spec.aspect} onClose={() => setExporting(false)} />}
    </div>
  );
}
