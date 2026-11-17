import { useEffect, useMemo, useState } from 'react';
import { CAPTION_PRESETS, PRESET_CATEGORIES, presetOf, styleFromPreset } from '../../../lib/captions/presets';
import { CHOOSABLE_FONTS, FONT_META, nearestWeight } from '../../../lib/captions/fontData';
import { loadFamilies, FALLBACK_STACK } from '../../../lib/captions/fontLoaders';
import { wordCss } from '../../../lib/captions/motion';
import type { CaptionStyle } from '../../../lib/captions/model';
import { clsx } from '../../../lib/format';

/** Loads the latin fonts once for DOM previews (the picker only shows latin text). */
function useDomFonts(): Record<string, string> {
  const [fam, setFam] = useState<Record<string, string>>({});
  useEffect(() => { let live = true; void loadFamilies(CHOOSABLE_FONTS.map(key => ({ key, weights: FONT_META[key].weights.filter(w => [300, 400, 700, 800, 900].includes(w)) }))).then(f => { if (live) setFam(f); }); return () => { live = false; }; }, []);
  return fam;
}

const SAMPLE = ['Pineapple', 'belongs', 'on'];

/** One small live sample of a preset: the same CSS the renderer uses, with the second word "active" (karaoke half-filled). */
function Sample({ id, families }: { id: string; families: Record<string, string> }) {
  const s = styleFromPreset(id);
  const k = 0.2;
  const family = families[s.font] ?? `"${FONT_META[s.font].family}", ${FALLBACK_STACK}`;
  return (
    <div className="flex h-12 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-zinc-700 to-zinc-900" style={{ fontFamily: family }}>
      <div className="flex items-baseline" style={{ columnGap: s.size * k * 0.34 }}>
        {SAMPLE.map((w, i) => {
          const st = { spoken: i <= 1, active: i === 1, progress: 0.5, pop: 1, ease: 1 };
          const { style: css, fill } = wordCss({ ...s, font: s.font }, k, { ...st, spoken: i <= 1 }, s.uppercase);
          return <span key={w} style={{ ...css, fontWeight: nearestWeight(s.font, s.weight) === css.fontWeight ? css.fontWeight : css.fontWeight }}>{w}{fill && fill.percent > 0 && <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${fill.percent}%`, overflow: 'hidden', whiteSpace: 'pre', color: fill.color, padding: css.padding, boxSizing: 'border-box', textShadow: css.textShadow, textTransform: css.textTransform, fontWeight: css.fontWeight }}>{w}</span>}</span>;
        })}
      </div>
    </div>
  );
}

export function PresetGrid({ style, onPick, compact = false }: { style: CaptionStyle; onPick: (id: string) => void; compact?: boolean }) {
  const families = useDomFonts();
  const [cat, setCat] = useState<string>('All');
  const list = useMemo(() => CAPTION_PRESETS.filter(p => cat === 'All' || p.category === cat), [cat]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Preset categories">
        {['All', ...PRESET_CATEGORIES].map(c => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={clsx('rounded-full border px-2.5 py-1 text-[11px] transition-colors', cat === c ? 'border-accent/60 bg-accent-soft text-accent' : 'border-line text-zinc-500 hover:text-zinc-200')}>{c}</button>
        ))}
      </div>
      <div className={clsx('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')} data-testid="preset-grid">
        {list.map(p => (
          <button key={p.id} onClick={() => onPick(p.id)} title={p.note} aria-pressed={style.presetId === p.id} data-preset={p.id}
            className={clsx('rounded-xl border p-1.5 text-left transition-colors', style.presetId === p.id ? 'border-accent bg-accent-soft/40' : 'border-line bg-ink-950 hover:border-zinc-600')}>
            <Sample id={p.id} families={families} />
            <div className="mt-1 flex items-center justify-between px-0.5"><span className="truncate text-[11px] font-medium text-zinc-200">{p.label}</span><span className="text-[9px] uppercase tracking-wide text-zinc-600">{presetOf(p.id).style.engine.replace('_', ' ')}</span></div>
          </button>
        ))}
      </div>
    </div>
  );
}
