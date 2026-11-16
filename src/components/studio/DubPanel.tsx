import { useRef, useState } from 'react';
import { Check, Languages, Loader2, Plus, X } from 'lucide-react';
import { Label } from './ui';
import { UnlockPrompt } from '../UnlockPrompt';
import { useBilling } from '../../lib/billing/useBilling';
import { useAuth } from '../../lib/auth';
import { CONFIRM_CREDITS, formatCredits } from '../../lib/credits';
import { DUB_LANGUAGES, MAX_DUB_LANGUAGES, languageOf } from '../../lib/dubbing/languages';
import { dubProblem, estimateDub, resumeFrom, runDub, type DubResult, type DubStage, type DubState, type DubVoice } from '../../lib/dubbing/pipeline';
import type { ClipJob } from '../../lib/muapi/jobs';
import { defaultDubDeps } from '../../lib/dubbing/browser';
import { VOICE_LIPSYNC_MODELS, type VoiceLipsyncModel } from '../../lib/recast/voice';
import { FALLBACK_ELEVEN, MINIMAX_VOICES } from '../../lib/muapi/voices';
import type { CharacterBible } from '../../lib/types';
import type { Clip } from '../../lib/timeline/types';

type Status = 'waiting' | 'running' | 'done' | 'failed';
const STAGE_LABEL: Record<DubStage, string> = { transcribe: 'Transcribing', translate: 'Translating', voice: 'New voice', lipsync: 'Lip-syncing' };

