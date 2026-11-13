import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, CircleDashed, Film, Loader2, Play, Plus, RotateCcw, Sparkles, UserRound, Video, X } from 'lucide-react';
import { BlobSource } from 'mediabunny';
import { Label, Segmented, inputCls } from '../components/studio/ui';
import { clsx } from '../lib/format';
import { getMuapiKey, muapi } from '../lib/muapi/client';
import { uploadMedia } from '../lib/storage';
import { listCharacters } from '../lib/characters';
import { getMediaInfo, readMediaInfo } from '../lib/timeline/media';
import { addRecastClips } from '../lib/timeline/ops';
import { loadProject, saveProject } from '../lib/timeline/useProject';
import { RECAST_MODELS, REF_LIMITS, estimateRecast, imageBudget, outputSeconds, validateRefs, validateSource, type RecastMode, type RecastModel } from '../lib/recast/limits';
import { RECAST_STAGES, listResumableRecasts, realRecastDeps, runRecastJob, type RecastState, type StageEvent, type StageStatus, type RecastResult } from '../lib/recast/pipeline';
import { buildContactSheet, extractFrames } from '../lib/recast/frames';
import type { CharacterBible } from '../lib/types';
import type { ClipJob } from '../lib/muapi/jobs';

interface Source { url: string; seconds: number; bytes: number; hasAudio: boolean; name: string }
interface Ref { id: string; url: string; label: string; origin: 'cast' | 'upload' }

const money = (n: number) => `$${n.toFixed(2)}`;

