import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, KeyRound } from 'lucide-react';
import type { PlayerRef } from '@remotion/player';
import { PreviewCanvas, type Running } from '../components/studio/PreviewCanvas';
import { Inspector } from '../components/studio/Inspector';
import { TimelineEditor } from '../components/studio/TimelineEditor';
import { Kbd } from '../components/studio/ui';
import { ExportDialog } from '../components/studio/ExportDialog';
import { DEFAULT_TAKE, cutsPlan, cutsProblem, type TakeSpec } from '../lib/muapi/prompt';
import { placePrompt } from '../lib/places';
import { twoShotRoute, describeCharacter } from '../lib/interview';
import { runTwoShotImageJob, STILL_APPROX_USD, STILL_MODEL, buildStillInput, buildAnimateInput } from '../lib/interview/twoshot';
import { CutsPanel } from '../components/studio/CutsPanel';
import { NATIVE_MODELS, chooseNativeModel, type Pipeline } from '../lib/muapi/registry';
import { LipsyncPanel } from '../components/studio/LipsyncPanel';
import { LIPSYNC_MODELS, estimateLipsync, runLipsyncJob, validateLipsync, type LipsyncModel } from '../lib/muapi/lipsync';
import { listCharacters } from '../lib/characters';
import type { CharacterBible } from '../lib/types';
import { getMuapiKey, muapi } from '../lib/muapi/client';
import { runNativeJob, listJobs, type ClipJob } from '../lib/muapi/jobs';
import { useProject } from '../lib/timeline/useProject';
import { addClip, getTransitionContext, newId, projectDuration, setTransition, updateClip } from '../lib/timeline/ops';
import { getMediaInfo } from '../lib/timeline/media';
import { transcribeClip } from '../lib/captions/transcribe';
import { captionsToClips } from '../lib/captions/captions';
import { DEFAULT_FONT } from '../lib/captions/fonts';
import type { Sfx } from '../lib/timeline/sfx';

