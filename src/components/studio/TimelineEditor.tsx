import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { Play, Pause, Scissors, Trash2, Type, ZoomIn, Undo2, Redo2, Film, Download, Volume2, Sparkles } from 'lucide-react';
import { clsx } from '../../lib/format';
import { Kbd } from './ui';
import { addClip, deleteClip, framesToTime, moveClip, newId, projectDuration, snap, splitAt, trimClip } from '../../lib/timeline/ops';
import type { Clip, Project } from '../../lib/timeline/types';

const GUTTER = 84;
const ROW = 52;
const RULER = 26;
const TRIM_HANDLE = 8;

interface Props {
  project: Project;
  setProject: (p: Project, record?: boolean) => void;
  checkpoint: () => void;
  undo: () => void; redo: () => void;
  frame: number; playing: boolean;
  onSeek: (f: number) => void; onToggle: () => void;
  selectedId?: string; onSelect: (id?: string) => void;
  captionDefault: string;
  onExport: () => void;
}

type Drag = { kind: 'move' | 'left' | 'right'; id: string; x0: number; base: Project; origStart: number };

export function TimelineEditor(p: Props) {
  const { project, frame, selectedId } = p;
  const fps = project.fps;
  const [ppf, setPpf] = useState(3);               // pixels per frame
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const total = projectDuration(project);
  const width = Math.max(900, (total + fps * 6) * ppf);

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space') { e.preventDefault(); p.onToggle(); }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) p.redo(); else p.undo(); }
      else if (e.key.toLowerCase() === 's' && !mod) { e.preventDefault(); p.setProject(splitAt(project, frame, selectedId)); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); p.setProject(deleteClip(project, selectedId, e.shiftKey)); p.onSelect(undefined); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  // keep playhead in view while playing
  useEffect(() => {
    const el = scroller.current; if (!el || !p.playing) return;
    const x = frame * ppf;
    if (x > el.scrollLeft + el.clientWidth - 40 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 80);
  }, [frame, p.playing, ppf]);

  const frameFromX = (clientX: number) => {
    const el = scroller.current!; const r = el.getBoundingClientRect();
    return Math.max(0, Math.round((clientX - r.left + el.scrollLeft) / ppf));
  };
  const trackAtY = (clientY: number) => {
    const el = scroller.current!; const r = el.getBoundingClientRect();
    const i = Math.floor((clientY - r.top - RULER) / ROW);
    return project.tracks[Math.min(project.tracks.length - 1, Math.max(0, i))];
  };

  function startDrag(e: RPE, c: Clip, kind: Drag['kind']) {
    e.stopPropagation(); e.preventDefault();
    p.onSelect(c.id); p.checkpoint();
    drag.current = { kind, id: c.id, x0: e.clientX, base: project, origStart: c.start };
    const move = (ev: PointerEvent) => {
      const d = drag.current; if (!d) return;
      const delta = Math.round((ev.clientX - d.x0) / ppf);
      const thr = Math.ceil(8 / ppf);
      if (d.kind === 'move') {
        const orig = d.base.clips.find(x => x.id === d.id)!;
        let s = d.origStart + delta;
        const sStart = snap(d.base, s, thr, d.id, frame);
        const sEnd = snap(d.base, s + orig.duration, thr, d.id, frame) - orig.duration;
        s = Math.abs(sStart - s) <= Math.abs(sEnd - s) ? sStart : sEnd;
        const track = trackAtY(ev.clientY);
        p.setProject(moveClip(d.base, d.id, s, track.id), false);
      } else {
        p.setProject(trimClip(d.base, d.id, d.kind, delta), false);
      }
    };
    const up = () => { drag.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  function scrub(e: RPE) {
    const go = (x: number) => p.onSeek(Math.min(Math.max(0, frameFromX(x)), Math.max(0, total || fps * 5)));
    go(e.clientX);
    const move = (ev: PointerEvent) => go(ev.clientX);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  const addCaption = () => {
    const text = p.captionDefault.split(/\s+/).slice(0, 8).join(' ');
    const track = project.tracks.find(t => t.kind === 'caption')!;
    const next = addClip(project, { id: newId(), trackId: track.id, kind: 'caption', label: 'Caption', start: frame, duration: fps * 2, trimStart: 0, text });
    p.setProject(next);
    p.onSelect(next.clips[next.clips.length - 1].id);
  };

  const ticks: number[] = [];
  const stepSec = ppf * fps >= 70 ? 1 : ppf * fps >= 30 ? 2 : 5;
  for (let s = 0; s * fps * ppf < width; s += stepSec) ticks.push(s);
  const btn = 'grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <section className="flex shrink-0 select-none flex-col border-t border-line bg-ink-950" aria-label="Timeline editor">
      <div className="flex items-center gap-1 border-b border-line px-3 py-1.5">
        <button className={btn} onClick={p.onToggle} aria-label={p.playing ? 'Pause' : 'Play'}>{p.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
        <div className="mx-2 tnum text-[12px] text-zinc-300">{framesToTime(frame, fps)} <span className="text-zinc-600">/ {framesToTime(total, fps)}</span></div>
        <span className="mx-1 h-4 w-px bg-line" />
        <button className={btn} onClick={() => p.setProject(splitAt(project, frame, selectedId))} title="Split at playhead (S)" aria-label="Split"><Scissors className="h-4 w-4" /></button>
        <button className={btn} disabled={!selectedId} onClick={() => { if (selectedId) { p.setProject(deleteClip(project, selectedId)); p.onSelect(undefined); } }} title="Delete (Del) · Shift+Del ripples" aria-label="Delete clip"><Trash2 className="h-4 w-4" /></button>
        <button className={btn} onClick={addCaption} title="Add caption at playhead" aria-label="Add caption"><Type className="h-4 w-4" /></button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button className={btn} onClick={p.undo} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
        <button className={btn} onClick={p.redo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
        <div className="ml-auto hidden items-center gap-3 md:flex md:ml-auto">
          <span className="flex items-center gap-1 text-[11px] text-zinc-600"><Kbd>Space</Kbd> play <Kbd>S</Kbd> split <Kbd>Del</Kbd> delete</span>
          <ZoomIn className="h-3.5 w-3.5 text-zinc-500" />
          <input type="range" min={0.8} max={10} step={0.1} value={ppf} onChange={e => setPpf(Number(e.target.value))} className="w-24" aria-label="Zoom" />
        </div>
        <button onClick={p.onExport} disabled={total <= 0} title={total > 0 ? 'Render the timeline to a video file' : 'Add a shot to export'}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-accent-hot px-3 text-[12px] font-semibold text-black shadow-glow transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none md:ml-3">
          <Download className="h-3.5 w-3.5" />Export
        </button>
      </div>

      <div className="relative flex" style={{ height: RULER + ROW * project.tracks.length + 6 }}>
        <div className="shrink-0 border-r border-line bg-ink-950" style={{ width: GUTTER, paddingTop: RULER }}>
          {project.tracks.map(t => (
            <div key={t.id} className="flex items-center gap-1.5 px-3 text-[11px] font-medium text-zinc-500" style={{ height: ROW }}>
              {t.kind === 'video' ? <Film className="h-3.5 w-3.5" /> : t.kind === 'audio' ? <Volume2 className="h-3.5 w-3.5" /> : t.kind === 'effect' ? <Sparkles className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}{t.name}
            </div>
          ))}
        </div>
        <div ref={scroller} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width, height: '100%' }}>
            <div className="absolute inset-x-0 top-0 cursor-col-resize border-b border-line bg-ink-900" style={{ height: RULER }} onPointerDown={scrub}>
              {ticks.map(s => (
                <div key={s} className="absolute top-0 h-full border-l border-white/10 pl-1 text-[10px] text-zinc-600 tnum" style={{ left: s * fps * ppf }}>{s}s</div>
              ))}
            </div>
            {project.tracks.map((t, i) => (
              <div key={t.id} className="absolute inset-x-0 border-b border-line/60" style={{ top: RULER + i * ROW, height: ROW, background: i % 2 ? 'rgba(255,255,255,0.012)' : 'transparent' }} onPointerDown={e => { p.onSelect(undefined); scrub(e); }} />
            ))}
            {project.clips.map(c => {
              const row = project.tracks.findIndex(t => t.id === c.trackId);
              const sel = c.id === selectedId;
              const z = c.transitionIn ? 5 : 1;
              const isVideo = c.kind === 'video';
              return (
                <div key={c.id} onPointerDown={e => startDrag(e, c, 'move')} role="button" aria-label={`${c.label} clip`}
                  className={clsx('absolute cursor-grab overflow-hidden rounded-lg border active:cursor-grabbing',
                    isVideo ? 'border-amber-400/40 bg-gradient-to-b from-amber-500/30 to-amber-700/20'
                      : c.kind === 'audio' ? 'border-emerald-400/40 bg-gradient-to-b from-emerald-500/30 to-emerald-700/20'
                      : c.kind === 'effect' ? 'border-fuchsia-400/40 bg-gradient-to-b from-fuchsia-500/30 to-fuchsia-700/20'
                      : 'border-sky-400/40 bg-gradient-to-b from-sky-500/30 to-sky-700/20',
                    sel && 'ring-2 ring-white shadow-glow')}
                  style={{ left: c.start * ppf, width: Math.max(8, c.duration * ppf), top: RULER + row * ROW + 4, height: ROW - 8, zIndex: z }}>
                  {isVideo && c.src && <video src={c.src + '#t=0.1'} muted preload="metadata" className="pointer-events-none absolute inset-y-0 left-0 h-full w-10 object-cover opacity-80" />}
                  <div className={clsx('pointer-events-none relative truncate px-2 py-1 text-[11px] font-medium text-white', isVideo && 'pl-12')}>
                    {c.kind === 'caption' ? c.text : c.label}
                    <div className="text-[9px] font-normal text-white/60 tnum">{(c.duration / fps).toFixed(1)}s</div>
                  </div>
                  {c.transitionIn && (
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center border-r border-white/40 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.28)_0_4px,transparent_4px_8px)]"
                      style={{ width: c.transitionIn.frames * ppf }} title={`${c.transitionIn.type} · ${(c.transitionIn.frames / fps).toFixed(1)}s`} />
                  )}
                  <div onPointerDown={e => startDrag(e, c, 'left')} className="absolute inset-y-0 left-0 cursor-ew-resize bg-white/0 hover:bg-white/40" style={{ width: TRIM_HANDLE }} aria-label="Trim start" />
                  <div onPointerDown={e => startDrag(e, c, 'right')} className="absolute inset-y-0 right-0 cursor-ew-resize bg-white/0 hover:bg-white/40" style={{ width: TRIM_HANDLE }} aria-label="Trim end" />
                </div>
              );
            })}
            {project.clips.length === 0 && (
              <div className="pointer-events-none absolute left-4 text-[12px] text-zinc-600" style={{ top: RULER + 18 }}>Generate a shot or add one from the Media tab to start cutting.</div>
            )}
            {/* playhead */}
            <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-accent" style={{ left: frame * ppf }}>
              <div className="absolute -left-[5px] top-0 h-3 w-[11px] rounded-b-sm bg-accent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

