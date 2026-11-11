import { useState } from 'react';
import { Segmented, Label, inputCls, ModelChip } from './ui';
import { NATIVE_MODELS, type Aspect, type Pipeline } from '../../lib/muapi/registry';
import { buildNativePrompt, type TakeSpec } from '../../lib/muapi/prompt';
import { clsx } from '../../lib/format';

type Tab = 'take' | 'model' | 'output';

export function Inspector({ spec, set, slug, setSlug }: {
  spec: TakeSpec; set: <K extends keyof TakeSpec>(k: K, v: TakeSpec[K]) => void; slug: string; setSlug: (s: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('take');
  const [pipeline, setPipeline] = useState<Pipeline>('native');
  const models = NATIVE_MODELS.filter(m => m.mode === 'text' && m.aspects.includes(spec.aspect));
  const active = models.find(m => m.slug === slug);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-ink-850 shadow-panel">
      <div className="flex gap-1 border-b border-line p-2">
        {([['take', 'Take'], ['model', 'Model'], ['output', 'Output']] as const).map(([k, l]) => (
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

        {tab === 'output' && (<>
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
