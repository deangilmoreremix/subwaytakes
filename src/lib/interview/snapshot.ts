import { DEFAULT_TAKE, FORMATS, type InterviewFormat, type TakeSpec } from './index';
import { AMBIENCE, CITIES, CROWDS, DEFAULT_PLACE, SCENES, STREET_SCENES, TIMES, type PlaceSpec } from '../places';
import { SHOWS, showOf } from '../shows';
import { TRANSLATIONS, findVerse, pickVerse, typedVerse, type Translation } from '../bible';
import { findQuote, pickQuote } from '../quotes';
import { DEFAULT_LOOK, isLook } from './looks';
import { recomposeBible } from '../bible/spec';

// What a project remembers about the episode being made (show, take, verse, quote, place...), so reopening or reloading brings the same episode back.
// It is saved in `project.style.take`. Anything read back is VALIDATED: an unknown show, a removed verse or quote, a locked pack or format, or a value out of range
// falls back to the default, and verse and quote text is re-read from the verified libraries (never trusted from the saved copy).

export interface TakeSnapshot {
  v: 1;
  show: string; question?: string; take: string; take2?: string; guestDescription: string; hostDescription: string; guest2Description?: string; hostCharacterId?: string;
  place: PlaceSpec; tone: string; durationSeconds: number; aspect: string; format: string;
  verse?: { ref: string; translation: string; text?: string };
  quoteId?: string; reflection?: string;
  look?: string;
}

export function snapshotSpec(s: TakeSpec): TakeSnapshot {
  const snap: TakeSnapshot = { v: 1, show: s.show, take: s.take, guestDescription: s.guestDescription, hostDescription: s.hostDescription, place: s.place, tone: s.tone, durationSeconds: s.durationSeconds, aspect: s.aspect, format: s.format };
  if (s.question !== undefined) snap.question = s.question;
  if (s.take2 !== undefined) snap.take2 = s.take2;
  if (s.guest2Description !== undefined) snap.guest2Description = s.guest2Description;
  if (s.hostCharacterId !== undefined) snap.hostCharacterId = s.hostCharacterId;
  if (s.verse) snap.verse = s.verse.source === 'typed' ? { ref: s.verse.ref, translation: 'custom', text: s.verse.text } : { ref: s.verse.ref, translation: s.verse.translation };
  if (s.quote) snap.quoteId = s.quote.id;
  if (s.reflection !== undefined) snap.reflection = s.reflection;
  if (s.look && s.look !== DEFAULT_LOOK) snap.look = s.look;
  return snap;
}

export interface RestoreRules { showLocked: (showId: string) => boolean; cutsLocked: boolean }

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);

function restorePlace(raw: unknown): PlaceSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const p: PlaceSpec = { ...DEFAULT_PLACE };
  p.mode = oneOf(r.mode, ['transit', 'street'] as const, DEFAULT_PLACE.mode);
  p.city = oneOf(r.city, CITIES.map(c => c.id), DEFAULT_PLACE.city);
  p.scene = oneOf(r.scene, SCENES.map(x => x.id), DEFAULT_PLACE.scene);
  p.time = oneOf(r.time, TIMES.map(x => x.id), DEFAULT_PLACE.time);
  p.crowd = oneOf(r.crowd, CROWDS.map(x => x.id), DEFAULT_PLACE.crowd);
  p.streetScene = oneOf(r.streetScene, STREET_SCENES.map(x => x.id), DEFAULT_PLACE.streetScene);
  const amb = AMBIENCE.map(a => a.id);
  p.ambience = Array.isArray(r.ambience) ? r.ambience.filter((a): a is (typeof amb)[number] => typeof a === 'string' && (amb as string[]).includes(a)).slice(0, 6) : DEFAULT_PLACE.ambience;
  for (const k of ['line', 'station', 'neighborhood'] as const) { const v = str(r[k], 60); if (v) p[k] = v; }
  const custom = str(r.custom, 200); if (custom) p.custom = custom;
  return p;
}

/** Read a saved snapshot back into a take spec. Returns null when there is nothing usable (the caller keeps what it has). Never unlocks a pack. */
export function restoreSpec(raw: unknown, rules: RestoreRules): TakeSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<TakeSnapshot> & Record<string, unknown>;
  if (r.v !== 1 || typeof r.show !== 'string') return null;
  const showId = SHOWS.some(s => s.id === r.show) && !rules.showLocked(r.show) ? (r.show as TakeSpec['show']) : DEFAULT_TAKE.show;
  const sameShow = showId === r.show;
  const show = showOf(showId);
  const format: InterviewFormat = oneOf(r.format, FORMATS.map(f => f.id), DEFAULT_TAKE.format);
  const spec: TakeSpec = {
    ...DEFAULT_TAKE,
    show: showId,
    // if the saved show could not be restored (locked or unknown), only the neutral parts carry over
    question: sameShow && show.editableQuestion ? str(r.question, 160) : undefined,
    take: str(r.take, 600) ?? DEFAULT_TAKE.take,
    take2: sameShow ? str(r.take2, 220) : undefined,
    guestDescription: str(r.guestDescription, 300) ?? DEFAULT_TAKE.guestDescription,
    hostDescription: str(r.hostDescription, 300) ?? DEFAULT_TAKE.hostDescription,
    guest2Description: str(r.guest2Description, 300),
    hostCharacterId: str(r.hostCharacterId, 80),
    place: restorePlace(r.place),
    tone: show.tones.includes(r.tone as never) ? (r.tone as TakeSpec['tone']) : show.defaultTone,
    durationSeconds: Number.isFinite(Number(r.durationSeconds)) ? Math.min(12, Math.max(4, Math.round(Number(r.durationSeconds)))) : DEFAULT_TAKE.durationSeconds,
    aspect: oneOf(r.aspect, ['9:16', '16:9', '1:1'] as const, DEFAULT_TAKE.aspect),
    format: format === 'cuts' && rules.cutsLocked ? 'twoshot' : format,
    look: isLook(r.look) && r.look !== DEFAULT_LOOK ? r.look : undefined,   // an unknown look falls back to the default
  };
  if (!sameShow) { spec.take = DEFAULT_TAKE.take; }   // a locked or unknown show's own text is not carried into another show
  if (sameShow && showId === 'bible') {
    const v = r.verse;
    if (v && typeof v === 'object') {
      if (v.translation === 'custom' && typeof v.text === 'string' && v.text.trim()) spec.verse = typedVerse(v.text, v.ref);
      else { const rec = typeof v.ref === 'string' ? findVerse(v.ref) : undefined; const t = TRANSLATIONS.find(x => x === v.translation) as Translation | undefined; if (rec && t) spec.verse = pickVerse(rec, t); }
    }
    spec.reflection = str(r.reflection, 220) ?? '';
  }
  if (sameShow && showId === 'motivation' && typeof r.quoteId === 'string') {
    const q = findQuote(r.quoteId); if (q) { spec.quote = pickQuote(q); spec.reflection = str(r.reflection, 220) ?? ''; }
  }
  return recomposeBible(spec);
}
