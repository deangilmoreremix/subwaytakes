import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Segmented, Label, inputCls, ModelChip } from './ui';
import { DictateButton } from './DictateButton';
import { ClipReframe } from './ClipReframe';
import { VersePicker } from './VersePicker';
import { QuotePicker } from './QuotePicker';
import { bibleComposition, quoteComposition } from '../../lib/bible/spec';
import { NATIVE_MODELS, type Aspect, type Pipeline } from '../../lib/muapi/registry';
import { buildNativePrompt, type TakeSpec } from '../../lib/muapi/prompt';
import { FORMATS } from '../../lib/interview';
import { PlacePanel } from './PlacePanel';
import { IdeasButton } from './IdeasButton';
import { BatchBox } from './BatchBox';
import { TemplatePicker } from './TemplatePicker';
import { DubPanel } from './DubPanel';
import type { Template } from '../../lib/templates';
import { SHOWS, TONE_LABEL, showOf, titleFor } from '../../lib/shows';
import type { StoredTitle } from '../../lib/shows/stored';
import { clsx } from '../../lib/format';
import { Plus, Check, AlertCircle, Loader2, Captions, Play, Square, Sparkles, UserRound, Lock } from 'lucide-react';
import { UnlockPrompt } from '../UnlockPrompt';
import { useBilling } from '../../lib/billing/useBilling';
import { showFeature, showLocked, type Feature } from '../../lib/billing/features';
import type { CharacterBible } from '../../lib/types';
import type { ClipJob } from '../../lib/muapi/jobs';
import type { Clip } from '../../lib/timeline/types';
import { FONTS, FONT_IDS, type FontId } from '../../lib/captions/fonts';
import { SFX, type Sfx } from '../../lib/timeline/sfx';
import { TRANSITIONS } from '../../lib/timeline/transitions';
import type { TransitionContext } from '../../lib/timeline/ops';
import type { TransitionType } from '../../lib/timeline/types';

type Tab = 'take' | 'model' | 'output' | 'media' | 'clip';

/** Tells the customer, in plain words, whether the verse will be spoken in full and how to get word-exact audio. */
function BibleNote({ spec }: { spec: TakeSpec }) {
  const c = bibleComposition(spec);
  return (
    <div className="space-y-1 rounded-xl border border-line bg-ink-950 p-2.5 text-[11px] text-zinc-400" data-testid="bible-note">
      <p><b className="text-zinc-200">The guest says:</b> {c.line || '(nothing yet)'}</p>
      {spec.verse && (c.readsVerse
        ? <p>The whole verse ({c.verseWords} words) fits this clip and is spoken.</p>
        : <p>This verse ({c.verseWords} words) is too long to speak in this clip, so the guest names it and reflects; the exact verse is on screen. Use a longer clip to speak it.</p>)}
      <p>Video models can still garble spoken words. The on-screen verse is always exact. For word-for-word audio, use the Cuts format (the voice reads the text exactly).</p>
    </div>
  );
}

function QuoteNote({ spec }: { spec: TakeSpec }) {
  const c = quoteComposition(spec);
  return (
    <div className="space-y-1 rounded-xl border border-line bg-ink-950 p-2.5 text-[11px] text-zinc-400" data-testid="quote-note">
      <p><b className="text-zinc-200">The guest says:</b> {c.line || '(nothing yet)'}</p>
      {c.readsQuote ? <p>The whole quote ({c.quoteWords} words) fits this clip and is spoken.</p> : <p>This quote ({c.quoteWords} words) is too long to speak in this clip, so the guest names the author and comments; the exact quote is on screen. Use a longer clip to speak it.</p>}
      <p>Video models can still garble spoken words. The on-screen quote is always exact. For word-for-word audio, use the Cuts format.</p>
    </div>
  );
}

