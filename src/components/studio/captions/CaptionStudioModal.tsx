import { useCallback, useMemo, useRef, useState } from 'react';
import type { PlayerRef } from '@remotion/player';
import { X, Captions, History } from 'lucide-react';
import { PhonePreview, PREVIEW_BGS, type PreviewBg } from './PhonePreview';
import { TranscriptPanel } from './TranscriptPanel';
import { MotionStylePanel } from './MotionStylePanel';
import { ExportPanel } from './ExportPanel';
import type { Clip, Project } from '../../../lib/timeline/types';
import type { CaptionStyle } from '../../../lib/captions/model';
import { DEFAULT_CAPTION_STYLE, styleFromPreset } from '../../../lib/captions/presets';
import { resegment } from '../../../lib/captions/edit';
import { listVersions, saveVersion, type CaptionVersion } from '../../../lib/captions/cache';
import { newId } from '../../../lib/timeline/ops';
import type { Aspect } from '../../../lib/muapi/registry';
import { clsx } from '../../../lib/format';

type Tab = 'transcript' | 'style' | 'export';
interface Snap { caps: Clip[]; style: CaptionStyle }
const SPEEDS = [0.75, 1, 1.25, 1.5];
const same = (a: Snap, b: Snap) => a.caps === b.caps && a.style === b.style;

