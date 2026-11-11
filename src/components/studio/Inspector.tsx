import { useState } from 'react';
import { Segmented, Label, inputCls, ModelChip } from './ui';
import { NATIVE_MODELS, type Aspect, type Pipeline } from '../../lib/muapi/registry';
import { buildNativePrompt, type TakeSpec } from '../../lib/muapi/prompt';
import { clsx } from '../../lib/format';
import { Plus, Check, AlertCircle, Loader2, Captions } from 'lucide-react';
import type { ClipJob } from '../../lib/muapi/jobs';
import type { Clip } from '../../lib/timeline/types';
import { FONTS, FONT_IDS, type FontId } from '../../lib/captions/fonts';

type Tab = 'take' | 'model' | 'output' | 'media' | 'clip';

export function Inspector({ spec, set, slug, setSlug, jobs, loading, onAddJob, usedUrls, clip, onClipChange, fps, captionFont, onCaptionFont, captionCount, captionState, onGenerateCaptions, hasKey }: {
  spec: TakeSpec; set: <K extends keyof TakeSpec>(k: K, v: TakeSpec[K]) => void; slug: string; setSlug: (s: string) => void;
  jobs: ClipJob[]; loading: boolean; onAddJob: (j: ClipJob) => void; usedUrls: Set<string>;
  clip?: Clip; onClipChange: (patch: Partial<Clip>) => void; fps: number;
  captionFont: FontId; onCaptionFont: (f: FontId) => void;
  captionCount: number; captionState: { busy: boolean; error: string }; onGenerateCaptions: () => void; hasKey: boolean;
}) {
  const [tab, setTab] = useState<Tab>('take');
  const [lastClip, setLastClip] = useState<string>();
  if (clip?.id !== lastClip) { setLastClip(clip?.id); if (clip) setTab('clip'); else if (tab === 'clip') setTab('take'); }
  const [pipeline, setPipeline] = useState<Pipeline>('native');
  const models = NATIVE_MODELS.filter(m => m.mode === 'text' && m.aspects.includes(spec.aspect));
  const active = models.find(m => m.slug === slug);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-ink-850 shadow-panel">
      <div className="flex gap-1 border-b border-line p-2">
        {([['take', 'Take'], ['model', 'Model'], ['output', 'Output'], ['media', 'Media'], ...(clip ? [['clip', 'Clip']] : [])] as Array<[Tab, string]>).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx('flex-1 rounded-lg py-1.5 text-[12px] font-medium transition', tab === k ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-200')}>{l}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {tab === 'take' && (<>
          <div><Label hint={`${spec.take.length}/220`}>The take</Label>
            <textarea className={inputCls} rows={4} maxLength={220} value={spec.take} onChange={e => set('take', e.target.value)} /></div>
          <div><Label>Guest</Label><input className={inputCls} value={spec.guestDescription} onChange={e => set('guestDescription', e.target.value)} /></div>
          <div><Label>Setting</Label><input className={inputCls} value={spec.setting} onChange={e => set('setting', e.target.value)} /></div>
          <div><Label>Tone</Label>
            <Segmented value={spec.tone} onChange={v => set('tone', v)} options={[{ value: 'playful', label: 'Playful' }, { value: 'deadpan', label: 'Deadpan' }, { value: 'heated', label: 'Heated' }]} /></div>
          <details className="rounded-xl border border-line bg-ink-950 p-3 text-[12px] text-zinc-500">
            <summary className="cursor-pointer text-zinc-400">Final prompt</summary>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{buildNativePrompt(spec)}</p>
          </details>
        </>)}

        {tab === 'model' && (<>
          <div><Label>Pipeline</Label>
            <Segmented value={pipeline} onChange={setPipeline} options={[
              { value: 'native', label: 'Native audio' },
              { value: 'lipsync', label: 'Voice + lipsync', disabled: true, hint: 'Next phase' },
              { value: 'recast', label: 'Recast', disabled: true, hint: 'Phase after next' },
            ]} />
            <p className="mt-2 text-[11px] text-zinc-600">The model generates the speech in-shot. Voice + lipsync and Recast are coming next.</p>
          </div>
          <div><Label hint={active ? active.label : ''}>Model</Label>
            <div className="grid gap-2">
              {models.map(m => <ModelChip key={m.slug} label={m.label} tier={m.tier} audio={m.nativeAudio} active={m.slug === slug} onClick={() => setSlug(m.slug)} />)}
            </div>
          </div>
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
                    <p className="truncate text-[10px] text-zinc-500">{j.status === 'failed' ? j.error : j.model}</p>
                  </div>
                  {j.output_url && (
                    <button onClick={() => onAddJob(j)} className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white/5 px-2.5 text-[11px] font-medium text-zinc-200 hover:bg-white/10">
                      {used ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Plus className="h-3.5 w-3.5" />}{used ? 'Add again' : 'Add'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'clip' && clip && (<>
          <div><Label>{clip.kind === 'caption' ? 'Caption' : 'Video clip'}</Label><p className="truncate text-[12px] text-zinc-400">{clip.label}</p></div>
          {clip.kind === 'caption' && <div><Label>Text</Label><textarea className={inputCls} rows={3} value={clip.text ?? ''} onChange={e => onClipChange({ text: e.target.value })} /></div>}
          {clip.kind === 'video' && <div><Label hint={`${Math.round((clip.volume ?? 1) * 100)}%`}>Volume</Label>
            <input type="range" className="w-full" min={0} max={1} step={0.05} value={clip.volume ?? 1} onChange={e => onClipChange({ volume: Number(e.target.value) })} /></div>}
          {clip.kind === 'video' && (
            <div className="space-y-2 rounded-xl border border-line bg-ink-950 p-3">
              <div className="flex items-center justify-between"><Label>Auto captions</Label><span className="text-[11px] text-zinc-600 tnum">~$0.01 / clip</span></div>
              <button onClick={onGenerateCaptions} disabled={captionState.busy || !hasKey || !clip.src?.startsWith('http')}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/5 text-[12px] font-medium text-zinc-100 transition hover:bg-white/10 disabled:opacity-40">
                {captionState.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Captions className="h-4 w-4" />}
                {captionState.busy ? 'Transcribing…' : captionCount ? `Regenerate (${captionCount} captions)` : 'Generate captions'}
              </button>
              {!hasKey && <p className="text-[11px] text-zinc-600">Add your muapi key in Settings first.</p>}
              {captionState.error && <p className="flex gap-1.5 text-[11px] text-red-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{captionState.error}</p>}
              {captionCount > 0 && !captionState.error && <p className="text-[11px] text-zinc-500">Captions are on the Captions track; click one to edit its text.</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div><Label>Start</Label><p className="tnum text-zinc-300">{(clip.start / fps).toFixed(2)}s</p></div>
            <div><Label>Length</Label><p className="tnum text-zinc-300">{(clip.duration / fps).toFixed(2)}s</p></div>
          </div>
          <p className="text-[11px] text-zinc-600">Drag to move, drag the edges to trim, S to split at the playhead.</p>
        </>)}

        {tab === 'output' && (<>
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
