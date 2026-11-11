import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PROJECT, type Project } from './types';

const KEY = 'subwaytakes.project.v1';

function load(): Project {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Project;
      if (p && Array.isArray(p.clips) && Array.isArray(p.tracks)) return p;
    }
  } catch { /* unavailable or corrupt: start fresh */ }
  return DEFAULT_PROJECT;
}

/** Project state with undo/redo. `set(next, false)` updates without recording history (use during drags after `checkpoint`). */
export function useProject() {
  const [project, setProject] = useState<Project>(load);
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const latest = useRef(project);
  latest.current = project;

  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(project)); } catch { /* ignore */ } }, 300);
    return () => clearTimeout(t);
  }, [project]);

  const checkpoint = useCallback(() => { past.current.push(latest.current); if (past.current.length > 100) past.current.shift(); future.current = []; }, []);
  const set = useCallback((next: Project, record = true) => { if (record) checkpoint(); setProject(next); }, [checkpoint]);
  const undo = useCallback(() => { const p = past.current.pop(); if (p) { future.current.push(latest.current); setProject(p); } }, []);
  const redo = useCallback(() => { const p = future.current.pop(); if (p) { past.current.push(latest.current); setProject(p); } }, []);
  return { project, set, checkpoint, undo, redo };
}
