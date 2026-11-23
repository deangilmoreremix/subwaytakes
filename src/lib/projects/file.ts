/**
 * Project files: save an episode to a file on your computer and open it again (a backup, and a way to move work between browsers without an account).
 * The file is plain JSON. It holds the timeline only (clips are links to hosted media, never the media itself) and NEVER the muapi key.
 * Pure helpers here; the browser pieces (file pickers, download) are at the bottom.
 */
import { ensureTracks, type Project } from '../timeline/types';
import { normalizeCrop } from '../timeline/crop';
import { normalizePollResults } from '../poll';
import { normalizeCityTag } from '../tour';

export const FILE_APP = 'subwaytakes';
export const FILE_VERSION = 1;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FILE_EXT = '.subwaytakes.json';

export interface ProjectFile { app: typeof FILE_APP; fileVersion: number; savedAt: string; name: string; project: Project }

/** A safe file name from the project name: letters, digits, dashes. */
export function suggestedFileName(name: string): string {
  const base = name.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60).replace(/^-+|-+$/g, '');
  return `${base || 'episode'}${FILE_EXT}`;
}

export function serializeProjectFile(project: Project, name: string, now = new Date()): string {
  const file: ProjectFile = { app: FILE_APP, fileVersion: FILE_VERSION, savedAt: now.toISOString(), name: name.slice(0, 80) || 'Untitled episode', project };
  return JSON.stringify(file, null, 1);
}

export type ParsedFile = { ok: true; name: string; project: Project } | { ok: false; reason: string };

/** Check a file's text before the editor sees it. Never throws. */
export function parseProjectFile(text: string): ParsedFile {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'That file is empty.' };
  if (text.length > MAX_FILE_BYTES) return { ok: false, reason: 'That file is too big to be a SubwayTakes project.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, reason: 'That file is not a SubwayTakes project (it is not valid JSON).' }; }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'That file is not a SubwayTakes project.' };
  const f = raw as Partial<ProjectFile>;
  if (f.app !== FILE_APP) return { ok: false, reason: 'That file was not made by SubwayTakes Studio.' };
  if (typeof f.fileVersion !== 'number' || f.fileVersion > FILE_VERSION) return { ok: false, reason: 'That file was made by a newer version of the app. Update the app and try again.' };
  const p = f.project as Partial<Project> | undefined;
  if (!p || typeof p !== 'object' || !Array.isArray(p.clips) || !Array.isArray(p.tracks) || typeof p.fps !== 'number' || !(p.fps > 0 && p.fps <= 120)) return { ok: false, reason: 'That project file is damaged or incomplete.' };
  // only plain https media links may come in from a file (no javascript:, file:, data: or blob: URLs)
  for (const c of p.clips) {
    const src = (c as { src?: unknown }).src;
    if (src !== undefined && src !== null && src !== '' && !(typeof src === 'string' && /^https:\/\//i.test(src))) return { ok: false, reason: 'That project refers to media that is not a hosted https link, so it was not opened.' };
  }
  // a poll results card is re-validated too; one that is not valid is dropped rather than drawn from junk
  p.clips = p.clips.filter(c => {
    const e = (c as { effect?: { type?: string } }).effect;
    if (!e || (e.type !== 'poll-results' && e.type !== 'city-card')) return true;
    const ok = e.type === 'poll-results' ? normalizePollResults(e) : normalizeCityTag(e);
    if (ok) (c as { effect?: unknown }).effect = ok;
    return !!ok;
  });
  // a crop that comes from a file is re-validated (zoom and focal point clamped) like everything else
  for (const c of p.clips) { const cc = c as { crop?: unknown }; if ('crop' in cc) { const n = normalizeCrop(cc.crop); if (n) cc.crop = n; else delete cc.crop; } }
  const name = typeof f.name === 'string' && f.name.trim() ? f.name.trim().slice(0, 80) : 'Opened episode';
  return { ok: true, name, project: ensureTracks(p as Project) };
}

// ---------------------------------------------------------------- browser pieces

type PickerWindow = Window & {
  showSaveFilePicker?: (o: object) => Promise<{ createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }> }>;
  showOpenFilePicker?: (o: object) => Promise<Array<{ getFile: () => Promise<File> }>>;
};
export const canPickFiles = (): boolean => typeof window !== 'undefined' && typeof (window as PickerWindow).showSaveFilePicker === 'function';

/** Save to a file: the native "save as" where the browser has one, a download everywhere else. Returns false when the person cancelled. */
export async function saveProjectFile(project: Project, name: string): Promise<boolean> {
  const text = serializeProjectFile(project, name);
  const fileName = suggestedFileName(name);
  const w = window as PickerWindow;
  if (w.showSaveFilePicker) {
    try {
      const h = await w.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'SubwayTakes project', accept: { 'application/json': ['.json'] } }] });
      const s = await h.createWritable(); await s.write(text); await s.close();
      return true;
    } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return false; /* fall through to a download */ }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Read a file the person chose (native picker or a file input). Throws a readable Error when it is not usable. */
export async function readProjectFile(file: File): Promise<{ name: string; project: Project }> {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is too big to be a SubwayTakes project.');
  const parsed = parseProjectFile(await file.text());
  if (!parsed.ok) throw new Error(parsed.reason);
  return { name: parsed.name, project: parsed.project };
}
