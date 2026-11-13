import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Label, Segmented, inputCls } from './ui';
import { clsx } from '../../lib/format';
import { AMBIENCE, CITIES, CROWDS, NEIGHBORHOODS, NYC_LINES, SCENES, STREET_SCENES, TIMES, cityOf, placeLabel, stationsFor, type AmbienceId, type PlaceSpec } from '../../lib/places';

const chip = (on: boolean) => clsx('rounded-lg border px-2.5 py-1.5 text-[12px] transition', on ? 'border-accent/60 bg-accent-soft text-white' : 'border-line bg-ink-850 text-zinc-400 hover:border-white/15 hover:text-zinc-200');

export function PlacePanel({ place, onChange }: { place: PlaceSpec; onChange: (p: PlaceSpec) => void }) {
  const [more, setMore] = useState(false);
  const set = (patch: Partial<PlaceSpec>) => onChange({ ...place, ...patch });
  const city = cityOf(place.city);
  const stations = stationsFor(place.city, place.line);
  const toggleAmb = (id: AmbienceId) => set({ ambience: place.ambience.includes(id) ? place.ambience.filter(a => a !== id) : [...place.ambience, id] });

  return (
    <section aria-label="Place" className="space-y-3 rounded-xl border border-line bg-ink-950 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Place</span>
        <span className="truncate pl-2 text-[11px] text-zinc-500">{placeLabel(place)}</span>
      </div>
      <Segmented value={place.mode} onChange={mode => set({ mode })} options={[{ value: 'transit', label: 'Transit' }, { value: 'street', label: 'Street' }]} />

      {place.mode === 'transit' ? (<>
        <div><Label hint={`card: ${city.card}`}>City</Label>
          <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto pr-1" role="listbox" aria-label="City">
            {CITIES.map(c => (
              <button key={c.id} role="option" aria-selected={c.id === place.city} onClick={() => set({ city: c.id, line: undefined, station: undefined })}
                className={clsx(chip(c.id === place.city), 'flex items-center gap-2 text-left')}>
                <span className="h-4 w-4 shrink-0 rounded-[4px]" style={{ background: `linear-gradient(135deg, ${c.swatch[0]} 50%, ${c.swatch[1]} 50%)` }} />
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-zinc-600">{city.tagline}. Mic: {city.card}.</p>
        </div>
        <div><Label>Scene</Label>
          <div className="flex flex-wrap gap-1.5">{SCENES.map(s => <button key={s.id} title={s.hint} onClick={() => set({ scene: s.id })} className={chip(s.id === place.scene)}>{s.label}</button>)}</div>
        </div>
      </>) : (<>
        <div><Label>Scene</Label>
          <div className="flex flex-wrap gap-1.5">{STREET_SCENES.map(s => <button key={s.id} onClick={() => set({ streetScene: s.id })} className={chip(s.id === place.streetScene)}>{s.label}</button>)}</div>
        </div>
        <div><Label>Neighborhood</Label>
          <div className="flex flex-wrap gap-1.5">{NEIGHBORHOODS.map(n => <button key={n.id} onClick={() => set({ neighborhood: place.neighborhood === n.id ? undefined : n.id })} className={chip(n.id === place.neighborhood)}>{n.label}</button>)}</div>
        </div>
      </>)}

      <div><Label>Time of day</Label>
        <div className="flex flex-wrap gap-1.5">{TIMES.map(t => <button key={t.id} onClick={() => set({ time: t.id })} className={chip(t.id === place.time)}><span aria-hidden>{t.emoji} </span>{t.label}</button>)}</div>
      </div>

      <button onClick={() => setMore(m => !m)} aria-expanded={more} className="flex w-full items-center justify-between text-[11px] font-medium text-zinc-500 hover:text-zinc-300">
        More <ChevronDown className={clsx('h-3.5 w-3.5 transition', more && 'rotate-180')} />
      </button>
      {more && (
        <div className="space-y-3">
          {place.mode === 'transit' && (<>
            <div><Label>Crowd</Label>
              <Segmented value={place.crowd} onChange={crowd => set({ crowd })} options={CROWDS.map(c => ({ value: c.id, label: c.label }))} /></div>
            <div><Label>Ambient sound</Label>
              <div className="flex flex-wrap gap-1.5">{AMBIENCE.map(a => <button key={a.id} onClick={() => toggleAmb(a.id)} aria-pressed={place.ambience.includes(a.id)} className={chip(place.ambience.includes(a.id))}>{a.label}</button>)}</div></div>
            {place.city === 'nyc' && (
              <div><Label>Line</Label>
                <div className="flex flex-wrap gap-1.5">{NYC_LINES.map(l => (
                  <button key={l.id} onClick={() => set({ line: place.line === l.id ? undefined : l.id, station: undefined })} title={l.service} aria-pressed={place.line === l.id}
                    className={clsx('grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white ring-offset-2 ring-offset-ink-950 transition', place.line === l.id && 'ring-2 ring-white')} style={{ background: l.color, color: l.color === '#FCCC0A' ? '#000' : '#fff' }}>{l.id}</button>
                ))}</div></div>
            )}
            {stations.length > 0 && (
              <div><Label>Station</Label>
                <select className={inputCls} value={place.station ?? ''} onChange={e => set({ station: e.target.value || undefined })}>
                  <option value="">Automatic</option>
                  {stations.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
            )}
          </>)}
          <div><Label>{place.city === 'custom' && place.mode === 'transit' ? 'Describe the place' : 'Extra detail'}</Label>
            <input className={inputCls} value={place.custom ?? ''} placeholder={place.city === 'custom' ? 'e.g. a night ferry crossing the harbour' : 'e.g. a busker plays nearby'} onChange={e => set({ custom: e.target.value })} /></div>
        </div>
      )}
    </section>
  );
}
