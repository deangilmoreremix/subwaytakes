import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { DEFAULT_PROJECT, type Project } from '../timeline/types';
import { ProjectConflictError, createProject, getRemoteProject, parseRemote, saveProject } from './index';
import { getProjectMeta, onRenameRequest, setProjectMeta } from './store';

const LINK_KEY = 'subwaytakes.cloudProject.v1';
interface Link { id: string; version: number; userId: string }
const AUTOSAVE_MS = 2000;
const RETRY_MS = 15_000;

function readLink(uid: string | null): Link | null {
  try { const l = JSON.parse(localStorage.getItem(LINK_KEY) ?? 'null') as Link | null; return l && l.userId === uid && typeof l.id === 'string' && typeof l.version === 'number' ? l : null; } catch { return null; }
}
function writeLink(l: Link | null): void { try { if (l) localStorage.setItem(LINK_KEY, JSON.stringify(l)); else localStorage.removeItem(LINK_KEY); } catch { /* storage unavailable */ } }

/**
 * Keeps the editor's project in step with the signed-in user's saved copy.
 * The browser copy stays the working draft; the server copy is written after a short pause. Saving is version-checked, so a change
 * made on another device is never overwritten silently: the user chooses between theirs and the other copy.
 * Always reads the newest project with getProject() at save time (a stale copy would drop clips added during a long async loop).
 */
export function useCloudProject({ project, setProject, getProject, openId }: {
  project: Project; setProject: (p: Project, record?: boolean) => void; getProject: () => Project; openId?: string | null;
}) {
  const { user, isGuest } = useAuth();
  const uid = user && !isGuest ? user.id : null;
  const link = useRef<Link | null>(readLink(uid));
  const lastSaved = useRef('');
  const busy = useRef(false);
  const again = useRef(false);
  const conflictRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  // who is signed in decides what the top bar says
  useEffect(() => {
    if (!uid) { link.current = null; setProjectMeta({ id: null, name: 'Untitled episode', status: isGuest ? 'guest' : 'local', savedAt: null }); return; }
    link.current = readLink(uid);
    setProjectMeta({ id: link.current?.id ?? null, status: link.current ? 'saved' : 'local' });
  }, [uid, isGuest]);

  const save = useCallback(async () => {
    if (!uid || conflictRef.current) return;
    if (busy.current) { again.current = true; return; }
    busy.current = true; setProjectMeta({ status: 'saving' });
    try {
      const json = JSON.stringify(getProject());
      const data = JSON.parse(json) as unknown;
      if (!link.current) {
        const r = await createProject(getProjectMeta().name, data);
        link.current = { id: r.id, version: r.version, userId: uid };
      } else {
        link.current = { ...link.current, version: await saveProject(link.current.id, null, data, link.current.version) };
      }
      lastSaved.current = json; writeLink(link.current);
      setProjectMeta({ id: link.current.id, status: 'saved', savedAt: Date.now(), message: undefined });
    } catch (e) {
      if (e instanceof ProjectConflictError) { conflictRef.current = true; setConflict(true); setProjectMeta({ status: 'conflict' }); }
      else {
        setProjectMeta({ status: 'error', message: e instanceof Error ? e.message : undefined });
        if (retry.current) clearTimeout(retry.current);
        retry.current = setTimeout(() => { void save(); }, RETRY_MS);
      }
    } finally {
      busy.current = false;
      if (again.current) { again.current = false; void save(); }
    }
  }, [uid, getProject]);

  // autosave after a pause in editing; the first save happens once there is something worth keeping
  useEffect(() => {
    if (!uid || conflictRef.current) return;
    if (JSON.stringify(project) === lastSaved.current) return;
    if (!link.current && project.clips.length === 0) return;
    const t = setTimeout(() => { void save(); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [project, uid, save]);

  useEffect(() => () => { if (retry.current) clearTimeout(retry.current); }, []);
  useEffect(() => { const on = () => { void save(); }; window.addEventListener('online', on); return () => window.removeEventListener('online', on); }, [save]);

  const adopt = useCallback((id: string, version: number, p: Project, name: string) => {
    link.current = { id, version, userId: uid ?? '' }; writeLink(uid ? link.current : null);
    lastSaved.current = JSON.stringify(p); conflictRef.current = false; setConflict(false);
    setProject(p, false);
    setProjectMeta({ id, name, status: 'saved', savedAt: Date.now(), message: undefined });
  }, [uid, setProject]);

  const openProject = useCallback(async (id: string) => {
    const r = await getRemoteProject(id);
    const p = r ? parseRemote(r.data) : null;
    if (!r || !p) throw new Error('That project could not be opened.');
    adopt(r.id, r.version, p, r.name);
  }, [adopt]);

  const newProject = useCallback(() => {
    link.current = null; writeLink(null); lastSaved.current = ''; conflictRef.current = false; setConflict(false);
    setProject(DEFAULT_PROJECT, false);
    setProjectMeta({ id: null, name: 'Untitled episode', status: uid ? 'local' : isGuest ? 'guest' : 'local', savedAt: null, message: undefined });
  }, [setProject, uid, isGuest]);

  /** Conflict choice 1: take the other copy. */
  const useLatest = useCallback(async () => { if (link.current) await openProject(link.current.id); }, [openProject]);
  /** Conflict choice 2: keep this copy as a new project and leave the other one alone. */
  const keepMine = useCallback(async () => {
    const data = JSON.parse(JSON.stringify(getProject())) as unknown;
    const r = await createProject(`${getProjectMeta().name} (copy)`.slice(0, 80), data);
    adopt(r.id, r.version, getProject(), `${getProjectMeta().name} (copy)`.slice(0, 80));
  }, [adopt, getProject]);

  useEffect(() => onRenameRequest(name => {
    const n = name.trim().slice(0, 80);
    if (!n) return;
    setProjectMeta({ name: n });
    if (uid && link.current && !conflictRef.current) {
      const l = link.current;
      void saveProject(l.id, n, null, l.version).then(v => { link.current = { ...l, version: v }; writeLink(link.current); }).catch(e => { if (e instanceof ProjectConflictError) { conflictRef.current = true; setConflict(true); setProjectMeta({ status: 'conflict' }); } });
    }
  }), [uid]);

  // open a project chosen in the Library (?project=<id>)
  useEffect(() => {
    if (openId === 'new') { newProject(); return; }
    if (uid && openId && /^[0-9a-f-]{36}$/.test(openId)) void openProject(openId).catch(e => setProjectMeta({ status: 'error', message: e instanceof Error ? e.message : undefined }));
  }, [uid, openId, openProject, newProject]);

  return { conflict, useLatest, keepMine, openProject, newProject };
}
