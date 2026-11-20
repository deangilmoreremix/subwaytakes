import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Sparkles, UserPlus } from 'lucide-react';
import type { PlayerRef } from '@remotion/player';
import { PreviewCanvas, type Running } from '../components/studio/PreviewCanvas';
import { Inspector } from '../components/studio/Inspector';
import { TimelineEditor } from '../components/studio/TimelineEditor';
import { Kbd } from '../components/studio/ui';
import { ExportDialog } from '../components/studio/ExportDialog';
import { DEFAULT_TAKE, cutsPlan, cutsProblem, type TakeSpec } from '../lib/muapi/prompt';
import { placePrompt } from '../lib/places';
import { SAMPLE_ANSWERS, applyShow, showOf, titleFor, type ShowId } from '../lib/shows';
import { resolveTitle } from '../lib/shows/stored';
import { twoShotRoute, describeCharacter, buildNativePrompt, spokenLines } from '../lib/interview';
import { batchSpecs } from '../lib/interview/batch';
import { runTwoShotImageJob, STILL_APPROX_CREDITS, STILL_MODEL, buildStillInput, buildAnimateInput } from '../lib/interview/twoshot';
import { CutsPanel } from '../components/studio/CutsPanel';
import { NATIVE_MODELS, chooseNativeModel, type Pipeline } from '../lib/muapi/registry';
import { LipsyncPanel } from '../components/studio/LipsyncPanel';
import { LIPSYNC_MODELS, estimateLipsync, runLipsyncJob, validateLipsync, type LipsyncModel } from '../lib/muapi/lipsync';
import { listCharacters } from '../lib/characters';
import type { CharacterBible } from '../lib/types';
import { muapi } from '../lib/muapi/client';
import { useAuth } from '../lib/auth';
import { hasKey, openKeyModal, subscribeKey } from '../lib/muapi/key';
import { IS_BYOK } from '../lib/mode';
import { BLOCK_TEXT, CONFIRM_CREDITS, formatCredits } from '../lib/credits';
import { runNativeJob, listJobs, type ClipJob } from '../lib/muapi/jobs';
import { useProject } from '../lib/timeline/useProject';
import { useCloudProject } from '../lib/projects/useCloudProject';
import { useSearchParams } from 'react-router-dom';
import { useBrandKit } from '../lib/brand/useBrandKit';
import { useBilling } from '../lib/billing/useBilling';
import { sameBrand, snapshotBrand } from '../lib/brand/model';
import { OnboardingCard } from '../components/OnboardingCard';
import { useOnboardingFlags } from '../lib/onboarding';
import { applyTemplate, type Template } from '../lib/templates';
import type { Clip } from '../lib/timeline/types';
import { addClip, assembleBestOf, getTransitionContext, newId, projectDuration, setTransition, updateClip } from '../lib/timeline/ops';
import { getMediaInfo } from '../lib/timeline/media';
import { applyTakeEdit, editableText, isComposed, recomposeBible } from '../lib/bible/spec';
import { restoreSpec, snapshotSpec } from '../lib/interview/snapshot';
import { hasFeature, showLocked } from '../lib/billing/features';
import { GenerateCaptionsModal } from '../components/studio/captions/GenerateCaptionsModal';
import { CaptionStudioModal } from '../components/studio/captions/CaptionStudioModal';
import { DEFAULT_CAPTION_STYLE } from '../lib/captions/presets';
import type { CaptionStyle } from '../lib/captions/model';
import { DEFAULT_FONT } from '../lib/captions/fonts';
import type { Sfx } from '../lib/timeline/sfx';

const DEFAULT_SPEC_JSON = JSON.stringify(snapshotSpec(DEFAULT_TAKE));

