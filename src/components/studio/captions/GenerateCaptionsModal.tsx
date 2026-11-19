import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';
import { X, Check, Loader2, AlertCircle, Captions, Cpu, Cloud } from 'lucide-react';
import { PhonePreview } from './PhonePreview';
import { PresetGrid } from './PresetGrid';
import { Label, inputCls } from '../ui';
import { ENGINES, MODEL_LABEL, transcribe, TranscribeError, type EngineId, type ModelSize, type Progress, type TranscribeResult } from '../../../lib/captions/engines';
import { getCachedTranscript, putCachedTranscript, transcriptKey } from '../../../lib/captions/cache';
import { LANGUAGES } from '../../../lib/captions/scripts';
import { clampPosition, type CaptionStyle } from '../../../lib/captions/model';
import { styleFromPreset } from '../../../lib/captions/presets';
import { wordsToClips } from '../../../lib/captions/words';
import { newId } from '../../../lib/timeline/ops';
import type { Clip, Project } from '../../../lib/timeline/types';
import type { Aspect } from '../../../lib/muapi/registry';
import { clsx } from '../../../lib/format';

const STEPS = ['Load model', 'Transcribe', 'Build captions', 'Done'] as const;
const stepOf = (s: Progress['stage'] | 'done'): number => (s === 'checking' || s === 'loading_model' ? 0 : s === 'decoding_audio' || s === 'transcribing' ? 1 : s === 'building' ? 2 : 3);

/** A short sample caption so the style can be judged (and dragged into place) before anything is transcribed. */
function sampleProject(fps: number, style: CaptionStyle, base: Project): Project {
  const w = ['Pineapple', 'belongs', 'on', 'pizza'].map((t, i) => ({ t, s: 6 + i * 16, e: 20 + i * 16 }));
  const cap: Clip = { id: 'sample', trackId: 'c1', kind: 'caption', label: 'Caption', text: w.map(x => x.t).join(' '), words: w, start: 0, duration: 84, trimStart: 0 };
  const video = base.clips.find(c => c.kind === 'video' && c.src);
  return { ...base, fps, clips: [...(video ? [{ ...video, start: 0, duration: 84 }] : []), cap], style: { ...base.style, captions: style } };
}

