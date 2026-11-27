// What the top bar shows about the current project, shared between the editor (which saves) and the shell (which displays it).
export type SaveStatus = 'local' | 'guest' | 'saving' | 'saved' | 'conflict' | 'error';
export interface ProjectMeta { id: string | null; name: string; status: SaveStatus; savedAt: number | null; message?: string }

let meta: ProjectMeta = { id: null, name: 'Untitled episode', status: 'local', savedAt: null };
const listeners = new Set<() => void>();
const renameListeners = new Set<(name: string) => void>();

export const getProjectMeta = (): ProjectMeta => meta;
export function setProjectMeta(patch: Partial<ProjectMeta>): void { meta = { ...meta, ...patch }; listeners.forEach(l => l()); }
export function subscribeProjectMeta(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
/** The shell asks; the editor (which owns the save) answers. */
export const requestRename = (name: string): void => renameListeners.forEach(l => l(name));
export function onRenameRequest(l: (name: string) => void): () => void { renameListeners.add(l); return () => { renameListeners.delete(l); }; }

export function statusText(m: ProjectMeta): string {
  switch (m.status) {
    case 'saving': return 'Saving…';
    case 'saved': return m.savedAt ? `Saved · ${new Date(m.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Saved';
    case 'conflict': return 'Changed on another device';
    case 'error': return m.message ?? 'Could not save. Retrying…';
    case 'guest': return 'Draft in this browser. Sign up to save it to your account';
    default: return 'Draft in this browser';
  }
}