/** Capite-style "Studio": phone preview on the left; Transcript, Motion & Style and Export tabs on the right. Edits stay in here (with undo) until Apply. */
export function CaptionStudioModal({ project, aspect, projectKey, onApply, onBurn, onClose }: {
  project: Project; aspect: Aspect; projectKey: string; onApply: (caps: Clip[], style: CaptionStyle) => void; onBurn: (caps: Clip[], style: CaptionStyle) => void; onClose: () => void;
}) {
  const initial = useMemo<Snap>(() => ({ caps: project.clips.filter(c => c.kind === 'caption'), style: project.style?.captions ?? DEFAULT_CAPTION_STYLE }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [snap, setSnap] = useState<Snap>(initial);
  const past = useRef<Snap[]>([]); const future = useRef<Snap[]>([]);
  const [, bump] = useState(0);
  const [tab, setTab] = useState<Tab>('transcript');
  const [bg, setBg] = useState<PreviewBg>('video');
  const [speed, setSpeed] = useState(1);
  const [light, setLight] = useState(false);
  const [frame, setFrame] = useState(0);
  const [versions, setVersions] = useState<CaptionVersion[]>(() => listVersions(projectKey));
  const [showVersions, setShowVersions] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const dirty = !same(snap, initial);

  const push = useCallback((next: Snap) => { past.current.push(snap); if (past.current.length > 100) past.current.shift(); future.current = []; setSnap(next); bump(n => n + 1); }, [snap]);
  const apply = useCallback((fn: (c: Clip[]) => Clip[]) => push({ ...snap, caps: fn(snap.caps) }), [push, snap]);
  const undo = () => { const p = past.current.pop(); if (p) { future.current.push(snap); setSnap(p); bump(n => n + 1); } };
  const redo = () => { const n = future.current.pop(); if (n) { past.current.push(snap); setSnap(n); bump(x => x + 1); } };
  const lastStyleEdit = useRef({ key: '', at: 0 });
  /** One undo step per drag or slider move: edits to the same control within 700 ms replace the step instead of adding one. */
  const setStyle = (patch: Partial<CaptionStyle>) => {
    const next = { ...snap, style: { ...snap.style, ...patch } }; const key = Object.keys(patch).join(','); const now = Date.now();
    const merge = key === lastStyleEdit.current.key && now - lastStyleEdit.current.at < 700 && past.current.length > 0;
    lastStyleEdit.current = { key, at: now };
    if (merge) setSnap(next); else push(next);
  };
  const pickPreset = (id: string) => push({ ...snap, style: styleFromPreset(id, { language: snap.style.language, positionY: snap.style.positionY, maxWords: snap.style.maxWords }) });
  const setMaxWords = (n: number) => push({ caps: resegment(snap.caps, project.fps, { maxWords: n }, () => newId('cap')), style: { ...snap.style, maxWords: n } });

  // the preview is the real composition on a copy of the project that carries the edited captions and style
  const preview = useMemo<Project>(() => ({ ...project, clips: [...project.clips.filter(c => c.kind !== 'caption'), ...snap.caps], style: { ...project.style, captions: snap.style } }), [project, snap]);
  const seek = (f: number) => { playerRef.current?.seekTo(Math.max(0, f)); setFrame(f); };

  const commit = (after: () => void) => {
    const v: CaptionVersion = { id: newId('ver'), at: Date.now(), label: `${snap.style.presetId} · ${snap.caps.length} lines`, clips: snap.caps, style: snap.style };
    saveVersion(projectKey, v); setVersions(listVersions(projectKey));
    onApply(snap.caps, snap.style); after();
  };
  const close = () => { if (!dirty || window.confirm('Close without applying your caption changes?')) onClose(); };

  return (
    <div className={clsx('fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-sm', light && 'caption-studio-light')} role="dialog" aria-modal="true" aria-label="Caption studio">
      <div className={clsx('flex h-[min(92vh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border shadow-2xl', light ? 'border-zinc-300 bg-zinc-100 text-zinc-900 [&_*]:!border-zinc-300' : 'border-line bg-ink-850')} style={light ? { filter: 'invert(0.92) hue-rotate(180deg)' } : undefined}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-white"><Captions className="h-4 w-4 text-accent" />Caption studio {dirty && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">unsaved changes</span>}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLight(l => !l)} className="rounded-lg border border-line px-2 py-1 text-[11px] text-zinc-400 hover:text-white" aria-pressed={light}>{light ? 'Dark' : 'Light'} theme</button>
            <div className="relative">
              <button onClick={() => setShowVersions(s => !s)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] text-zinc-400 hover:text-white"><History className="h-3.5 w-3.5" />Versions ({versions.length})</button>
              {showVersions && (
                <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-line bg-ink-900 p-2 shadow-xl">
                  {versions.length === 0 ? <p className="p-2 text-[11px] text-zinc-500">Versions are saved each time you press Apply.</p> : versions.map(v => (
                    <button key={v.id} onClick={() => { push({ caps: v.clips, style: v.style }); setShowVersions(false); }} className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:bg-zinc-800">{new Date(v.at).toLocaleString()}<span className="block text-zinc-500">{v.label}</span></button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={close} aria-label="Close" className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 p-4 md:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col items-center gap-2">
            <div className="min-h-0 w-full flex-1 [&>div]:mx-auto" style={light ? { filter: 'hue-rotate(180deg) invert(0.92)' } : undefined}><PhonePreview project={preview} aspect={aspect} bg={bg} speed={speed} playerRef={playerRef} onFrame={setFrame} onPosition={p => setStyle({ positionY: p })} heightClass="h-full" /></div>
            <div className="flex flex-wrap items-center justify-center gap-1" role="group" aria-label="Preview background">
              {PREVIEW_BGS.map(b => <button key={b.id} onClick={() => setBg(b.id)} aria-pressed={bg === b.id} className={clsx('rounded-full border px-2 py-0.5 text-[11px]', bg === b.id ? 'border-accent text-accent' : 'border-line text-zinc-500')}>{b.label}</button>)}
            </div>
            <div className="flex items-center justify-center gap-1" role="group" aria-label="Playback speed">
              {SPEEDS.map(s => <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={clsx('rounded-full border px-2 py-0.5 text-[11px] tnum', speed === s ? 'border-accent text-accent' : 'border-line text-zinc-500')}>{s}×</button>)}
              <button onClick={() => playerRef.current?.toggle()} className="ml-1 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-zinc-300">Play / pause</button>
            </div>
            <p className="text-[10px] text-zinc-600">Drag the dashed line on the phone to move the captions.</p>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-line bg-ink-950 p-1" role="tablist">
              {([['transcript', 'Transcript'], ['style', 'Motion & Style'], ['export', 'Export']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={clsx('h-8 rounded-lg text-[12px] font-medium', tab === id ? 'bg-ink-600 text-white' : 'text-zinc-500 hover:text-zinc-200')}>{label}</button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {tab === 'transcript' && <TranscriptPanel caps={snap.caps} frame={frame} fps={project.fps} onSeek={seek} apply={apply} undo={undo} redo={redo} canUndo={past.current.length > 0} canRedo={future.current.length > 0} />}
              {tab === 'style' && <MotionStylePanel style={snap.style} onChange={setStyle} onPreset={pickPreset} onMaxWords={setMaxWords} />}
              {tab === 'export' && <ExportPanel caps={snap.caps} fps={project.fps} style={snap.style} disabled={snap.caps.length === 0} onBurn={() => commit(() => onBurn(snap.caps, snap.style))} />}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-[11px] text-zinc-600">Apply puts these captions on your timeline. No re-transcribing, no re-render: the look is live until you export.</p>
          <div className="flex gap-2">
            <button onClick={close} className="h-9 rounded-xl border border-line px-4 text-[13px] text-zinc-300 hover:text-white">Cancel</button>
            <button onClick={() => commit(onClose)} disabled={!dirty} data-testid="apply-captions" className="h-9 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black disabled:opacity-40">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}