export function CreateTakePage() {
  const nav = useNavigate();
  const [spec, setSpec] = useState<TakeSpec>(DEFAULT_TAKE);
  const [slug, setSlug] = useState('veo3.1-fast-text-to-video');
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [captionState, setCaptionState] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' });
  const hasKey = !!getMuapiKey();

  const [pipeline, setPipeline] = useState<Pipeline>('native');
  const [characters, setCharacters] = useState<CharacterBible[]>([]);
  const [speakerId, setSpeakerId] = useState<string>();
  const [hostId, setHostId] = useState<string>();
  const [lipModel, setLipModel] = useState<LipsyncModel>('omnihuman-2-0');
  useEffect(() => { listCharacters().then(l => { setCharacters(l); setSpeakerId(id => id ?? (l.find(c => c.role === 'guest' && c.portrait_url && c.voice_id) ?? l[0])?.id); setHostId(id => id ?? (l.find(c => c.role === 'host') ?? l[0])?.id); }).catch(() => undefined); }, []);

  const { project, set: setProject, checkpoint, undo, redo } = useProject();
  const [selectedClip, setSelectedClip] = useState<string>();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const hasClips = project.clips.length > 0;
  const hostChar = characters.find(c => c.id === spec.hostCharacterId);
  const route = twoShotRoute(spec, hostChar);
  const imageRoute = route.route === 'image';
  // keep the model on the right kind (image-to-video vs text-to-video) as the route changes
  useEffect(() => {
    const cur = NATIVE_MODELS.find(m => m.slug === slug);
    if (imageRoute && cur?.mode !== 'image') setSlug('veo3.1-fast-image-to-video');
    if (!imageRoute && cur?.mode === 'image') setSlug('veo3.1-fast-text-to-video');
  }, [imageRoute, slug]);
  useEffect(() => { const t = project.style?.title; if (t && t.take !== spec.take) setProject({ ...project, style: { ...project.style, title: { ...t, take: spec.take } } }, false); }, [spec.take, project, setProject]);

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
    const secs = await getMediaInfo(job.output_url).then(i => i.durationSec).catch(() => hinted);
    const frames = Math.max(6, Math.round(secs * fps));
    const track = project.tracks.find(t => t.kind === 'video')!;
    const end = project.clips.filter(c => c.trackId === track.id).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const id = newId();
    setProject(addClip(project, { id, trackId: track.id, kind: 'video', label: typeof job.input?.take === 'string' ? job.input.take : job.model, start: end, duration: frames, trimStart: 0, sourceFrames: frames, src: job.output_url, volume: 1 }));
    setSelectedClip(id);
  }, [project, setProject]);

  const addSfx = useCallback(async (sfx: Sfx) => {
    const fps = project.fps;
    const secs = await getMediaInfo(sfx.url).then(i => i.durationSec).catch(() => 1.5);
    const frames = Math.max(6, Math.round(secs * fps));
    const track = project.tracks.find(t => t.kind === 'audio')!;
    const id = newId('sfx');
    setProject(addClip(project, { id, trackId: track.id, kind: 'audio', label: sfx.label, start: frame, duration: frames, trimStart: 0, sourceFrames: frames, src: sfx.url, volume: 1 }));
    setSelectedClip(id);
  }, [project, frame, setProject]);

  const addEffect = useCallback(() => {
    const track = project.tracks.find(t => t.kind === 'effect')!;
    const id = newId('fx');
    setProject(addClip(project, { id, trackId: track.id, kind: 'effect', label: 'Light leak', start: frame, duration: Math.round(project.fps * 1.5), trimStart: 0, effect: { type: 'light-leak', seed: 3, hueShift: 20 } }));
    setSelectedClip(id);
  }, [project, frame, setProject]);

  async function generateCaptions(clipId: string) {
    const c = project.clips.find(x => x.id === clipId);
    if (!c || c.kind !== 'video' || !c.src || captionState.busy) return;
    setCaptionState({ busy: true, error: '' });
    try {
      const sourceMs = ((c.sourceFrames ?? c.trimStart + c.duration) / project.fps) * 1000;
      const caps = await transcribeClip(c.src, sourceMs);
      const track = project.tracks.find(t => t.kind === 'caption')!;
      const fresh = captionsToClips(caps, c, track.id, project.fps, () => newId('cap'));
      if (!fresh.length) throw new Error('No speech found inside the visible part of this clip.');
      const kept = project.clips.filter(x => x.sourceClipId !== c.id); // regenerate cleanly
      setProject({ ...project, clips: [...kept, ...fresh] });
      setCaptionState({ busy: false, error: '' });
    } catch (e) {
      setCaptionState({ busy: false, error: e instanceof Error ? e.message : 'Caption generation failed' });
    }
  }

  const LIPSYNC_STAGES = ['Writing the voice', 'Preparing audio', 'Rendering the video'];
  const COST_CONFIRM_USD = 1;

  async function generateLipsync() {
    const speaker = characters.find(c => c.id === speakerId);
    if (!speaker) { setError('Choose who speaks in the Model tab.'); return; }
    const problem = validateLipsync({ speaker, script: spec.take, model: lipModel });
    if (problem) { setError(problem); return; }
    const cost = await estimateLipsync(speaker, spec.take, lipModel).catch(() => null);
    if (cost !== null && cost > COST_CONFIRM_USD && !window.confirm(`This will cost about $${cost.toFixed(2)}. Continue?`)) return;
    setError(''); setRunning({ status: 'processing', startedAt: Date.now(), stages: LIPSYNC_STAGES, stageIdx: 0 });
    try {
      const job = await runLipsyncJob({ speaker, script: spec.take, model: lipModel, scene: `${placePrompt(spec.place)}. ${spec.tone} tone, natural expressions.`, onStage: s => setRunning(r => r && { ...r, stageIdx: s === 'voice' ? 0 : s === 'prepare' ? 1 : 2 }) });
      await refresh();
      setRunning(null);
      await addJobToTimeline(job);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lipsync generation failed');
      await refresh();
    } finally { setRunning(null); }
  }

  async function generateCuts() {
    const host = characters.find(c => c.id === hostId), guest = characters.find(c => c.id === speakerId);
    const problem = cutsProblem(host, guest);
    if (problem || !host || !guest) { setError(problem ?? 'Pick a host and a guest.'); return; }
    const plan = cutsPlan(spec);
    const speakers = { host, guest };
    for (const shot of plan) {
      const p = validateLipsync({ speaker: speakers[shot.role], script: shot.text, model: lipModel });
      if (p) { setError(`${shot.role === 'host' ? 'Host' : 'Guest'}: ${p}`); return; }
    }
    const costs = await Promise.all(plan.map(shot => estimateLipsync(speakers[shot.role], shot.text, lipModel).catch(() => null)));
    const total = costs.every((c): c is number => c !== null) ? costs.reduce((a, b) => a + b, 0) : null;
    if (total !== null && total > COST_CONFIRM_USD && !window.confirm(`Both shots will cost about $${total.toFixed(2)}. Continue?`)) return;
    setError('');
    try {
      for (const shot of plan) {
        const who = shot.role === 'host' ? 'Host' : 'Guest';
        setRunning({ status: 'processing', startedAt: Date.now(), stages: LIPSYNC_STAGES.map(s => `${who}: ${s}`), stageIdx: 0 });
        const job = await runLipsyncJob({ speaker: speakers[shot.role], script: shot.text, model: lipModel, scene: `${placePrompt(spec.place)}. ${spec.tone} tone, natural expressions.`, onStage: s => setRunning(r => r && { ...r, stageIdx: s === 'voice' ? 0 : s === 'prepare' ? 1 : 2 }) });
        await addJobToTimeline(job); // appended in order: host first, then guest
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cuts generation failed');
      await refresh();
    } finally { setRunning(null); }
  }

  const TWOSHOT_STAGES = ['Making the starting image', 'Animating the interview'];
  async function generateTwoShotImage(host: NonNullable<typeof hostChar> & { portrait_url: string }) {
    const guest = characters.find(c => c.id === speakerId && c.role === 'guest' && c.portrait_url);
    const estimates = await Promise.all([
      muapi.estimate(STILL_MODEL, buildStillInput(spec, host.portrait_url, guest?.portrait_url ?? undefined)).catch(() => null),
      muapi.estimate(slug, buildAnimateInput(spec, slug, 'https://example.com/still.png', host)).catch(() => null),
    ]);
    const val = (r: Record<string, unknown> | null) => (r && typeof r.cost === 'number' ? r.cost : null);
    const total = (val(estimates[0]) ?? STILL_APPROX_USD) + (val(estimates[1]) ?? 0);
    if (total > COST_CONFIRM_USD && !window.confirm(`The starting image and the video will cost about $${total.toFixed(2)}. Continue?`)) return;
    setError(''); setRunning({ status: 'processing', startedAt: Date.now(), stages: TWOSHOT_STAGES, stageIdx: 0 });
    try {
      const job = await runTwoShotImageJob({ spec: { ...spec, hostDescription: describeCharacter(host) }, host, guestPortraitUrl: guest?.portrait_url ?? undefined, modelSlug: slug, onStage: s => setRunning(r => r && { ...r, stageIdx: s === 'still' ? 0 : 1 }) });
      await refresh();
      setRunning(null);
      await addJobToTimeline(job);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Two-shot generation failed');
      await refresh();
    } finally { setRunning(null); }
  }

  async function generate() {
    if (running || !hasKey) return;
    if (spec.format === 'cuts') { await generateCuts(); return; }
    if (pipeline === 'recast') { nav('/recast'); return; }
    if (pipeline === 'lipsync') { await generateLipsync(); return; }
    if (imageRoute && hostChar?.portrait_url) { await generateTwoShotImage({ ...hostChar, portrait_url: hostChar.portrait_url }); return; }
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

  const model = spec.format === 'cuts' ? LIPSYNC_MODELS.find(m => m.slug === lipModel) : pipeline === 'lipsync' ? LIPSYNC_MODELS.find(m => m.slug === lipModel) : NATIVE_MODELS.find(m => m.slug === slug);
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
            pipeline={pipeline} onPipeline={setPipeline}
            title={project.style?.title ? { ...project.style.title, take: spec.take } : undefined} onTitle={t => setProject({ ...project, style: { ...project.style, title: t } })}
            characters={characters} hostHint={route.hint} imageRoute={imageRoute}
            cutsSlot={<CutsPanel characters={characters} hostId={hostId} onHost={setHostId} guestId={speakerId} onGuest={setSpeakerId} />}
            lipsyncSlot={<LipsyncPanel characters={characters} speakerId={speakerId} onSpeaker={setSpeakerId} model={lipModel} onModel={setLipModel} script={spec.take} hasKey={hasKey} />}
            clip={clip} onClipChange={patch => clip && setProject(updateClip(project, clip.id, patch), false)} onAddSfx={addSfx} onAddEffect={addEffect} fps={project.fps}
            transition={clip ? getTransitionContext(project, clip.id) : { available: false, maxFrames: 0 }} onTransition={t => clip && setProject(setTransition(project, clip.id, t))}
            captionFont={project.style?.captionFont ?? DEFAULT_FONT} onCaptionFont={f => setProject({ ...project, style: { ...project.style, captionFont: f } })}
            captionCount={clip ? project.clips.filter(x => x.sourceClipId === clip.id).length : 0} captionState={captionState} onGenerateCaptions={() => clip && generateCaptions(clip.id)} hasKey={hasKey} />
        </div>
      </div>
      <TimelineEditor project={project} setProject={setProject} checkpoint={checkpoint} undo={undo} redo={redo}
        frame={Math.min(frame, Math.max(0, projectDuration(project)))} playing={playing} onSeek={seek} onToggle={toggle}
        selectedId={selectedClip} onSelect={setSelectedClip} captionDefault={spec.take} onExport={() => setExporting(true)} />
      {exporting && <ExportDialog project={project} aspect={spec.aspect} onClose={() => setExporting(false)} />}
    </div>
  );
}