export function RecastPage() {
  const nav = useNavigate();
  const hasKey = !!getMuapiKey();
  const [source, setSource] = useState<Source | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceErr, setSourceErr] = useState('');
  const [characters, setCharacters] = useState<CharacterBible[]>([]);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [refErr, setRefErr] = useState('');
  const [refBusy, setRefBusy] = useState(false);
  const [mode, setMode] = useState<RecastMode>('motion_transfer');
  const [model, setModel] = useState<RecastModel>('wan');
  const [outfit, setOutfit] = useState('');
  const [brief, setBrief] = useState('');
  const [liveRender, setLiveRender] = useState<number | null>(null);

  const [stages, setStages] = useState<Record<string, { status: StageStatus; detail?: string }>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<RecastResult | null>(null);
  const [resumable, setResumable] = useState<Array<{ job: ClipJob; state: RecastState }>>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => { listCharacters().then(c => setCharacters(c.filter(x => x.portrait_url))).catch(() => undefined); }, []);
  useEffect(() => { listResumableRecasts().then(setResumable).catch(() => undefined); }, []);
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [running]);

  // ---------------------------------------------------------------- source
  async function pickSource(file: File) {
    setSourceErr(''); setSource(null); setResult(null); setSourceBusy(true);
    try {
      const info = await readMediaInfo(new BlobSource(file)).catch(() => null);
      const problem = validateSource(info?.durationSec ?? NaN, file.size, file.type || 'application/octet-stream');
      if (problem) throw new Error(problem);
      const url = await uploadMedia(file, file.name);
      setSource({ url, seconds: info!.durationSec, bytes: file.size, hasAudio: info!.hasAudio, name: file.name });
    } catch (e) { setSourceErr(e instanceof Error ? e.message : 'Could not use that video'); } finally { setSourceBusy(false); }
  }
  async function chooseHostedShot(url: string, name: string) {
    setSourceErr(''); setSourceBusy(true); setResult(null);
    try {
      const info = await getMediaInfo(url);
      const problem = validateSource(info.durationSec, 0, 'video/mp4');
      if (problem) throw new Error(problem);
      setSource({ url, seconds: info.durationSec, bytes: 0, hasAudio: info.hasAudio, name });
    } catch (e) { setSourceErr(e instanceof Error ? e.message : 'Could not use that shot'); } finally { setSourceBusy(false); }
  }
  const timelineShots = useMemo(() => {
    const seen = new Set<string>(); const out: Array<{ url: string; label: string }> = [];
    for (const c of loadProject().clips) if (c.kind === 'video' && c.src?.startsWith('https://') && !seen.has(c.src)) { seen.add(c.src); out.push({ url: c.src, label: c.label }); }
    return out;
  }, []);

  // ---------------------------------------------------------------- references
  const toggleCast = (c: CharacterBible) => setRefs(r => r.some(x => x.id === c.id) ? r.filter(x => x.id !== c.id) : [...r, { id: c.id, url: c.portrait_url!, label: c.name, origin: 'cast' }]);
  async function addUploads(files: FileList | null) {
    if (!files?.length) return;
    setRefErr(''); setRefBusy(true);
    try {
      const list = Array.from(files);
      const problem = validateRefs(refs.length + list.length, list);
      if (problem && !/at least/.test(problem)) throw new Error(problem);
      const added: Ref[] = [];
      for (const f of list) added.push({ id: `up-${Date.now()}-${added.length}`, url: await uploadMedia(f, f.name), label: f.name, origin: 'upload' });
      setRefs(r => [...r, ...added]);
    } catch (e) { setRefErr(e instanceof Error ? e.message : 'Upload failed'); } finally { setRefBusy(false); }
  }

  // ---------------------------------------------------------------- cost
  const out = source ? outputSeconds(model, source.seconds) : null;
  const outSeconds = out?.seconds, outError = out?.error;
  const plates = imageBudget(model, Math.max(1, refs.length), 4).plates;
  const plan = useMemo(() => estimateRecast(model, Math.max(1, refs.length), plates, liveRender != null ? { render: liveRender } : {}, outSeconds ?? 5), [model, refs.length, plates, liveRender, outSeconds]);
  useEffect(() => {
    setLiveRender(null);
    if (!hasKey || !source || outSeconds === undefined || outError) return;
    let on = true;
    const t = setTimeout(() => {
      const base = { prompt: 'x', images_list: ['https://example.com/x.png'], videos_list: ['https://example.com/x.mp4'], aspect_ratio: 'adaptive', duration: outSeconds, resolution: '720p' };
      muapi.estimate(RECAST_MODELS[model].slug, model === 'wan' ? { ...base, thinking_mode: false, enable_audio: false } : base)
        .then(r => { if (on && typeof r.cost === 'number') setLiveRender(r.cost); }).catch(() => undefined);
    }, 400);
    return () => { on = false; clearTimeout(t); };
  }, [hasKey, source, model, outSeconds, outError]);

  const refProblem = refs.length ? validateRefs(refs.length) : null;
  const blocking = !hasKey ? 'Add your muapi key in Settings first.' : !source ? 'Choose a source clip.' : out?.error ? out.error : refs.length === 0 ? 'Choose at least one performer.' : refProblem;

  // ---------------------------------------------------------------- run
  const onStage = useCallback((e: StageEvent) => setStages(s => ({ ...s, [e.stage]: { status: e.status, detail: e.detail } })), []);
  async function run(resume?: { job: ClipJob; state: RecastState }) {
    const st = resume?.state;
    const src = st ? { url: st.sourceUrl, seconds: st.sourceSeconds } : source && { url: source.url, seconds: source.seconds };
    if (!src) return;
    if (!st && blocking) { setRunError(blocking); return; }
    const total = plan.total;
    if (!st && total > 1 && !window.confirm(`This recast will cost about ${money(total)}. Continue?`)) return;
    setRunError(''); setWarnings([]); setStages({}); setResult(null); setRunning(true); setStartedAt(Date.now());
    abort.current = new AbortController();
    try {
      const r = await runRecastJob({
        sourceUrl: src.url, sourceSeconds: src.seconds, refs: st ? st.refs : refs.map(x => x.url),
        mode: st?.mode ?? mode, model: st?.model ?? model, outfit: st?.outfit ?? outfit, brief: st?.brief ?? brief,
        resume, onStage, onWarning: w => setWarnings(x => [...x, w]), signal: abort.current.signal,
      }, realRecastDeps({ extractFrames: (u, s) => extractFrames(u, s), buildContactSheet }));
      setResult(r); setResumable(await listResumableRecasts().catch(() => []));
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Recast failed';
      setRunError(m === 'Cancelled' ? 'Paused. You can resume this recast below; finished steps will not be paid for again.' : m);
      listResumableRecasts().then(setResumable).catch(() => undefined);
    } finally { setRunning(false); }
  }

  async function addToTimeline() {
    if (!result) return;
    const fps = loadProject().fps;
    const [gen, srcInfo] = await Promise.all([getMediaInfo(result.url).catch(() => null), getMediaInfo(result.state.sourceUrl).catch(() => null)]);
    const { project } = addRecastClips(loadProject(), {
      generatedUrl: result.url, sourceUrl: result.state.sourceUrl, label: 'Recast',
      generatedFrames: Math.max(6, Math.round((gen?.durationSec ?? result.seconds) * fps)),
      sourceFrames: Math.max(6, Math.round((srcInfo?.durationSec ?? result.state.sourceSeconds) * fps)),
      hasSourceAudio: srcInfo?.hasAudio ?? true,
    });
    saveProject(project);
    nav('/create');
  }

  const elapsed = running ? Math.floor((now - startedAt) / 1000) : 0;
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const started = Object.keys(stages).length > 0;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white">Recast</h1>
        <p className="text-[13px] text-zinc-500">Replace the performer in a clip with someone new. The motion, camera and original soundtrack stay.</p>
      </div>
      {!hasKey && <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft p-3 text-[13px] text-accent"><AlertCircle className="h-4 w-4" />Add your muapi key in <Link to="/settings" className="underline">Settings</Link> to run a recast.</div>}

      {resumable.length > 0 && !running && (
        <div className="mb-4 space-y-2">
          {resumable.map(r => (
            <div key={r.job.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-[13px]">
              <RotateCcw className="h-4 w-4 text-amber-300" />
              <span className="min-w-0 flex-1 text-zinc-300">An unfinished recast ({RECAST_MODELS[r.state.model].label}) is waiting. Finished steps are kept, so resuming costs only what is left.</span>
              <button onClick={() => run(r)} className="h-8 rounded-lg bg-amber-400/20 px-3 text-[12px] font-semibold text-amber-200 hover:bg-amber-400/30">Resume</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {/* 1 source */}
          <section className="rounded-2xl border border-line bg-ink-850 p-5 shadow-panel">
            <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-white"><span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-[11px] text-accent">1</span>Source clip</h2>
            {source ? (
              <div className="flex gap-4">
                <video src={source.url} controls playsInline muted className="h-44 rounded-xl bg-black object-cover" />
                <div className="min-w-0 space-y-1 text-[12px]">
                  <p className="truncate font-medium text-zinc-100">{source.name}</p>
                  <p className="tnum text-zinc-500">{source.seconds.toFixed(1)}s{source.bytes ? ` · ${(source.bytes / 1048576).toFixed(1)} MB` : ''} · {source.hasAudio ? 'has audio' : 'no audio'}</p>
                  <button onClick={() => setSource(null)} className="mt-2 flex items-center gap-1 text-zinc-500 hover:text-zinc-200"><X className="h-3 w-3" />Change</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className={clsx('grid cursor-pointer place-items-center rounded-xl border border-dashed border-white/15 bg-ink-950 py-8 text-center transition hover:border-accent/50', sourceBusy && 'opacity-60')}>
                  {sourceBusy ? <Loader2 className="h-6 w-6 animate-spin text-accent" /> : <Video className="h-6 w-6 text-zinc-500" />}
                  <span className="mt-2 text-[13px] font-medium text-zinc-200">{sourceBusy ? 'Checking and uploading…' : 'Choose a video'}</span>
                  <span className="text-[11px] text-zinc-600">MP4 or MOV, 4–15 seconds, up to 50 MB</span>
                  <input type="file" accept="video/mp4,video/quicktime" className="sr-only" aria-label="Upload source video" disabled={sourceBusy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickSource(f); }} />
                </label>
                {timelineShots.length > 0 && (
                  <div><Label>Or use a shot from your episode</Label>
                    <div className="flex flex-wrap gap-2">{timelineShots.map(s => <button key={s.url} onClick={() => chooseHostedShot(s.url, s.label)} className="flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg bg-white/5 px-2.5 text-[12px] text-zinc-200 hover:bg-white/10"><Film className="h-3.5 w-3.5 shrink-0 text-zinc-500" /><span className="truncate">{s.label}</span></button>)}</div></div>
                )}
              </div>
            )}
            {sourceErr && <p className="mt-3 flex gap-1.5 text-[12px] text-red-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{sourceErr}</p>}
          </section>

          {/* 2 performer */}
          <section className="rounded-2xl border border-line bg-ink-850 p-5 shadow-panel">
            <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-white"><span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-[11px] text-accent">2</span>New performer</h2>
            <Label hint={`${refs.length}/${REF_LIMITS.max}`}>References</Label>
            <div className="flex flex-wrap gap-2">
              {characters.map(c => {
                const on = refs.some(r => r.id === c.id);
                return (
                  <button key={c.id} onClick={() => toggleCast(c)} aria-pressed={on} className={clsx('flex items-center gap-2 rounded-xl border p-1.5 pr-3 text-left transition', on ? 'border-accent/60 bg-accent-soft' : 'border-line bg-ink-950 hover:border-white/15')}>
                    <img src={c.portrait_url!} alt="" className="h-12 w-9 rounded-lg object-cover" />
                    <span className="text-[12px] font-medium text-zinc-100">{c.name}{on && <Check className="ml-1 inline h-3 w-3 text-accent" />}</span>
                  </button>
                );
              })}
              {refs.filter(r => r.origin === 'upload').map(r => (
                <div key={r.id} className="relative"><img src={r.url} alt="" className="h-[60px] w-[45px] rounded-xl border border-accent/60 object-cover" />
                  <button aria-label="Remove reference" onClick={() => setRefs(x => x.filter(y => y.id !== r.id))} className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-zinc-900 text-zinc-300 ring-1 ring-white/20"><X className="h-2.5 w-2.5" /></button></div>
              ))}
              <label className="grid h-[60px] w-[60px] cursor-pointer place-items-center rounded-xl border border-dashed border-white/15 text-zinc-500 hover:border-accent/50 hover:text-accent">
                {refBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload reference photos" onChange={e => { const f = e.target.files; addUploads(f); e.target.value = ''; }} />
              </label>
            </div>
            {characters.length === 0 && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-600"><UserRound className="h-3.5 w-3.5" />Characters with portraits from <Link to="/cast" className="text-accent underline">Cast</Link> show up here. You can also upload photos.</p>}
            {refErr && <p className="mt-2 flex gap-1.5 text-[12px] text-red-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{refErr}</p>}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><Label>What to change</Label>
                <Segmented value={mode} onChange={setMode} options={[{ value: 'motion_transfer', label: 'Swap performer', hint: 'The new person repeats the original motion' }, { value: 'object_swap', label: 'Swap item', hint: 'Keep the scene, replace a character, product or clothing' }]} /></div>
              <div><Label>Outfit (optional)</Label><input className={inputCls} value={outfit} onChange={e => setOutfit(e.target.value)} placeholder="e.g. a bright red wool coat" /></div>
            </div>
            <div className="mt-4"><Label>Creative brief (optional)</Label><textarea className={inputCls} rows={2} value={brief} onChange={e => setBrief(e.target.value)} placeholder="Anything about the mood, lighting or details to keep" /></div>
          </section>

          {/* progress */}
          {(started || runError || warnings.length > 0) && (
            <section className="rounded-2xl border border-line bg-ink-850 p-5 shadow-panel" aria-label="Recast progress">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[15px] font-semibold text-white">Progress</h2>{running && <span className="tnum text-[12px] text-zinc-500">{mmss}</span>}</div>
              <ol className="space-y-2">
                {RECAST_STAGES.map(s => {
                  const st = stages[s.id];
                  return (
                    <li key={s.id} className="flex items-start gap-2.5 text-[13px]" data-stage={s.id} data-status={st?.status ?? 'waiting'}>
                      <span className="mt-0.5 grid h-4 w-4 place-items-center">
                        {st?.status === 'done' || st?.status === 'skipped' ? <Check className="h-4 w-4 text-emerald-400" /> : st?.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : st?.status === 'failed' ? <AlertCircle className="h-4 w-4 text-red-400" /> : <CircleDashed className="h-4 w-4 text-zinc-700" />}
                      </span>
                      <span className={clsx(st?.status === 'running' ? 'text-white' : st?.status === 'done' || st?.status === 'skipped' ? 'text-zinc-500' : st?.status === 'failed' ? 'text-red-300' : 'text-zinc-600')}>{s.label}{st?.status === 'skipped' && ' (already done)'}{st?.detail && <span className="ml-1 text-[11px] text-zinc-600">{st.detail}</span>}</span>
                    </li>
                  );
                })}
              </ol>
              {running && <p className="mt-3 text-[11px] text-zinc-600">The render step usually takes a few minutes. Keep this tab open. If you close it, you can resume later without paying for finished steps.</p>}
              {warnings.length > 0 && <ul className="mt-3 space-y-1">{warnings.map((w, i) => <li key={i} className="flex gap-1.5 text-[11px] text-amber-300/90"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{w}</li>)}</ul>}
              {runError && <p className="mt-3 flex gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{runError}</p>}
            </section>
          )}

          {result && (
            <section className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5" aria-label="Recast result">
              <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-white"><Check className="h-4 w-4 text-emerald-400" />Done</h2>
              <div className="flex flex-wrap gap-4">
                <video src={result.url} controls playsInline loop className="h-72 rounded-xl bg-black object-cover" />
                <div className="space-y-3 text-[12px] text-zinc-400"><p>The new clip is silent. Adding it to the timeline also adds the original soundtrack so the voice stays in sync.</p>
                  <button onClick={addToTimeline} className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black shadow-glow"><Play className="h-4 w-4" />Add to timeline</button></div>
              </div>
            </section>
          )}
        </div>

        {/* summary + run */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-2xl border border-line bg-ink-850 p-5 shadow-panel">
            <Label>Quality</Label>
            <div className="grid gap-2">
              {(Object.values(RECAST_MODELS)).map(m => (
                <button key={m.id} onClick={() => setModel(m.id)} aria-pressed={m.id === model} className={clsx('flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition', m.id === model ? 'border-accent/60 bg-accent-soft' : 'border-line bg-ink-950 hover:border-white/15')}>
                  <span><span className="block text-[13px] font-medium text-zinc-100">{m.label}</span><span className="text-[10px] text-zinc-500">{m.id === 'wan' ? 'Up to 10 images · lower cost' : 'Up to 30 images · higher fidelity'}</span></span>
                  <span className={clsx('rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase', m.tag === 'Best' ? 'bg-fuchsia-500/10 text-fuchsia-300' : 'bg-emerald-500/10 text-emerald-300')}>{m.tag}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-1.5 text-[12px]" aria-label="Cost breakdown">
              <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Estimated cost</span>{out && !out.error && <span className="tnum text-[11px] text-zinc-600">{out.seconds}s render</span>}</div>
              {plan.lines.map(([k, v]) => <div key={k} className="flex justify-between text-zinc-500"><span>{k}</span><span className="tnum">{money(v)}</span></div>)}
              <div className="flex justify-between border-t border-line pt-2 text-[13px] font-semibold text-white"><span>Total</span><span className="tnum" data-testid="recast-total">{money(plan.total)}</span></div>
              <p className="text-[10px] text-zinc-600">{liveRender != null ? 'Render price is live from muapi; the other steps are typical prices.' : 'Typical prices until your key loads a live render price.'} The render is billed per second of output.</p>
            </div>

            {blocking && !running && <p className="mt-3 flex gap-1.5 text-[11px] text-amber-300/90"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{blocking}</p>}
            {running ? (
              <button onClick={() => abort.current?.abort()} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/5 text-[13px] font-medium text-zinc-200 hover:bg-white/10">Pause</button>
            ) : (
              <button onClick={() => run()} disabled={!!blocking} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot text-[13px] font-semibold text-black shadow-glow transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"><Sparkles className="h-4 w-4" />Recast · {money(plan.total)}</button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
