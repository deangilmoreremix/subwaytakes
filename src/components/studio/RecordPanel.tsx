import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Mic, RotateCcw, Square, Upload, X } from 'lucide-react';
import {
  DEFAULT_WPM, MAX_RECORD_SEC, WPM_RANGE, activeWord, clock, micErrorText, pickRecorderMime, recordingProblem, recordingSupported, recordingToWav, teleprompterPlan,
} from '../../lib/audio/record';
import { uploadMedia } from '../../lib/storage';

type Phase = 'idle' | 'countdown' | 'recording' | 'review' | 'saving';

/**
 * Record your own voice reading the line, with a scrolling teleprompter. Free: the recording replaces the paid text-to-speech step.
 * The audio stays in this browser until "Use this recording", which uploads a mono WAV to your own media folder.
 */
export function RecordPanel({ script, onUse, onClose }: { script: string; onUse: (r: { url: string; seconds: number }) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const [take, setTake] = useState<{ url: string; blob: Blob; seconds: number } | null>(null);

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const raf = useRef(0);
  const startedAt = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const alive = useRef(true);

  const plan = useMemo(() => teleprompterPlan(script, wpm), [script, wpm]);
  const supported = recordingSupported();

  const stopMic = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (audioCtx.current) { void audioCtx.current.close(); audioCtx.current = null; }
    setLevel(0);
  }, []);

  useEffect(() => { alive.current = true; return () => { alive.current = false; if (recorder.current?.state === 'recording') recorder.current.stop(); stopMic(); }; }, [stopMic]);
  useEffect(() => () => { if (take) URL.revokeObjectURL(take.url); }, [take]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'saving') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  async function begin() {
    setError(''); setTake(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!alive.current) { s.getTracks().forEach(t => t.stop()); return; }
      stream.current = s;
      // level meter
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC(); audioCtx.current = ctx;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
        setLevel(peak);
        if (startedAt.current) setElapsed(Date.now() - startedAt.current);
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);

      // 3, 2, 1
      setPhase('countdown');
      for (let n = 3; n >= 1; n--) { setCount(n); await new Promise(r => setTimeout(r, 800)); if (!alive.current) return; }

      const mime = pickRecorderMime(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      recorder.current = rec; chunks.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => { void finish(rec.mimeType || mime || 'audio/webm'); };
      startedAt.current = Date.now(); setElapsed(0);
      rec.start(250);
      setPhase('recording');
    } catch (e) { stopMic(); setPhase('idle'); setError(micErrorText(e)); }
  }

  async function finish(mime: string) {
    stopMic(); startedAt.current = 0;
    const blob = new Blob(chunks.current, { type: mime });
    try {
      const { wav, seconds, peak } = await recordingToWav(blob);
      const problem = recordingProblem(seconds, peak);
      if (problem) { setPhase('idle'); setError(problem); return; }
      if (!alive.current) return;
      setTake({ url: URL.createObjectURL(wav), blob: wav, seconds }); setPhase('review');
    } catch { setPhase('idle'); setError('Could not read that recording. Try again.'); }
  }

  function stop() { if (recorder.current?.state === 'recording') recorder.current.stop(); }

  // a recording is capped, so a forgotten Stop cannot run for ever
  useEffect(() => { if (phase === 'recording' && elapsed >= MAX_RECORD_SEC * 1000) stop(); }, [phase, elapsed]);

  async function use() {
    if (!take) return;
    setPhase('saving'); setError('');
    try {
      const url = await uploadMedia(take.blob, 'my-take.wav');
      onUse({ url, seconds: take.seconds });
    } catch (e) { setPhase('review'); setError(e instanceof Error ? e.message : 'Upload failed. Try again.'); }
  }

  const word = phase === 'recording' ? activeWord(plan, elapsed) : -1;
  const readSec = Math.round(plan.totalMs / 1000);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rec-title" data-testid="record-modal"
      onMouseDown={e => { if (e.target === e.currentTarget && phase !== 'saving' && phase !== 'recording') onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-ink-850 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="rec-title" className="flex items-center gap-2 font-display text-[15px] font-semibold text-white"><Mic className="h-4 w-4 text-accent" />Record your own voice</h2>
          <button onClick={onClose} disabled={phase === 'saving' || phase === 'recording'} aria-label="Close" className="text-zinc-500 hover:text-white disabled:opacity-30"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {!supported && <p className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-[12px] text-amber-200" data-testid="record-unsupported"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />This browser cannot record from a microphone. Try a recent Chrome, Edge, Firefox or Safari over https.</p>}

          <div className="relative rounded-xl border border-line bg-ink-950 p-4" data-testid="teleprompter" aria-live="off">
            {phase === 'countdown' && <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/70 text-6xl font-bold text-accent" data-testid="record-countdown">{count}</div>}
            <p className="text-[22px] font-semibold leading-snug text-zinc-500">
              {plan.words.map((w, i) => <span key={i} className={i === word ? 'rounded bg-accent px-1 text-black' : i < word ? 'text-zinc-300' : ''}>{w}{' '}</span>)}
              {!plan.words.length && 'There is no line to read yet. Write your take first.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-[12px] text-zinc-400">
            <label htmlFor="wpm" className="shrink-0">Speed</label>
            <input id="wpm" type="range" min={WPM_RANGE.min} max={WPM_RANGE.max} step={5} value={wpm} disabled={phase === 'recording' || phase === 'countdown'} onChange={e => setWpm(Number(e.target.value))} className="min-w-0 flex-1 accent-amber-400" />
            <span className="tnum w-24 shrink-0 text-right">{wpm} words/min</span>
          </div>
          <p className="-mt-2 text-[11px] text-zinc-600">About {readSec} seconds at this speed. Read at your own pace: the highlight is only a guide.</p>

          {(phase === 'recording' || phase === 'countdown') && (
            <div className="space-y-1.5" data-testid="record-meter">
              <div className="h-2 overflow-hidden rounded-full bg-ink-950"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${Math.min(100, level * 160)}%` }} /></div>
              <div className="flex justify-between text-[11px] tnum text-zinc-500"><span>{phase === 'recording' ? <span className="text-red-300">● Recording {clock(elapsed / 1000)}</span> : 'Get ready…'}</span><span>max {clock(MAX_RECORD_SEC)}</span></div>
            </div>
          )}

          {phase === 'review' && take && (
            <div className="space-y-2 rounded-xl border border-line bg-ink-950 p-3" data-testid="record-review">
              <div className="flex items-center justify-between text-[12px]"><span className="text-zinc-300">Your recording</span><span className="tnum text-zinc-500">{clock(take.seconds)}</span></div>
              <audio controls src={take.url} className="h-9 w-full" />
              <p className="text-[11px] text-zinc-500">Listen first. A recording shorter than 4 seconds is padded with silence automatically.</p>
            </div>
          )}

          {error && <p className="flex items-start gap-1.5 text-[12px] text-red-300" role="alert" data-testid="record-error"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>}

          <p className="text-[11px] leading-relaxed text-zinc-600">Your voice stays in this browser until you press “Use this recording”, which saves a copy to your own media folder so the video model can read it. It replaces the paid AI voice for this line.</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          {phase === 'idle' && <button onClick={() => void begin()} disabled={!supported || !plan.words.length} data-testid="record-start" className="flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-black disabled:opacity-40"><Mic className="h-4 w-4" />Start recording</button>}
          {phase === 'countdown' && <button disabled className="h-9 rounded-xl border border-line px-4 text-[13px] text-zinc-500">Starting…</button>}
          {phase === 'recording' && <button onClick={stop} data-testid="record-stop" className="flex h-9 items-center gap-2 rounded-xl bg-red-500 px-4 text-[13px] font-semibold text-white"><Square className="h-4 w-4" />Stop</button>}
          {(phase === 'review' || phase === 'saving') && <>
            <button onClick={() => { setTake(null); setPhase('idle'); }} disabled={phase === 'saving'} className="flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] text-zinc-300 hover:border-zinc-500 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Record again</button>
            <button onClick={() => void use()} disabled={phase === 'saving'} data-testid="record-use" className="flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-black disabled:opacity-60">{phase === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{phase === 'saving' ? 'Saving…' : 'Use this recording'}</button>
          </>}
          {phase === 'idle' && <button onClick={onClose} className="h-9 rounded-xl border border-line px-4 text-[13px] text-zinc-300 hover:border-zinc-500">Cancel</button>}
        </div>
      </div>
    </div>
  );
}