export function Inspector({ aiLabel, onAiLabel, fileSlot, onAddDub, onTemplate, spec, set, slug, setSlug, jobs, loading, onAddJob, usedUrls, clip, onClipChange, pipeline, onPipeline, lipsyncSlot, cutsSlot, characters, hostHint, imageRoute, title, onTitle, onBestOf, videoClipCount, onBatch, batch, onAddSfx, onAddEffect, transition, onTransition, fps, captionFont, onCaptionFont, captionCount, hasCaptions, onGenerateCaptions, onOpenStudio, canGenerate }: {
  aiLabel: boolean; onAiLabel: (on: boolean) => void;
  /** extra content at the end of the Output tab (the project file card) */
  fileSlot?: ReactNode;
  onTemplate: (t: Template) => void; onAddDub: (url: string, label: string, seconds: number) => Promise<void>;
  spec: TakeSpec; set: <K extends keyof TakeSpec>(k: K, v: TakeSpec[K]) => void; slug: string; setSlug: (s: string) => void;
  jobs: ClipJob[]; loading: boolean; onAddJob: (j: ClipJob) => void; usedUrls: Set<string>;
  pipeline: Pipeline; onPipeline: (p: Pipeline) => void; lipsyncSlot: ReactNode; cutsSlot: ReactNode; characters: CharacterBible[]; hostHint?: string; imageRoute: boolean; title?: StoredTitle; onTitle: (t: StoredTitle | undefined) => void; onBestOf: () => void; videoClipCount: number; onBatch: (lines: string[]) => void; batch: { running: boolean; done: number; total: number; failed: string[] } | null;
  clip?: Clip; onClipChange: (patch: Partial<Clip>) => void; onAddSfx: (s: Sfx) => void; onAddEffect: () => void; fps: number;
  transition: TransitionContext; onTransition: (t: { type: TransitionType; frames: number } | null) => void;
  captionFont: FontId; onCaptionFont: (f: FontId) => void;
  captionCount: number; hasCaptions: boolean; onGenerateCaptions: () => void; onOpenStudio: () => void; canGenerate: boolean;
}) {
  const [tab, setTab] = useState<Tab>('take');
  const { owned, has } = useBilling();
  const [unlock, setUnlock] = useState<Feature | null>(null);
  const [lastClip, setLastClip] = useState<string>();
  const [playingSfx, setPlayingSfx] = useState<string>();
  const audioEl = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audioEl.current?.pause(); }, []);
  function togglePreview(f: Sfx) {
    audioEl.current?.pause();
    if (playingSfx === f.id) { setPlayingSfx(undefined); return; }
    const a = new Audio(f.url); audioEl.current = a; setPlayingSfx(f.id);
    a.onended = () => setPlayingSfx(undefined);
    a.play().catch(() => setPlayingSfx(undefined));
  }
  if (clip?.id !== lastClip) { setLastClip(clip?.id); if (clip) setTab('clip'); else if (tab === 'clip') setTab('take'); }
  const models = NATIVE_MODELS.filter(m => m.mode === (imageRoute ? 'image' : 'text') && m.aspects.includes(spec.aspect));
  const active = models.find(m => m.slug === slug);
  const show = showOf(spec.show);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-ink-850 shadow-panel">
      <div className="flex gap-1 border-b border-line p-2">
        {([['take', 'Take'], ['model', 'Model'], ['output', 'Output'], ['media', 'Media'], ...(clip ? [['clip', 'Clip']] : [])] as Array<[Tab, string]>).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx('flex-1 rounded-lg py-1.5 text-[12px] font-medium transition', tab === k ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200')}>{l}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {tab === 'take' && (<>
          <TemplatePicker onPick={onTemplate} />
          <div><Label>Show</Label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
              {SHOWS.map(sh => (
                <button key={sh.id} onClick={() => { const sf = showFeature(sh.id); if (sf && showLocked(sh.id, owned)) setUnlock(sf); else { setUnlock(null); set('show', sh.id); } }} aria-pressed={spec.show === sh.id} title={sh.blurb}
                  className={clsx('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] transition', spec.show === sh.id ? 'border-accent/60 bg-accent-soft text-white' : 'border-line bg-ink-850 text-zinc-400 hover:border-white/15 hover:text-zinc-200')}>
                  {sh.label}{showLocked(sh.id, owned) && <Lock aria-label="locked" className="h-3 w-3 text-zinc-500" />}
                </button>
              ))}
            </div>
            {unlock && unlock !== 'cuts' && ['happiness', 'bible', 'motivation'].includes(unlock) && <UnlockPrompt feature={unlock} onClose={() => setUnlock(null)} className="mt-2" />}
            <p className="mt-1.5 text-[11px] text-zinc-600">{show.blurb}</p>
          </div>
          {show.editableQuestion && (
            <div><Label hint={<IdeasButton ideas={show.ideas} onPick={t => set('question', t.slice(0, 160))} />}>The host asks</Label>
              <input className={inputCls} maxLength={160} value={spec.question ?? show.question} onChange={e => set('question', e.target.value)} /></div>
          )}
          {show.id === 'motivation' && (<>
            <QuotePicker quote={spec.quote} onQuote={q => set('quote', q)} />
            {spec.quote && (<>
              <div><Label hint={<span className="flex items-center gap-3"><DictateButton value={spec.reflection ?? ''} onChange={v => set('reflection', v)} />{(spec.reflection ?? '').length}/220</span>}>Your comment on it</Label>
                <textarea className={inputCls} rows={3} maxLength={220} value={spec.reflection ?? ''} onChange={e => set('reflection', e.target.value)} aria-label="Comment" /></div>
              <QuoteNote spec={spec} />
            </>)}
          </>)}
          {show.id === 'bible' ? (<>
            <VersePicker verse={spec.verse} onVerse={v => set('verse', v)} />
            <div><Label hint={<span className="flex items-center gap-3"><DictateButton value={spec.reflection ?? ''} onChange={v => set('reflection', v)} />{(spec.reflection ?? '').length}/220</span>}>What it means to them</Label>
              <textarea className={inputCls} rows={3} maxLength={220} value={spec.reflection ?? ''} onChange={e => set('reflection', e.target.value)} aria-label="Reflection" /></div>
            <BibleNote spec={spec} />
          </>) : show.id === 'motivation' && spec.quote ? null : (
          <div><Label hint={<span className="flex items-center gap-3"><DictateButton value={spec.take} onChange={v => set('take', v)} />{!show.editableQuestion && <IdeasButton onPick={t => set('take', t.slice(0, 220))} />}{spec.take.length}/220</span>}>{show.id === 'hot_take' ? 'The take' : show.answerLabel}</Label>
            <textarea className={inputCls} rows={4} maxLength={220} value={spec.take} onChange={e => set('take', e.target.value)} /></div>
          )}

          {show.guests === 2 && (<>
            <div><Label hint={`${(spec.take2 ?? '').length}/220`}>Guest B takes</Label>
              <textarea className={inputCls} rows={3} maxLength={220} value={spec.take2 ?? ''} onChange={e => set('take2', e.target.value)} /></div>
            <div><Label>Guest B looks like</Label><input className={inputCls} value={spec.guest2Description ?? ''} placeholder="e.g. a woman in her 20s with a denim jacket" onChange={e => set('guest2Description', e.target.value)} /></div>
          </>)}
          <div><Label>{show.guests === 2 ? 'Guest A looks like' : 'Guest'}</Label><input className={inputCls} value={spec.guestDescription} onChange={e => set('guestDescription', e.target.value)} /></div>
          {spec.format === 'twoshot' && (
            <div><Label>Host</Label>
              <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Host source">
                <button onClick={() => set('hostCharacterId', undefined)} aria-pressed={!spec.hostCharacterId} className={clsx('rounded-lg border px-2.5 py-1.5 text-[12px] transition', !spec.hostCharacterId ? 'border-accent/60 bg-accent-soft text-white' : 'border-line bg-ink-850 text-zinc-400 hover:text-zinc-200')}>Describe</button>
                {characters.map(c => (
                  <button key={c.id} onClick={() => set('hostCharacterId', c.id)} aria-pressed={spec.hostCharacterId === c.id} className={clsx('flex items-center gap-1.5 rounded-lg border py-1 pl-1 pr-2.5 text-[12px] transition', spec.hostCharacterId === c.id ? 'border-accent/60 bg-accent-soft text-white' : 'border-line bg-ink-850 text-zinc-400 hover:text-zinc-200')}>
                    {c.portrait_url ? <img src={c.portrait_url} alt="" className="h-6 w-5 rounded object-cover" /> : <span className="grid h-6 w-5 place-items-center rounded bg-ink-800 text-zinc-600"><UserRound className="h-3 w-3" /></span>}{c.name}
                  </button>
                ))}
                <Link to="/cast" className="rounded-lg border border-dashed border-white/15 px-2.5 py-1.5 text-[12px] text-zinc-500 hover:text-accent">+ New in Cast</Link>
              </div>
              {spec.hostCharacterId ? (
                <p className={clsx('text-[11px]', hostHint ? 'text-amber-300/90' : 'text-zinc-500')}>{hostHint ?? 'Uses their portrait: a starting image of both of you is made first, so the host keeps the same face.'}</p>
              ) : <input className={inputCls} value={spec.hostDescription} onChange={e => set('hostDescription', e.target.value)} />}
            </div>
          )}
          {spec.format !== 'twoshot' && <div><Label>Host</Label><input className={inputCls} value={spec.hostDescription} onChange={e => set('hostDescription', e.target.value)} /></div>}
          <PlacePanel place={spec.place} onChange={p => set('place', p)} />
          <div><Label>Tone</Label>
            <Segmented value={spec.tone} onChange={v => set('tone', v)} options={show.tones.map(t => ({ value: t, label: TONE_LABEL[t] }))} /></div>
          <BatchBox show={show.id} editableQuestion={show.editableQuestion} duel={show.guests === 2} disabled={spec.format !== 'twoshot' || imageRoute} onBatch={onBatch} batch={batch} />
          <details className="rounded-xl border border-line bg-ink-950 p-3 text-[12px] text-zinc-500">
            <summary className="cursor-pointer text-zinc-400">Final prompt</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{buildNativePrompt(spec)}</p>
          </details>
        </>)}

        {tab === 'model' && (<>
          <div><Label>Interview format</Label>
            <Segmented value={spec.format} onChange={v => { if (v === 'cuts' && !has('cuts')) setUnlock('cuts'); else { setUnlock(null); set('format', v); } }} options={FORMATS.map(f => ({ value: f.id, label: f.id === 'cuts' && !has('cuts') ? `${f.label} 🔒` : f.label, hint: f.hint }))} />
            {unlock === 'cuts' && <UnlockPrompt feature="cuts" onClose={() => setUnlock(null)} className="mt-2" />}
            <p className="mt-2 text-[11px] text-zinc-600">{FORMATS.find(f => f.id === spec.format)?.hint}. Both people hold a transit card as the microphone.</p>
          </div>
          {spec.format === 'cuts' ? cutsSlot : (<>
          <div><Label>Pipeline</Label>
            <Segmented value={pipeline} onChange={onPipeline} options={[
              { value: 'native', label: 'Native audio' },
              { value: 'lipsync', label: 'Voice + lipsync', hint: 'Portrait + voice becomes a talking video' },
              { value: 'recast', label: 'Recast', hint: 'Swap the performer in a clip' },
            ]} />
            <p className="mt-2 text-[11px] text-zinc-600">{pipeline === 'native' ? 'The video model generates the speech in-shot.' : pipeline === 'lipsync' ? "A character's portrait and voice become a talking video." : 'Replace the performer in an existing clip while keeping its motion and soundtrack.'}</p>
          </div>
          {pipeline === 'recast' ? (
            <Link to="/recast" className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent-soft px-3 py-3 text-[13px] font-semibold text-accent">Open Recast <span aria-hidden>→</span></Link>
          ) : pipeline === 'lipsync' ? lipsyncSlot : (
            <div><Label hint={active ? active.label : ''}>Model</Label>
              <div className="grid gap-2">
                {models.map(m => <ModelChip key={m.slug} label={m.label} tier={m.tier} audio={m.nativeAudio} active={m.slug === slug} onClick={() => setSlug(m.slug)} />)}
              </div>
            </div>
          )}
          </>)}
        </>)}


        {tab === 'media' && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-600">Your generated shots. Add them to the timeline to cut an episode.</p>
            {loading && !jobs.length && [0, 1].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
            {!loading && !jobs.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[12px] text-zinc-500">No shots yet. Generate one with the prompt bar.</p>}
            {jobs.map(j => {
              const used = !!j.output_url && usedUrls.has(j.output_url);
              return (
                <div key={j.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink-950 p-2">
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                    {j.output_url ? <video src={j.output_url + '#t=0.1'} muted preload="metadata" playsInline className="h-full w-full object-cover" />
                      : <div className="grid h-full place-items-center">{j.status === 'failed' ? <AlertCircle className="h-4 w-4 text-red-400" /> : <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-zinc-200">{typeof j.input?.take === 'string' ? j.input.take : 'Untitled take'}</p>
                    <p className="truncate text-[10px] text-zinc-500">{j.pipeline === 'lipsync' && <span className="mr-1 rounded bg-fuchsia-500/15 px-1 text-fuchsia-300">Lipsync</span>}{j.status === 'failed' ? j.error : j.model}</p>
                  </div>
                  {j.output_url && (
                    <button onClick={() => onAddJob(j)} className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white/5 px-2.5 text-[11px] font-medium text-zinc-200 hover:bg-white/10">
                      {used ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Plus className="h-3.5 w-3.5" />}{used ? 'Add again' : 'Add'}
                    </button>
                  )}
                </div>
              );
            })}
            <div className="pt-3"><Label hint="at playhead">Effects</Label>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-950 px-2 py-1.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-400/30 to-fuchsia-500/30 text-fuchsia-200"><Sparkles className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-200">Light leak</span>
                <button onClick={onAddEffect} aria-label="Add Light leak" className="flex h-7 items-center gap-1 rounded-lg bg-white/5 px-2 text-[11px] font-medium text-zinc-200 hover:bg-white/10"><Plus className="h-3 w-3" />Add</button>
              </div>
            </div>
            <div className="pt-3"><Label hint="at playhead">Sound effects</Label>
              <div className="space-y-1.5">
                {SFX.map(f => (
                  <div key={f.id} className="flex items-center gap-2 rounded-xl border border-line bg-ink-950 px-2 py-1.5">
                    <button onClick={() => togglePreview(f)} aria-label={`Preview ${f.label}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10">
                      {playingSfx === f.id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-200">{f.label}</span>
                    <button onClick={() => onAddSfx(f)} aria-label={`Add ${f.label}`} className="flex h-7 items-center gap-1 rounded-lg bg-white/5 px-2 text-[11px] font-medium text-zinc-200 hover:bg-white/10"><Plus className="h-3 w-3" />Add</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'clip' && clip && (<>
          <div><Label>{clip.kind === 'caption' ? 'Caption' : clip.kind === 'audio' ? 'Sound effect' : clip.kind === 'effect' ? 'Effect' : 'Video clip'}</Label><p className="truncate text-[12px] text-zinc-400">{clip.label}</p></div>
          {clip.kind === 'caption' && <div><Label>Text</Label><textarea className={inputCls} rows={3} value={clip.text ?? ''} onChange={e => onClipChange({ text: e.target.value, words: undefined })} /></div>}   {/* the words are re-spread from the new text, so the preview and the export change too */}
          {clip.kind === 'video' && clip.src && (
            <div><Label>Reframe</Label>
              <ClipReframe src={clip.src} atSeconds={(clip.trimStart + 6) / fps} frameAspect={(() => { const [a, b] = spec.aspect.split(':').map(Number); return a / b; })()} crop={clip.crop} onChange={c => onClipChange({ crop: c })} /></div>
          )}
          {clip.kind === 'effect' && clip.effect && (<>
            <div><Label hint={`${clip.effect.hueShift}°`}>Color shift</Label>
              <input type="range" className="w-full" min={0} max={360} value={clip.effect.hueShift} onChange={e => onClipChange({ effect: { ...clip.effect!, hueShift: Number(e.target.value) } })} /></div>
            <div><Label hint={`#${clip.effect.seed}`}>Pattern</Label>
              <input type="range" className="w-full" min={1} max={20} value={clip.effect.seed} onChange={e => onClipChange({ effect: { ...clip.effect!, seed: Number(e.target.value) } })} /></div>
          </>)}
          {(clip.kind === 'video' || clip.kind === 'audio') && <div><Label hint={`${Math.round((clip.volume ?? 1) * 100)}%`}>Volume</Label>
            <input type="range" className="w-full" min={0} max={1} step={0.05} value={clip.volume ?? 1} onChange={e => onClipChange({ volume: Number(e.target.value) })} /></div>}
          {clip.kind === 'video' && (
            <div className="space-y-2.5 rounded-xl border border-line bg-ink-950 p-3">
              <Label hint={transition.current ? `${(transition.current.frames / fps).toFixed(1)}s` : undefined}>Transition in</Label>
              {transition.available ? (<>
                <div className="grid grid-cols-4 gap-1.5">
                  <button onClick={() => onTransition(null)} className={clsx('h-8 rounded-lg text-[11px] font-medium transition', !transition.current ? 'bg-ink-600 text-white' : 'bg-white/5 text-zinc-400 hover:text-white')}>None</button>
                  {TRANSITIONS.map(t => (
                    <button key={t.id} onClick={() => onTransition({ type: t.id, frames: transition.current?.frames ?? Math.min(15, transition.maxFrames) })}
                      className={clsx('h-8 rounded-lg text-[11px] font-medium transition', transition.current?.type === t.id ? 'bg-accent-soft text-accent ring-1 ring-accent/50' : 'bg-white/5 text-zinc-400 hover:text-white')}>{t.label}</button>
                  ))}
                </div>
                {transition.current && (
                  <input type="range" className="w-full" aria-label="Transition length" min={2} max={Math.max(2, transition.maxFrames)} value={transition.current.frames}
                    onChange={e => onTransition({ type: transition.current!.type, frames: Number(e.target.value) })} />
                )}
              </>) : <p className="text-[11px] text-zinc-600">Place this clip directly after another clip (no gap) to add a transition between them.</p>}
              <p className="text-[10px] text-zinc-600">The two clips overlap during a transition, so the episode gets shorter by its length.</p>
            </div>
          )}
          {clip.kind === 'video' && (
            <div className="space-y-2 rounded-xl border border-line bg-ink-950 p-3">
              <div className="flex items-center justify-between"><Label>Auto captions</Label><span className="text-[11px] text-zinc-600">free, on your device</span></div>
              <button onClick={onGenerateCaptions} disabled={!clip.src?.startsWith('http')} data-testid="open-generate-captions"
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/5 text-[12px] font-medium text-zinc-100 transition hover:bg-white/10 disabled:opacity-40">
                <Captions className="h-4 w-4" />{captionCount ? `Regenerate captions (${captionCount} lines)…` : 'Generate captions…'}
              </button>
              {hasCaptions && <button onClick={onOpenStudio} data-testid="open-caption-studio" className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-accent/40 text-[12px] font-medium text-accent hover:bg-accent-soft">Open caption studio</button>}
              <p className="text-[11px] text-zinc-500">Pick a style, transcribe in your browser, then edit words, timing and motion.</p>
            </div>
          )}
          {clip.kind === 'video' && clip.src?.startsWith('https://') && <DubPanel key={clip.id} clip={clip} fps={fps} characters={characters} canGenerate={canGenerate} onAddDub={onAddDub} />}
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div><Label>Start</Label><p className="tnum text-zinc-300">{(clip.start / fps).toFixed(2)}s</p></div>
            <div><Label>Length</Label><p className="tnum text-zinc-300">{(clip.duration / fps).toFixed(2)}s</p></div>
          </div>
          <p className="text-[11px] text-zinc-600">Drag to move, drag the edges to trim, S to split at the playhead.</p>
        </>)}

        {tab === 'output' && (<>
          {fileSlot}
          <div><Label>On-screen title</Label>
            <label className="flex items-center gap-2 text-[12px] text-zinc-300"><input type="checkbox" aria-label="Label as AI-generated" checked={aiLabel} onChange={e => onAiLabel(e.target.checked)} />Label the video "AI-generated" <span className="text-[10px] text-zinc-600">(recommended; many platforms require it)</span></label>
            <label className="flex items-center gap-2 text-[12px] text-zinc-300"><input type="checkbox" checked={!!title} onChange={e => onTitle(e.target.checked ? { data: titleFor(spec), showBadge: true } : undefined)} />Show the on-screen graphic ({show.label})</label>
            {title && (<div className="mt-2 space-y-2">
              <input className={inputCls} value={title.guest ?? ''} placeholder="Guest name sticker (optional)" onChange={e => onTitle({ ...title, guest: e.target.value || undefined })} />
              <div className="grid grid-cols-[1fr_72px] gap-2">
                <input className={inputCls} value={title.series?.name ?? ''} placeholder="Series name (optional)" onChange={e => onTitle({ ...title, series: e.target.value ? { name: e.target.value, episode: title.series?.episode ?? 1 } : undefined })} />
                <input className={inputCls} type="number" min={1} aria-label="Episode number" value={title.series?.episode ?? 1} disabled={!title.series} onChange={e => title.series && onTitle({ ...title, series: { ...title.series, episode: Math.max(1, Number(e.target.value) || 1) } })} />
              </div>
              <label className="flex items-center gap-2 text-[12px] text-zinc-400"><input type="checkbox" checked={title.showBadge !== false} onChange={e => onTitle({ ...title, showBadge: e.target.checked })} />{title.data.badge} badge</label>
            </div>)}
          </div>
          <div><Label hint={`${videoClipCount} shots`}>Best of</Label>
            <button onClick={onBestOf} disabled={videoClipCount < 2} className="h-9 w-full rounded-xl border border-line bg-ink-850 text-[12px] font-medium text-zinc-200 transition hover:border-white/15 disabled:opacity-40">Line up the first 8 shots with fades</button>
            <p className="mt-1.5 text-[11px] text-zinc-600">Puts your shots back to back with transitions. Sound and captions stay with their shot.</p></div>
          <div><Label>Caption font</Label>
            <Segmented value={captionFont} onChange={onCaptionFont} options={FONT_IDS.map(id => ({ value: id, label: FONTS[id].label, hint: FONTS[id].blurb }))} />
            <p className="mt-1.5 text-[11px] text-zinc-600" style={{ fontFamily: 'inherit' }}>Applies to every caption in the preview and the export.</p></div>
          <div><Label>Aspect ratio</Label>
            <Segmented value={spec.aspect} onChange={(v: Aspect) => set('aspect', v)} options={[{ value: '9:16', label: '9:16' }, { value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' }]} /></div>
          <div><Label hint={`${spec.durationSeconds}s`}>Length</Label>
            <input type="range" className="w-full" min={4} max={12} value={spec.durationSeconds} onChange={e => set('durationSeconds', Number(e.target.value))} />
            {active && <p className="mt-1 text-[11px] text-zinc-600">{active.label} supports {active.minDuration}–{active.maxDuration}s; values outside are clamped.</p>}
          </div>
        </>)}
      </div>
    </div>
  );
}
