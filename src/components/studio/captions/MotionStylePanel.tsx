import { Label, inputCls } from '../ui';
import { PresetGrid } from './PresetGrid';
import { MOTION_ENGINES, POSITION_MAX, POSITION_MIN, type CaptionStyle } from '../../../lib/captions/model';
import { CHOOSABLE_FONTS, FONT_META } from '../../../lib/captions/fontData';
import { LANGUAGES } from '../../../lib/captions/scripts';
import { isCustomised } from '../../../lib/captions/presets';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div><Label>{label}</Label>{children}</div>;
const Color = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
  <label className="flex items-center gap-2 rounded-xl border border-line bg-ink-950 px-2 py-1.5 text-[11px] text-zinc-400"><input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label={label} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />{label}<span className="ml-auto tnum text-zinc-600">{value}</span></label>
);

export function MotionStylePanel({ style, onChange, onPreset, onMaxWords }: { style: CaptionStyle; onChange: (patch: Partial<CaptionStyle>) => void; onPreset: (id: string) => void; onMaxWords: (n: number) => void }) {
  const weights = FONT_META[style.font].weights;
  const setColors = (patch: Partial<CaptionStyle['colors']>) => onChange({ colors: { ...style.colors, ...patch } });
  return (
    <div className="space-y-4 pb-2">
      <div><div className="mb-1.5 flex items-center justify-between"><Label>Presets</Label>{isCustomised(style) && <span className="text-[10px] text-accent">customised</span>}</div><PresetGrid style={style} onPick={onPreset} /></div>

      <Row label="Motion">
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Motion engine">
          {MOTION_ENGINES.map(e => (
            <button key={e.id} role="radio" aria-checked={style.engine === e.id} onClick={() => onChange({ engine: e.id })} title={e.blurb}
              className={`rounded-xl border px-2.5 py-1.5 text-left text-[12px] transition-colors ${style.engine === e.id ? 'border-accent bg-accent-soft/40 text-white' : 'border-line bg-ink-950 text-zinc-400 hover:border-zinc-600'}`}>{e.label}</button>
          ))}
        </div>
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Font"><select className={inputCls} value={style.font} onChange={e => { const f = e.target.value as CaptionStyle['font']; onChange({ font: f }); }} aria-label="Font">{CHOOSABLE_FONTS.map(f => <option key={f} value={f}>{FONT_META[f].label}</option>)}</select></Row>
        <Row label="Weight"><select className={inputCls} value={style.weight} onChange={e => onChange({ weight: Number(e.target.value) })} aria-label="Weight" disabled={weights.length < 2}>{weights.map(w => <option key={w} value={w}>{w}</option>)}</select></Row>
      </div>
      <Row label="Weight on the spoken word">
        <select className={inputCls} value={style.weightTo ?? ''} onChange={e => onChange({ weightTo: e.target.value ? Number(e.target.value) : undefined })} aria-label="Weight transition" disabled={weights.length < 2}>
          <option value="">Same weight</option>{weights.filter(w => w !== style.weight).map(w => <option key={w} value={w}>{w > style.weight ? `Heavier: ${w}` : `Lighter: ${w}`}</option>)}
        </select>
      </Row>

      <Row label={`Size ${style.size}`}><input type="range" min={36} max={140} value={style.size} onChange={e => onChange({ size: Number(e.target.value) })} className="w-full accent-[#ffb000]" aria-label="Size" /></Row>
      <Row label={`Outline ${style.outlineWidth}`}><input type="range" min={0} max={14} value={style.outlineWidth} onChange={e => onChange({ outlineWidth: Number(e.target.value) })} className="w-full accent-[#ffb000]" aria-label="Outline" /></Row>
      <Row label={`Position from bottom ${style.positionY}%`}><input type="range" min={POSITION_MIN} max={POSITION_MAX} value={style.positionY} onChange={e => onChange({ positionY: Number(e.target.value) })} className="w-full accent-[#ffb000]" aria-label="Position" /></Row>
      <Row label={`Words per line ${style.maxWords}`}><input type="range" min={1} max={8} value={style.maxWords} onChange={e => onMaxWords(Number(e.target.value))} className="w-full accent-[#ffb000]" aria-label="Words per line" /></Row>

      <div className="grid grid-cols-2 gap-2">
        <Color label="Text" value={style.colors.text} onChange={v => setColors({ text: v })} />
        <Color label="Highlight" value={style.colors.highlight} onChange={v => setColors({ highlight: v, box: style.engine === 'accent_box' ? v : style.colors.box })} />
        <Color label="Outline" value={style.colors.outline} onChange={v => setColors({ outline: v })} />
        <Color label="Box" value={style.colors.box} onChange={v => setColors({ box: v })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Row label="Language"><select className={inputCls} value={style.language} onChange={e => onChange({ language: e.target.value })} aria-label="Caption language">{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select></Row>
        <Row label="Case"><label className="flex h-[38px] items-center gap-2 rounded-xl border border-line bg-ink-950 px-3 text-[12px] text-zinc-300"><input type="checkbox" checked={style.uppercase} onChange={e => onChange({ uppercase: e.target.checked })} />UPPERCASE</label></Row>
      </div>
      <p className="text-[11px] text-zinc-600">Script fonts (Japanese, Arabic, Hindi, Hebrew and more) are chosen automatically from the text. Colours and motion apply live in the preview and the export.</p>
    </div>
  );
}