export function CreateTakePage() {
  const nav = useNavigate();
  const [spec, setSpec] = useState<TakeSpec>(DEFAULT_TAKE);
  const [slug, setSlug] = useState('veo3.1-fast-text-to-video');
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [capModal, setCapModal] = useState<'generate' | 'studio' | null>(null);
  const { generationBlock: block, profile } = useAuth();
  const keyed = useSyncExternalStore(subscribeKey, hasKey);
  const canGenerate = !block;
  /** Say so up front when the balance cannot cover a plan, so nothing starts that cannot finish. Returns true when it is fine to go on. */
  const affordable = (needed: number): boolean => {
    const have = profile?.credits_balance;
    if (typeof have === 'number' && have < needed) { setError(`You need ${(needed - have).toLocaleString('en-US')} more credits (this costs about ${needed.toLocaleString('en-US')}, you have ${have.toLocaleString('en-US')}). Open Settings to see your credits.`); return false; }
    return true;
  };

  const [pipeline, setPipeline] = useState<Pipeline>('native');
  const [characters, setCharacters] = useState<CharacterBible[]>([]);
  const [speakerId, setSpeakerId] = useState<string>();
  const [hostId, setHostId] = useState<string>();
  const [guest2Id, setGuest2Id] = useState<string>();
  const [lipModel, setLipModel] = useState<LipsyncModel>('omnihuman-2-0');
  useEffect(() => { listCharacters().then(l => { setCharacters(l); setSpeakerId(id => id ?? (l.find(c => c.role === 'guest' && c.portrait_url && c.voice_id) ?? l[0])?.id); setHostId(id => id ?? (l.find(c => c.role === 'host') ?? l[0])?.id); }).catch(() => undefined); }, []);

  const { project, set: setProject, checkpoint, undo, redo, getProject } = useProject();
  const [search, setSearch] = useSearchParams();
  const openId = search.get('project');
  const cloud = useCloudProject({ project, setProject, getProject, openId });
  const { flags: onboarding, update: updateOnboarding } = useOnboardingFlags();
  // keep the project's brand in step with the saved kit (and with whether the licence is owned)
  const { kit: brandKit, loaded: brandLoaded } = useBrandKit();
  const { has: hasPack, loaded: billingLoaded, owned: ownedPacks } = useBilling();
  const entitledBrand = hasPack('brand');
  useEffect(() => {
    if (!brandLoaded || !billingLoaded) return;
    const cur = getProject();
    const snap = snapshotBrand(brandKit, entitledBrand);
    if (sameBrand(cur.style?.brand, snap)) return;
    const style = { ...cur.style, brand: snap };
    if (!snap) delete style.brand;
    setProject({ ...cur, style }, false);
  }, [brandKit, brandLoaded, billingLoaded, entitledBrand, getProject, setProject, project.clips.length]);
  const applyTpl = (t: Template) => {
    const r = applyTemplate(spec, t);
    setSpec(recomposeBible(r.spec));
    const cur = getProject();
    setProject({ ...cur, style: { ...cur.style, captionFont: r.captionFont } });
  };
  useEffect(() => { if (openId) setSearch(prev => { const n = new URLSearchParams(prev); n.delete('project'); return n; }, { replace: true }); }, [openId, setSearch]);
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
  // The episode being made is saved with the project (`style.take`) and read back when the project is loaded, opened from the library or undone. While the user edits, the spec
  // is written into the project; when the project changes underneath us, the spec is restored from it (validated, never unlocking a pack).
  const specJson = JSON.stringify(snapshotSpec(spec));
  const projTakeJson = project.style?.take ? JSON.stringify(project.style.take) : '';
  const syncedTake = useRef('');
  /** A saved episode that could NOT be restored as it was (its pack is not owned now, or it is damaged): the saved copy is kept untouched until the customer changes the episode, so buying the pack back (or fixing the account) brings it back. */
  const heldSaved = useRef<{ saved: string; restored: string } | null>(null);
  useEffect(() => {
    if (!billingLoaded && projTakeJson && projTakeJson !== syncedTake.current && projTakeJson !== specJson) return;   // wait: what the account has unlocked decides what may be restored
    if (specJson === projTakeJson) { syncedTake.current = specJson; return; }
    if (projTakeJson && projTakeJson !== syncedTake.current) {
      syncedTake.current = projTakeJson;
      const restored = restoreSpec(project.style?.take, { showLocked: id => showLocked(id, ownedPacks), cutsLocked: !hasFeature('cuts', ownedPacks) });
      if (restored) { const rj = JSON.stringify(snapshotSpec(restored)); heldSaved.current = rj !== projTakeJson ? { saved: projTakeJson, restored: rj } : null; setSpec(restored); return; }
    }
    if (!projTakeJson && specJson === DEFAULT_SPEC_JSON) { syncedTake.current = specJson; return; }   // a fresh project with nothing chosen yet stays clean
    const held = heldSaved.current;
    if (held && projTakeJson === held.saved && specJson === held.restored) return;   // do not overwrite what could not be restored; only the customer's own change does
    heldSaved.current = null;
    syncedTake.current = specJson;
    const cur = getProject();
    setProject({ ...cur, style: { ...cur.style, take: snapshotSpec(spec) } }, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specJson, projTakeJson, billingLoaded]);
  // keep the on-screen graphic in step with the show and what is said
  useEffect(() => {
    const cur = getProject();   // the newest project, not the copy this render captured (another effect may have just written to it)
    const t = resolveTitle(cur.style?.title);
    if (!t) return;
    if (heldSaved.current && specJson === heldSaved.current.restored && JSON.stringify(cur.style?.take ?? null) === heldSaved.current.saved) return;   // the saved episode is on hold: keep its card too
    if (!cur.style?.take && specJson === DEFAULT_SPEC_JSON) return;   // an older project (a title but no saved episode): the untouched default spec must not replace its card
    const data = titleFor(spec);
    if (JSON.stringify(data) !== JSON.stringify(t.data)) setProject({ ...cur, style: { ...cur.style, title: { ...t, data } } }, false);
  }, [spec, specJson, project, setProject, getProject]);

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
    let next = { ...s, [k]: v };
    if (k === 'show') next = applyShow(s, v as ShowId); // the show sets the question, tone and place defaults
    if (k === 'aspect' && !NATIVE_MODELS.find(m => m.slug === slug)?.aspects.includes(v as TakeSpec['aspect'])) {
      setSlug(chooseNativeModel('fast', 'text', v as TakeSpec['aspect']).slug);
    }
    if (k === 'quote' && v && s.show === 'motivation' && s.reflection === undefined) next = { ...next, reflection: s.take === SAMPLE_ANSWERS.motivation[0] ? '' : s.take };   // the customer's own advice becomes their comment on the quote (and comes back if the quote is removed)
    if (k === 'quote' && !v && s.show === 'motivation') next = { ...next, take: s.reflection?.trim() || SAMPLE_ANSWERS.motivation[0], reflection: undefined };   // clearing the quote goes back to the guest's own advice
    if (['show', 'verse', 'quote', 'reflection', 'durationSeconds', 'question', 'format'].includes(k)) next = recomposeBible(next);   // Scripture: keep the spoken line in step
    return next;
  });

  const addJobToTimeline = useCallback(async (job: ClipJob) => {
    if (!job.output_url) return;
    const hinted = Number(job.input?.duration) || 5;
    const secs = await getMediaInfo(job.output_url).then(i => i.durationSec).catch(() => hinted);
    // read the project AFTER the await: a batch calls this repeatedly from one closure, and a stale copy would drop earlier clips
    const cur = getProject();
    const frames = Math.max(6, Math.round(secs * cur.fps));
    const track = cur.tracks.find(t => t.kind === 'video')!;
    const end = cur.clips.filter(c => c.trackId === track.id).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const id = newId();
    setProject(addClip(cur, { id, trackId: track.id, kind: 'video', label: typeof job.input?.take === 'string' ? job.input.take : job.model, start: end, duration: frames, trimStart: 0, sourceFrames: frames, src: job.output_url, volume: 1 }));
    setSelectedClip(id);
  }, [getProject, setProject]);

  /** A dubbed version of a clip, added after the last clip. Reads the project after the await (see CLAUDE.md). */
  const addDubToTimeline = useCallback(async (url: string, label: string, fallbackSeconds: number) => {
    const secs = await getMediaInfo(url).then(i => i.durationSec).catch(() => fallbackSeconds);
    const cur = getProject();
    const frames = Math.max(6, Math.round(secs * cur.fps));
    const track = cur.tracks.find(t => t.kind === 'video')!;
    const end = cur.clips.filter(c => c.trackId === track.id).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const id = newId();
    setProject(addClip(cur, { id, trackId: track.id, kind: 'video', label, start: end, duration: frames, trimStart: 0, sourceFrames: frames, src: url, volume: 1 }));
    setSelectedClip(id);
  }, [getProject, setProject]);

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

  /** Captions from the Generate modal: replaces that shot's captions. Reads the newest project (the transcription ran for a while). */
  function applyGenerated(a: { clip: Clip; captions: Clip[]; style: CaptionStyle }) {
    const cur = getProject();
    const kept = cur.clips.filter(x => x.sourceClipId !== a.clip.id);
    setProject({ ...cur, clips: [...kept, ...a.captions], style: { ...cur.style, captions: a.style } });
    setCapModal('studio');
  }
  /** Studio Apply: the edited caption lines and look replace the Captions track. */
  function applyStudio(caps: Clip[], style: CaptionStyle) {
    const cur = getProject();
    setProject({ ...cur, clips: [...cur.clips.filter(x => x.kind !== 'caption'), ...caps], style: { ...cur.style, captions: style } });
  }

  const LIPSYNC_STAGES = ['Writing the voice', 'Preparing audio', 'Rendering the video'];

  async function generateLipsync() {
    const speaker = characters.find(c => c.id === speakerId);
    if (!speaker) { setError('Choose who speaks in the Model tab.'); return; }
    const problem = validateLipsync({ speaker, script: spec.take, model: lipModel });
    if (problem) { setError(problem); return; }
    const cost = await estimateLipsync(speaker, spec.take, lipModel).catch(() => null);
    if (cost !== null && !affordable(cost)) return;
    if (cost !== null && cost > CONFIRM_CREDITS && !window.confirm(`This will cost about ${formatCredits(cost)}. Continue?`)) return;
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
    const host = characters.find(c => c.id === hostId), guest = characters.find(c => c.id === speakerId), guest2 = characters.find(c => c.id === guest2Id);
    const duel = showOf(spec.show).guests === 2;
    const problem = cutsProblem(host, guest, guest2, duel);
    if (problem || !host || !guest || (duel && !guest2)) { setError(problem ?? 'Pick a host and a guest.'); return; }
    const plan = cutsPlan(spec);
    const speakers = { host, guest, guest2: guest2 ?? guest };
    const roleName = { host: 'Host', guest: duel ? 'Guest A' : 'Guest', guest2: 'Guest B' } as const;
    for (const shot of plan) {
      const p = validateLipsync({ speaker: speakers[shot.role], script: shot.text, model: lipModel });
      if (p) { setError(`${roleName[shot.role]}: ${p}`); return; }
    }
    const costs = await Promise.all(plan.map(shot => estimateLipsync(speakers[shot.role], shot.text, lipModel).catch(() => null)));
    const total = costs.every((c): c is number => c !== null) ? costs.reduce((a, b) => a + b, 0) : null;
    if (total !== null && !affordable(total)) return;
    if (total !== null && total > CONFIRM_CREDITS && !window.confirm(`All ${plan.length} shots will cost about ${formatCredits(total)}. Continue?`)) return;
    setError('');
    try {
      for (const shot of plan) {
        const who = roleName[shot.role];
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

  const [batch, setBatch] = useState<{ running: boolean; done: number; total: number; failed: string[] } | null>(null);
  async function runBatch(lines: string[]) {
    if (running || batch?.running || !canGenerate) return;
    if (spec.format !== 'twoshot' || imageRoute) { setError('Batch works with the Two-shot format and a described host.'); return; }
    const { specs, problem } = batchSpecs(spec, lines);
    if (problem) { setError(problem); return; }
    if (!specs.length) return;
    const one = await muapi.estimate(slug, { prompt: buildNativePrompt(specs[0]), aspect_ratio: spec.aspect, duration: spec.durationSeconds }).catch(() => null);
    const each = one && typeof one.cost === 'number' ? one.cost : null;
    if (each !== null && !affordable(each * specs.length)) return;
    const msg = each !== null ? `Queue ${specs.length} episodes at about ${formatCredits(each)} each, ${formatCredits(each * specs.length)} in total?` : `Queue ${specs.length} episodes? The price could not be estimated.`;
    if (!window.confirm(msg)) return;
    setError(''); setBatch({ running: true, done: 0, total: specs.length, failed: [] });
    const failed: string[] = []; let done = 0;
    for (let i = 0; i < specs.length; i++) {
      setRunning({ status: 'queued', startedAt: Date.now(), stages: [`Episode ${i + 1} of ${specs.length}`], stageIdx: 0 });
      try {
        const job = await runNativeJob({ spec: specs[i], tier: 'fast', modelSlug: slug });
        await addJobToTimeline(job);
        done++;
      } catch (e) { failed.push(`Episode ${i + 1}: ${e instanceof Error ? e.message : 'failed'}`); } // one failure never stops the rest
      setBatch({ running: true, done, total: specs.length, failed: [...failed] });
    }
    setBatch({ running: false, done, total: specs.length, failed });
    setRunning(null);
    await refresh();
  }

  const TWOSHOT_STAGES = ['Making the starting image', 'Animating the interview'];
  async function generateTwoShotImage(host: NonNullable<typeof hostChar> & { portrait_url: string }) {
    const guest = characters.find(c => c.id === speakerId && c.role === 'guest' && c.portrait_url);
    const estimates = await Promise.all([
      muapi.estimate(STILL_MODEL, buildStillInput(spec, host.portrait_url, guest?.portrait_url ?? undefined)).catch(() => null),
      muapi.estimate(slug, buildAnimateInput(spec, slug, 'https://example.com/still.png', host)).catch(() => null),
    ]);
    const val = (r: { cost: number } | null) => (r && typeof r.cost === 'number' ? r.cost : null);
    const total = (val(estimates[0]) ?? STILL_APPROX_CREDITS) + (val(estimates[1]) ?? 0);
    if (!affordable(total)) return;
    if (total > CONFIRM_CREDITS && !window.confirm(`The starting image and the video will cost about ${formatCredits(total)}. Continue?`)) return;
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

  // Bringing your own key the money is the customer's own: show the price of a plain clip before they press Generate (asked once per model, shape and length)
  const [nativePrice, setNativePrice] = useState<{ key: string; cost: number } | null>(null);
  const priceKey = `${slug}|${spec.aspect}|${spec.durationSeconds}`;
  useEffect(() => {
    if (!IS_BYOK || !canGenerate || pipeline !== 'native' || spec.format === 'cuts') return;
    let live = true;
    const t = setTimeout(() => {
      muapi.estimate(slug, { prompt: buildNativePrompt(spec), aspect_ratio: spec.aspect, duration: spec.durationSeconds })
        .then(r => { if (live && typeof r.cost === 'number') setNativePrice({ key: priceKey, cost: r.cost }); }).catch(() => { /* the price is a courtesy: generating still works */ });
    }, 700);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey, canGenerate, pipeline, spec.format]);
  const shownPrice = nativePrice && nativePrice.key === priceKey ? nativePrice.cost : null;

  async function generate() {
    if (running || !canGenerate) return;
    if (spec.format === 'cuts') { await generateCuts(); return; }
    if (pipeline === 'recast') { nav('/recast'); return; }
    if (pipeline === 'lipsync') { await generateLipsync(); return; }
    if (imageRoute && hostChar?.portrait_url) { await generateTwoShotImage({ ...hostChar, portrait_url: hostChar.portrait_url }); return; }
    if (IS_BYOK && shownPrice !== null && shownPrice > CONFIRM_CREDITS && !window.confirm(`This will cost about ${formatCredits(shownPrice)} from your muapi balance. Continue?`)) return;
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
      {cloud.conflict && (
        <div role="alert" className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-[13px] text-amber-100">
          <span className="min-w-0 flex-1">This project was changed on another device or tab. Nothing was overwritten. Which copy do you want to continue with?</span>
          <button onClick={() => { void cloud.useLatest().catch(e => setError(e instanceof Error ? e.message : 'Could not open it.')); }} className="h-8 rounded-lg bg-amber-400/20 px-3 text-[12px] font-semibold text-amber-200 hover:bg-amber-400/30">Use the other copy</button>
          <button onClick={() => { void cloud.keepMine().catch(e => setError(e instanceof Error ? e.message : 'Could not save a copy.')); }} className="h-8 rounded-lg border border-line px-3 text-[12px] text-zinc-200 hover:bg-white/5">Keep mine as a new project</button>
        </div>
      )}
      {!onboarding.dismissed && (
        <OnboardingCard onDismiss={() => updateOnboarding({ dismissed: true })} input={{
          customised: spec.show !== DEFAULT_TAKE.show || spec.place.city !== DEFAULT_TAKE.place.city || spec.place.scene !== DEFAULT_TAKE.place.scene || spec.place.time !== DEFAULT_TAKE.place.time,
          tookTake: spec.take.trim() !== '' && spec.take !== DEFAULT_TAKE.take, balance: profile?.credits_balance ?? null, hasKey: keyed,
          videoClips: project.clips.filter(c => c.kind === 'video').length, captionClips: project.clips.filter(c => c.kind === 'caption').length, exported: !!onboarding.exported }} />
      )}
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="h-[min(56vh,520px)] min-h-[380px] lg:h-auto lg:min-h-0 lg:flex-1">
            <PreviewCanvas aspect={spec.aspect} job={previewJob} running={running} take={spec.take} question={spokenLines(spec).host} canGenerate={canGenerate} project={project} playerRef={playerRef} />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-ink-850 p-2 shadow-panel">
            <input value={editableText(spec)} onChange={e => setSpec(s => applyTakeEdit(s, e.target.value))} placeholder={isComposed(spec) ? 'What it means to you…' : 'Type a hot take…'} maxLength={220} aria-label={isComposed(spec) ? 'Your own words' : 'Your take'}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] text-white placeholder:text-zinc-600 focus:outline-none" />
            <span className="hidden items-center gap-1 text-[11px] text-zinc-600 xl:flex"><Kbd>Ctrl</Kbd><Kbd>↵</Kbd></span>
            {canGenerate ? (
              <button onClick={generate} disabled={!!running}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black shadow-glow transition hover:brightness-110 disabled:opacity-60">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {running ? 'Rendering' : 'Generate'}
                {model && <span className="hidden rounded-md bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold sm:inline">{model.label}</span>}
                {shownPrice !== null && <span data-testid="native-price" className="rounded-md bg-black/15 px-1.5 py-0.5 text-[10px] font-semibold tnum">~{formatCredits(shownPrice)}</span>}
              </button>
            ) : (
              block === 'nokey'
                ? <button onClick={() => openKeyModal()} title={BLOCK_TEXT.nokey} data-testid="create-add-key" className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 text-[13px] font-semibold text-accent"><KeyRound className="h-4 w-4" />Add muapi key</button>
                : <Link to={block === 'guest' ? '/login' : '/settings'} title={block ? BLOCK_TEXT[block] : undefined} className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 text-[13px] font-semibold text-accent"><UserPlus className="h-4 w-4" />{block === 'unverified' ? 'Confirm your email' : 'Create an account'}</Link>
            )}
          </div>
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{error}</p>}
          {batch && (
            <div role="status" className="rounded-xl border border-line bg-ink-850 px-3 py-2 text-[12px] text-zinc-300">
              {batch.running ? 'Rendering' : 'Finished'}: {batch.done}/{batch.total} done{batch.failed.length ? `, ${batch.failed.length} failed` : ''}.
              {batch.failed.map((f, i) => <span key={i} className="block text-red-300">{f}</span>)}
            </div>
          )}
        </div>
        <div className="min-w-0 lg:min-h-0">
          <Inspector aiLabel={project.style?.aiLabel !== false} onAiLabel={on => { const cur = getProject(); setProject({ ...cur, style: { ...cur.style, aiLabel: on } }); }} onAddDub={addDubToTimeline} onTemplate={applyTpl} spec={spec} set={set} slug={slug} setSlug={setSlug} jobs={jobs} loading={loading} onAddJob={addJobToTimeline} usedUrls={usedUrls}
            pipeline={pipeline} onPipeline={setPipeline}
            title={resolveTitle(project.style?.title) ?? undefined} onTitle={t => { const cur = getProject(); setProject({ ...cur, style: { ...cur.style, title: t } }); }}
            onBestOf={() => setProject(assembleBestOf(project))} videoClipCount={project.clips.filter(c => c.kind === 'video').length} onBatch={runBatch} batch={batch}
            characters={characters} hostHint={route.hint} imageRoute={imageRoute}
            cutsSlot={<CutsPanel characters={characters} hostId={hostId} onHost={setHostId} guestId={speakerId} onGuest={setSpeakerId} duel={showOf(spec.show).guests === 2} guest2Id={guest2Id} onGuest2={setGuest2Id} />}
            lipsyncSlot={<LipsyncPanel characters={characters} speakerId={speakerId} onSpeaker={setSpeakerId} model={lipModel} onModel={setLipModel} script={spec.take} canGenerate={canGenerate} />}
            clip={clip} onClipChange={patch => { const cur = getProject(); if (clip) setProject(updateClip(cur, clip.id, patch), false); }} onAddSfx={addSfx} onAddEffect={addEffect} fps={project.fps}
            transition={clip ? getTransitionContext(project, clip.id) : { available: false, maxFrames: 0 }} onTransition={t => clip && setProject(setTransition(project, clip.id, t))}
            captionFont={project.style?.captionFont ?? DEFAULT_FONT} onCaptionFont={f => { const cur = getProject(); setProject({ ...cur, style: { ...cur.style, captionFont: f } }); }}
            captionCount={clip ? project.clips.filter(x => x.sourceClipId === clip.id).length : 0} hasCaptions={project.clips.some(x => x.kind === 'caption')} onGenerateCaptions={() => setCapModal('generate')} onOpenStudio={() => setCapModal('studio')} canGenerate={canGenerate} />
        </div>
      </div>
      <TimelineEditor project={project} setProject={setProject} checkpoint={checkpoint} undo={undo} redo={redo}
        frame={Math.min(frame, Math.max(0, projectDuration(project)))} playing={playing} onSeek={seek} onToggle={toggle}
        selectedId={selectedClip} onSelect={setSelectedClip} captionDefault={spec.take} onExport={() => setExporting(true)} />
      {capModal === 'generate' && <GenerateCaptionsModal project={project} aspect={spec.aspect} videoClips={project.clips.filter(c => c.kind === 'video' && c.src?.startsWith('http'))} initialClipId={clip?.kind === 'video' ? clip.id : undefined}
        initialStyle={project.style?.captions ?? DEFAULT_CAPTION_STYLE} canUseCloud={canGenerate} onClose={() => setCapModal(null)} onDone={applyGenerated} />}
      {capModal === 'studio' && <CaptionStudioModal project={project} aspect={spec.aspect} projectKey={openId ?? 'local'} onApply={applyStudio} onClose={() => setCapModal(null)} onBurn={(caps, st) => { applyStudio(caps, st); setCapModal(null); setExporting(true); }} />}
      {exporting && <ExportDialog project={project} aspect={spec.aspect} onClose={() => setExporting(false)} onDone={() => updateOnboarding({ exported: true })} />}
    </div>
  );
}