export function GenerateCaptionsModal({ project, aspect, videoClips, initialClipId, initialStyle, canUseCloud, onClose, onDone }: {
  project: Project; aspect: Aspect; videoClips: Clip[]; initialClipId?: string; initialStyle: CaptionStyle; canUseCloud: boolean; onClose: () => void;
  onDone: (a: { clip: Clip; captions: Clip[]; style: CaptionStyle; result: TranscribeResult }) => void;
}) {
  const [clipId, setClipId] = useState(initialClipId ?? videoClips[0]?.id ?? '');
  const [engine, setEngine] = useState<EngineId>('transformers');
  const [model, setModel] = useState<ModelSize>('base');
  const [language, setLanguage] = useState('auto');
  const [style, setStyle] = useState<CaptionStyle>(initialStyle);
  const [step, setStep] = useState<number | null>(null);
  const [percent, setPercent] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const mounted = useRef(true);
  const runRef = useRef<{ walked: boolean } | null>(null);
  const engineRef = useRef<EngineId>(engine); engineRef.current = engine;
  // leaving the page stops an on-device transcription; a paid cloud job cannot be called back, so it is left to finish and its transcript is still saved for the clip (never lose what was paid for)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (engineRef.current !== 'cloud') abort.current?.abort(); }; }, []);   // set true again on every mount (React runs effects twice in development)
  const busy = step !== null && step < 3 && !error;
  const clip = videoClips.find(c => c.id === clipId);
  const preview = useMemo(() => sampleProject(project.fps, style, project), [project, style]);

  async function start() {
    if (!clip?.src) return;
    setError(''); setNote(''); setStep(0); setPercent(undefined);
    const ctl = new AbortController(); abort.current = ctl; const run = { walked: false }; runRef.current = run;
    const sourceSec = (clip.sourceFrames ?? clip.trimStart + clip.duration) / project.fps;
    try {
      const key = transcriptKey(clip.src, engine, model, language);
      let result: TranscribeResult | null = null;
      const cached = getCachedTranscript(key);
      if (cached) { result = { words: cached.words, engine: cached.engine as EngineId, wordTimed: cached.wordTimed }; setNote('Used the saved transcript for this clip (nothing was re-transcribed).'); }
      else {
        result = await transcribe({ src: clip.src, durationSec: sourceSec, language, model, signal: ctl.signal, onProgress: p => { setStep(stepOf(p.stage)); setPercent(p.percent); } },
          { engine, onFallback: (from, to, why) => setNote(`${ENGINES[from].label} could not run (${why}). Trying ${ENGINES[to].label}.`) });
        putCachedTranscript({ key, words: result.words, wordTimed: result.wordTimed, engine: result.engine });
      }
      if (!mounted.current || run.walked) return;   // the transcript is saved above; nothing else happens after the customer walked away
      setStep(2); setPercent(undefined);
      const track = project.tracks.find(t => t.kind === 'caption')!;
      const final = { ...style, language };
      const captions = wordsToClips(result.words, clip, track.id, project.fps, () => newId('cap'), { maxWords: style.maxWords });
      if (!captions.length) throw new TranscribeError('No speech found inside the visible part of this clip.', result.engine, 'no_speech');
      if (ctl.signal.aborted || abort.current !== ctl) return;
      setStep(3);
      onDone({ clip, captions, style: final, result });
    } catch (e) {
      if (abort.current !== ctl || run.walked || !mounted.current) return;   // a newer run owns the screen now, or the customer walked away
      if (e instanceof TranscribeError && e.kind === 'aborted') { setStep(null); return; }
      setError(e instanceof Error ? e.message : 'Captions failed.');
    } finally { if (abort.current === ctl) abort.current = null; }
  }
  const cancel = () => {
    if (engine === 'cloud' && runRef.current) { runRef.current.walked = true; setStep(null); setNote('The cloud transcription is still running. When it finishes the transcript is saved for this clip, so running Generate again will not charge you twice.'); return; }
    abort.current?.abort(); setStep(null); setError('');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Generate captions">
      <div className="flex h-[min(92vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-ink-850 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-white"><Captions className="h-4 w-4 text-accent" />Generate captions</div>
          <button onClick={() => { if (!busy) onClose(); }} disabled={busy} aria-label="Close" className="text-zinc-500 hover:text-white disabled:opacity-30"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[380px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col items-center gap-2">
            <div className="min-h-0 w-full flex-1 [&>div]:mx-auto"><PhonePreview project={preview} aspect={aspect} bg="video" autoPlay playerRef={playerRef} onPosition={p => setStyle(s => ({ ...s, positionY: clampPosition(p) }))} heightClass="h-full" /></div>
            <p className="text-[10px] text-zinc-600">Sample words. Drag the dashed line to place the captions.</p>
          </div>

          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><Label>Clip</Label>
                <select className={inputCls} value={clipId} onChange={e => setClipId(e.target.value)} disabled={busy} aria-label="Clip">{videoClips.map((c, i) => <option key={c.id} value={c.id}>{c.label || `Shot ${i + 1}`}</option>)}</select></div>
              <div><Label>Model size</Label>
                <select className={inputCls} value={model} onChange={e => setModel(e.target.value as ModelSize)} disabled={busy || engine === 'cloud'} aria-label="Model size">{(Object.keys(MODEL_LABEL) as ModelSize[]).map(m => <option key={m} value={m}>{MODEL_LABEL[m].label} (~{MODEL_LABEL[m].approxMb} MB): {MODEL_LABEL[m].blurb}</option>)}</select></div>
              <div><Label>Language</Label>
                <select className={inputCls} value={language} onChange={e => setLanguage(e.target.value)} disabled={busy} aria-label="Spoken language">{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
            </div>

            <div><Label>Where to transcribe</Label>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Engine">
                {(['transformers', 'whisper_cpp', 'cloud'] as EngineId[]).map(id => {
                  const e = ENGINES[id]; const off = id === 'cloud' && !canUseCloud;
                  return (
                    <button key={id} role="radio" aria-checked={engine === id} disabled={busy || off} onClick={() => setEngine(id)} data-engine={id}
                      className={clsx('rounded-xl border p-2.5 text-left transition-colors disabled:opacity-40', engine === id ? 'border-accent bg-accent-soft/30' : 'border-line bg-ink-950 hover:border-zinc-600')}>
                      <div className="flex items-center gap-1.5 text-[12px] font-medium text-white">{id === 'cloud' ? <Cloud className="h-3.5 w-3.5 text-accent" /> : <Cpu className="h-3.5 w-3.5 text-accent" />}{e.label}</div>
                      <p className="mt-1 text-[11px] leading-snug text-zinc-500">{off ? 'Create an account and confirm your email to use the cloud.' : e.blurb}</p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-600">On-device engines never upload your audio. The first run downloads the model, then it is saved in your browser. If the first one cannot run, the other on-device engine is tried (never the paid cloud one).</p>
            </div>

            <div><Label>Style</Label><PresetGrid style={style} onPick={id => setStyle(styleFromPreset(id, { positionY: style.positionY, language }))} compact /></div>
          </div>
        </div>

        <div className="space-y-3 border-t border-line px-4 py-3">
          {step !== null && (
            <ol className="grid grid-cols-4 gap-2" aria-label="Progress" data-testid="pipeline">
              {STEPS.map((s, i) => {
                const done = step > i || step === 3; const active = step === i && !error;
                return (
                  <li key={s} className={clsx('rounded-xl border px-2.5 py-2 text-[11px]', done ? 'border-emerald-500/30 text-emerald-300' : active ? 'border-accent/50 text-white' : 'border-line text-zinc-600')}>
                    <div className="flex items-center gap-1.5">{done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />}{s}</div>
                    {active && percent !== undefined && <div className="mt-1.5 h-1 overflow-hidden rounded bg-zinc-800"><div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} /></div>}
                  </li>
                );
              })}
            </ol>
          )}
          {note && <p className="text-[11px] text-zinc-400" role="status">{note}</p>}
          {error && <div className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-[12px] text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-600">{engine === 'cloud' ? 'Cloud captions use credits and have line-level timing (words are spread across each line).' : 'Free. Word-level timing.'}</p>
            <div className="flex gap-2">
              {busy ? <button onClick={cancel} className="h-9 rounded-xl border border-line px-4 text-[13px] text-zinc-300 hover:text-white">Cancel</button>
                : <button onClick={start} disabled={!clip?.src} data-testid="start-captions" className="h-9 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black disabled:opacity-40">{error ? 'Try again' : 'Generate captions'}</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
