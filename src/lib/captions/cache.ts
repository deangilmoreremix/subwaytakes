import type { Clip } from '../timeline/types';
import type { CaptionStyle } from './model';
import type { TimedWord } from './words';

// Two small local stores: finished transcripts (so re-opening a clip never transcribes it twice) and the last few caption versions per project
// (so an earlier look or edit can be restored). Storage is injected so the logic is testable and never throws if storage is blocked.

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
const browserKv = (): KV | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

const TKEY = 'subwaytakes.transcripts.v1';
const MAX_TRANSCRIPTS = 12;
export interface CachedTranscript { key: string; at: number; words: TimedWord[]; wordTimed: boolean; engine: string }

/** What makes two transcriptions interchangeable: same media, engine, model and language. */
export const transcriptKey = (src: string, engine: string, model: string, language: string): string => `${src.split('?')[0]}|${engine}|${model}|${language}`;

function readAll<T>(kv: KV | null, key: string): T[] { try { const raw = kv?.getItem(key); const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; } catch { return []; } }
function writeAll(kv: KV | null, key: string, v: unknown[], keep: number) {
  if (!kv) return; let list = v.slice(0, keep);
  for (let i = 0; i < 4; i++) { try { kv.setItem(key, JSON.stringify(list)); return; } catch { list = list.slice(0, Math.max(1, Math.floor(list.length / 2))); } }   // quota: keep fewer
}

export function getCachedTranscript(key: string, kv: KV | null = browserKv()): CachedTranscript | null { return readAll<CachedTranscript>(kv, TKEY).find(t => t.key === key) ?? null; }
export function putCachedTranscript(t: Omit<CachedTranscript, 'at'>, now = Date.now(), kv: KV | null = browserKv()): void {
  const rest = readAll<CachedTranscript>(kv, TKEY).filter(x => x.key !== t.key);
  writeAll(kv, TKEY, [{ ...t, at: now }, ...rest], MAX_TRANSCRIPTS);
}

const VKEY = 'subwaytakes.captionVersions.v1';
export const MAX_VERSIONS = 5;
export interface CaptionVersion { id: string; at: number; label: string; clips: Clip[]; style: CaptionStyle }
/** Newest first, last 5 per project. */
export function listVersions(projectKey: string, kv: KV | null = browserKv()): CaptionVersion[] { return readAll<{ project: string; v: CaptionVersion }>(kv, VKEY).filter(x => x.project === projectKey).map(x => x.v).slice(0, MAX_VERSIONS); }
export function saveVersion(projectKey: string, v: CaptionVersion, kv: KV | null = browserKv()): void {
  const all = readAll<{ project: string; v: CaptionVersion }>(kv, VKEY);
  const mine = [{ project: projectKey, v }, ...all.filter(x => x.project === projectKey)].slice(0, MAX_VERSIONS);
  const others = all.filter(x => x.project !== projectKey);
  writeAll(kv, VKEY, [...mine, ...others], 15);
}