/** Dub a generated clip into other languages: each language becomes its own video you can add to the timeline. */
export function DubPanel({ clip, fps, characters, canGenerate, onAddDub }: {
  clip: Clip; fps: number; characters: CharacterBible[]; canGenerate: boolean;
  onAddDub: (url: string, label: string, seconds: number) => Promise<void>;
}) {
  const { has, loaded } = useBilling();
  const { profile } = useAuth();
  const [langs, setLangs] = useState<string[]>([]);
  const withVoice = characters.filter(c => c.voice_id && c.voice_provider);
  const [voiceKey, setVoiceKey] = useState(withVoice[0] ? `char:${withVoice[0].id}` : 'default:elevenlabs');
  const [model, setModel] = useState<VoiceLipsyncModel>('sync-lipsync');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, { stage: DubStage; status: Status; detail?: string }>>({});
  const [result, setResult] = useState<DubResult | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  /** a cancelled or interrupted run, kept so it can be resumed without paying again for what finished */
  const [paused, setPaused] = useState<{ job: ClipJob; state: DubState } | null>(null);

  const locked = loaded && !has('dubbing');
  const sourceSeconds = (clip.sourceFrames ?? clip.trimStart + clip.duration) / fps;
  const trimmed = clip.trimStart > 0 || (clip.sourceFrames !== undefined && clip.duration < clip.sourceFrames);
  const problem = clip.src ? dubProblem({ sourceUrl: clip.src, seconds: sourceSeconds, languages: langs.length ? langs : ['es'] }) : 'This clip has no hosted video to dub.';
  const est = estimateDub(Math.max(1, langs.length), model);
  const models = VOICE_LIPSYNC_MODELS.filter(m => m.slug === 'sync-lipsync' || has('recast'));

  function resolveVoice(): DubVoice | null {
    if (voiceKey.startsWith('char:')) { const c = withVoice.find(x => `char:${x.id}` === voiceKey); return c ? { provider: c.voice_provider as DubVoice['provider'], voiceId: c.voice_id!, speed: c.voice_speed || 1 } : null; }
    return voiceKey === 'default:minimax' ? { provider: 'minimax', voiceId: MINIMAX_VOICES[0].id } : { provider: 'elevenlabs', voiceId: FALLBACK_ELEVEN[0].id };
  }
  const toggle = (id: string) => setLangs(l => (l.includes(id) ? l.filter(x => x !== id) : l.length >= MAX_DUB_LANGUAGES ? l : [...l, id]));

  async function start(resume?: { job: ClipJob; state: DubState }) {
    const voice = resume ? resume.state.voice : resolveVoice();
    if (!clip.src || !voice || langs.length === 0 || problem) { setError(problem ?? 'Pick a voice and at least one language.'); return; }
    if (!resume && typeof profile?.credits_balance === 'number' && profile.credits_balance < est.total) { setError(`You need ${(est.total - profile.credits_balance).toLocaleString('en-US')} more credits (this costs about ${est.total.toLocaleString('en-US')}). Add credits in Settings.`); return; }
    if (!resume && est.total > CONFIRM_CREDITS && !window.confirm(`Dubbing into ${langs.length} language${langs.length === 1 ? '' : 's'} costs about ${formatCredits(est.total)}. Continue?`)) return;
    setError(''); setResult(null); setAdded([]); setPaused(null); setRunning(true);
    setProgress(Object.fromEntries(langs.map(l => [l, { stage: 'translate' as DubStage, status: 'waiting' as Status }])));
    abort.current = new AbortController();
    try {
      const r = await runDub({ sourceUrl: clip.src, seconds: sourceSeconds, voice, lipsync: model, languages: resume ? resume.state.languages : langs, resume, signal: abort.current.signal,
        onProgress: e => { if (e.language === 'all') return; setProgress(p => ({ ...p, [e.language]: { stage: e.stage, status: e.status === 'running' ? 'running' : e.status === 'failed' ? 'failed' : e.stage === 'lipsync' ? 'done' : 'running', detail: e.detail } })); } }, defaultDubDeps);
      setResult(r);
    } catch (e) {
      const saved = resumeFrom(e); if (saved) setPaused(saved);
      setError(e instanceof Error && e.message === 'Cancelled' ? 'Cancelled. Finished steps are kept, so resuming only pays for what is left.' : e instanceof Error ? e.message : 'Dubbing failed.');
    }
    finally { setRunning(false); abort.current = null; }
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-ink-900 p-3" aria-label="Dub this clip">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Languages className="h-3.5 w-3.5 text-accent" />Dub into other languages</div>
      {locked && <UnlockPrompt feature="dubbing" />}
      <fieldset disabled={locked || running} className="space-y-3 disabled:opacity-60">
        <div><Label hint={`${langs.length}/${MAX_DUB_LANGUAGES}`}>Languages</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Languages">
            {DUB_LANGUAGES.map(l => (
              <button key={l.id} type="button" onClick={() => toggle(l.id)} aria-pressed={langs.includes(l.id)}
                className={`rounded-lg border px-2 py-1 text-[11px] ${langs.includes(l.id) ? 'border-accent/60 bg-accent-soft text-white' : 'border-line bg-ink-850 text-zinc-400 hover:text-zinc-200'}`}>{l.label}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label>Voice</Label>
            <select aria-label="Dub voice" value={voiceKey} onChange={e => setVoiceKey(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-ink-850 px-2 text-[12px] text-zinc-200">
              {withVoice.map(c => <option key={c.id} value={`char:${c.id}`}>{c.name} ({c.voice_provider})</option>)}
              <option value="default:elevenlabs">Default voice (ElevenLabs)</option><option value="default:minimax">Default voice (MiniMax)</option>
            </select></div>
          <div><Label>Lip-sync</Label>
            <select aria-label="Dub lip-sync model" value={model} onChange={e => setModel(e.target.value as VoiceLipsyncModel)} className="h-9 w-full rounded-lg border border-line bg-ink-850 px-2 text-[12px] text-zinc-200">
              {models.map(m => <option key={m.slug} value={m.slug}>{m.label}</option>)}
            </select></div>
        </div>
        {trimmed && <p className="text-[11px] text-amber-300/90">This clip is trimmed on the timeline. Dubbing uses the whole original clip.</p>}
        {problem && langs.length > 0 && <p className="text-[11px] text-amber-300/90">{problem}</p>}
        <div className="flex items-center justify-between text-[12px]"><span className="text-zinc-500">Estimated cost</span><span className="tnum font-medium text-zinc-200" data-testid="dub-cost">{langs.length ? formatCredits(est.total) : 'pick a language'}</span></div>
        <button type="button" onClick={() => { void start(); }} disabled={!canGenerate || !langs.length || !!problem} className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[12px] font-semibold text-black disabled:opacity-40">Dub it</button>
      </fieldset>
      {paused && !running && <button type="button" onClick={() => { void start(paused); }} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400/20 text-[12px] font-semibold text-amber-200">Resume dubbing</button>}
      {running && <button type="button" onClick={() => abort.current?.abort()} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-line text-[12px] text-zinc-300"><X className="h-3.5 w-3.5" />Cancel</button>}
      {Object.keys(progress).length > 0 && (
        <ul className="space-y-1.5" aria-label="Dub progress">
          {langs.map(l => {
            const p = progress[l]; const res = result?.results.find(r => r.language === l);
            return (
              <li key={l} className="rounded-lg bg-ink-850 px-2.5 py-2 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-200">{languageOf(l)?.label}</span>
                  {res?.url ? (
                    <span className="flex items-center gap-2">
                      <a href={res.url} target="_blank" rel="noreferrer" className="text-zinc-400 underline">Preview</a>
                      <button type="button" onClick={async () => { await onAddDub(res.url!, `${languageOf(l)?.label} dub`, sourceSeconds); setAdded(a => [...a, l]); }} disabled={added.includes(l)}
                        className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-zinc-100 hover:bg-white/15 disabled:opacity-50">{added.includes(l) ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{added.includes(l) ? 'Added' : 'Add to timeline'}</button>
                    </span>
                  ) : res?.error || p?.status === 'failed' ? <span className="text-red-300" role="alert">Failed</span>
                    : p?.status === 'running' ? <span className="flex items-center gap-1 text-zinc-400"><Loader2 className="h-3 w-3 animate-spin" />{STAGE_LABEL[p.stage]}</span>
                    : <span className="text-zinc-600">Waiting</span>}
                </div>
                {(res?.error || p?.detail) && !res?.url && <p className="mt-1 text-[11px] text-red-300">{res?.error ?? p?.detail}</p>}
                {res?.text && <p className="mt-1 text-[11px] text-zinc-500">“{res.text}”</p>}
              </li>
            );
          })}
        </ul>
      )}
      {result && result.state.warnings.length > 0 && <ul className="space-y-1 text-[11px] text-amber-300/90">{result.state.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
      {error && <p role="alert" className="text-[12px] text-red-300">{error}</p>}
    </div>
  );
}
