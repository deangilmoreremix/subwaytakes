import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Upload, Sparkles, Loader2, Play, Square, AlertCircle, UserRound, Mic } from 'lucide-react';
import { Segmented, Label, inputCls } from '../components/studio/ui';
import { clsx } from '../lib/format';
import { DEFAULT_HOST, buildPortraitPrompt, createCharacter, deleteCharacter, generateRandomGuest, listCharacters, updateCharacter } from '../lib/characters';
import { generatePortrait, uploadPortrait } from '../lib/muapi/portrait';
import { useVoices } from '../lib/muapi/useVoices';
import { SPEED_RANGE, TTS_SLUG, buildTtsInput, clampSpeed, type VoiceProvider } from '../lib/muapi/voices';
import { getMuapiKey, runModel } from '../lib/muapi/client';
import type { CharacterBible } from '../lib/types';

const SAMPLE_LINE = "So what's ur take? Honestly, pineapple belongs on pizza.";

export function CastPage() {
  const [list, setList] = useState<CharacterBible[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [error, setError] = useState('');
  const hasKey = !!getMuapiKey();

  const refresh = useCallback(async () => {
    try { const l = await listCharacters(); setList(l); setSelectedId(id => id ?? l[0]?.id); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load characters'); setList([]); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function add(kind: 'host' | 'guest') {
    setError('');
    try {
      const base = kind === 'host' ? { ...DEFAULT_HOST, is_default: !(list ?? []).some(c => c.role === 'host') } : generateRandomGuest();
      const c = await createCharacter({ ...base, name: kind === 'host' ? 'Host' : `Guest ${(list ?? []).filter(x => x.role === 'guest').length + 1}` });
      await refresh(); setSelectedId(c.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the character'); }
  }

  const selected = list?.find(c => c.id === selectedId);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-2xl font-semibold tracking-tight text-white">Cast</h1><p className="text-[13px] text-zinc-500">Faces and voices for talking shots. Characters are reused across episodes.</p></div>
        <div className="flex gap-2">
          <button onClick={() => add('host')} className="flex h-9 items-center gap-2 rounded-xl bg-white/5 px-3 text-[13px] font-medium text-zinc-200 hover:bg-white/10"><Plus className="h-4 w-4" />Host</button>
          <button onClick={() => add('guest')} className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-3 text-[13px] font-semibold text-black"><Plus className="h-4 w-4" />Guest</button>
        </div>
      </div>
      {!hasKey && <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft p-3 text-[13px] text-accent"><AlertCircle className="h-4 w-4" />Add your muapi key in <Link to="/settings" className="underline">Settings</Link> to generate portraits and preview voices.</div>}
      {error && <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{error}</p>}

      {list === null && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>}
      {list && list.length === 0 && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-ink-950 py-16 text-center">
          <UserRound className="mb-3 h-8 w-8 text-zinc-600" />
          <p className="font-display text-lg text-white">No characters yet</p>
          <p className="mb-4 max-w-sm text-[13px] text-zinc-500">Create a host and a guest, give them a portrait and a voice, then use them in Voice + lipsync shots.</p>
          <button onClick={() => add('guest')} className="h-9 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black">Create a guest</button>
        </div>
      )}
      {list && list.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-2">
            {list.map(c => (
              <button key={c.id} onClick={() => setSelectedId(c.id)} className={clsx('flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition', c.id === selectedId ? 'border-accent/60 bg-accent-soft' : 'border-line bg-ink-850 hover:border-white/15')}>
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-ink-800">{c.portrait_url ? <img src={c.portrait_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-zinc-600"><UserRound className="h-5 w-5" /></div>}</div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-white">{c.name}</p>
                  <p className="text-[11px] capitalize text-zinc-500">{c.role}{c.is_default ? ' · default' : ''}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500"><Mic className="h-3 w-3" />{c.voice_id ? `${c.voice_provider}` : 'no voice'}</p>
                </div>
              </button>
            ))}
          </div>
          {selected && <CharacterEditor key={selected.id} character={selected} hasKey={hasKey} onSaved={refresh} onDeleted={() => { setSelectedId(undefined); refresh(); }} />}
        </div>
      )}
    </div>
  );
}

function CharacterEditor({ character, hasKey, onSaved, onDeleted }: { character: CharacterBible; hasKey: boolean; onSaved: () => void; onDeleted: () => void }) {
  const [c, setC] = useState(character);
  const [busy, setBusy] = useState<'' | 'upload' | 'generate' | 'save' | 'preview'>('');
  const [err, setErr] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const provider: VoiceProvider = c.voice_provider ?? 'elevenlabs';
  const { voices, live } = useVoices(provider);
  const set = <K extends keyof CharacterBible>(k: K, v: CharacterBible[K]) => setC(p => ({ ...p, [k]: v }));
  const [lo, hi] = SPEED_RANGE[provider];

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function persist(patch: Partial<CharacterBible>) {
    const next = { ...c, ...patch };
    setC(next);
    await updateCharacter(c.id, { name: next.name, portrait_url: next.portrait_url ?? null, voice_provider: next.voice_provider ?? null, voice_id: next.voice_id ?? null, voice_speed: next.voice_speed ?? 1, distinguishing_features: next.distinguishing_features, energy_persona: next.energy_persona, clothing_style: next.clothing_style, hair_description: next.hair_description });
    onSaved();
  }
  const run = async (kind: typeof busy, fn: () => Promise<void>) => { setErr(''); setBusy(kind); try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(''); } };

  async function preview() {
    if (previewing) { audioRef.current?.pause(); setPreviewing(false); return; }
    await run('preview', async () => {
      if (!c.voice_id) throw new Error('Pick a voice first.');
      const { url } = await runModel(TTS_SLUG[provider], buildTtsInput(provider, SAMPLE_LINE, c.voice_id, c.voice_speed), { intervalMs: 2000 });
      const a = new Audio(url); audioRef.current = a; a.onended = () => setPreviewing(false); setPreviewing(true);
      await a.play().catch(() => { setPreviewing(false); throw new Error('The browser blocked audio playback.'); });
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-line bg-ink-850 p-5 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <input value={c.name} onChange={e => set('name', e.target.value)} onBlur={() => persist({ name: c.name })} aria-label="Character name" className="min-w-0 bg-transparent font-display text-xl font-semibold text-white focus:outline-none" />
        <button onClick={() => run('save', async () => { await deleteCharacter(c.id); onDeleted(); })} aria-label="Delete character" className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <Label>Portrait</Label>
          <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-line bg-ink-950">
            {c.portrait_url ? <img src={c.portrait_url} alt={`${c.name} portrait`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-3 text-center text-[11px] text-zinc-600">No portrait yet</div>}
            {(busy === 'upload' || busy === 'generate') && <div className="absolute inset-0 grid place-items-center bg-black/60"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>}
          </div>
          <div className="mt-2 grid gap-1.5">
            <label className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white/5 text-[12px] font-medium text-zinc-200 hover:bg-white/10">
              <Upload className="h-3.5 w-3.5" />Upload
              <input type="file" accept="image/*" className="sr-only" aria-label="Upload portrait" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run('upload', async () => { await persist({ portrait_url: await uploadPortrait(f) }); }); }} />
            </label>
            <button disabled={!hasKey || !!busy} onClick={() => run('generate', async () => { await persist({ portrait_url: await generatePortrait(buildPortraitPrompt(c)) }); })} className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-accent to-accent-hot text-[12px] font-semibold text-black disabled:opacity-40"><Sparkles className="h-3.5 w-3.5" />Generate · ~$0.03</button>
          </div>
        </div>

        <div className="space-y-4">
          <div><Label>Voice</Label>
            <Segmented value={provider} onChange={v => persist({ voice_provider: v, voice_id: null, voice_speed: 1 })} options={[{ value: 'elevenlabs', label: 'ElevenLabs' }, { value: 'minimax', label: 'MiniMax' }]} />
            <select value={c.voice_id ?? ''} onChange={e => persist({ voice_provider: provider, voice_id: e.target.value || null })} aria-label="Voice" className={clsx(inputCls, 'mt-2')}>
              <option value="">Choose a voice…</option>
              {voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            {provider === 'elevenlabs' && !live && <p className="mt-1 text-[11px] text-zinc-600">Showing a short list. Add your muapi key to load every voice.</p>}
          </div>
          <div><Label hint={`${clampSpeed(provider, c.voice_speed).toFixed(2)}x`}>Speed</Label>
            <input type="range" className="w-full" min={lo} max={hi} step={0.05} value={clampSpeed(provider, c.voice_speed)} onChange={e => set('voice_speed', Number(e.target.value))} onMouseUp={() => persist({ voice_speed: c.voice_speed })} onTouchEnd={() => persist({ voice_speed: c.voice_speed })} onKeyUp={() => persist({ voice_speed: c.voice_speed })} aria-label="Voice speed" /></div>
          <button disabled={!hasKey || !c.voice_id || (busy !== '' && busy !== 'preview')} onClick={preview} className="flex h-9 items-center gap-2 rounded-xl bg-white/5 px-3 text-[13px] font-medium text-zinc-100 hover:bg-white/10 disabled:opacity-40">
            {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : previewing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}{previewing ? 'Stop' : 'Preview voice'}
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Hair</Label><input className={inputCls} value={c.hair_description} onChange={e => set('hair_description', e.target.value)} onBlur={() => persist({ hair_description: c.hair_description })} /></div>
            <div><Label>Clothing</Label><input className={inputCls} value={c.clothing_style} onChange={e => set('clothing_style', e.target.value)} onBlur={() => persist({ clothing_style: c.clothing_style })} /></div>
          </div>
          <p className="text-[11px] text-zinc-600">These fields feed the portrait prompt. The portrait and voice are what Voice + lipsync shots use.</p>
        </div>
      </div>
      {err && <p className="flex gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{err}</p>}
    </div>
  );
}
