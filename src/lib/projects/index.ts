import { supabase } from '../supabase';
import { ensureTracks, type Project } from '../timeline/types';

/** The stored copy moved on (another tab or device saved first). Nothing was overwritten. */
export class ProjectConflictError extends Error { constructor() { super('This project was changed somewhere else.'); this.name = 'ProjectConflictError'; } }

export interface ProjectRow { id: string; name: string; version: number; updated_at: string }
export interface RemoteProject extends ProjectRow { data: unknown }

/** Turn a database error into something a person can act on. */
export function projectError(e: { message?: string } | null | undefined): Error {
  const m = e?.message ?? '';
  if (m.includes('version_conflict')) return new ProjectConflictError();
  if (m.includes('project_limit')) return new Error('You have 50 saved projects. Delete one to save a new one.');
  if (m.includes('check')) return new Error('This project is too large to save. Remove some clips and try again.');
  if (m.includes('not_found')) return new Error('That project no longer exists.');
  if (m.includes('not_authenticated')) return new Error('Sign in to save projects.');
  return new Error('Could not reach your saved projects. Your work is still safe in this browser.');
}

/** A project from the server, checked before the editor sees it. Returns null when it is not a usable project. */
export function parseRemote(data: unknown): Project | null {
  if (!data || typeof data !== 'object') return null;
  const p = data as Partial<Project>;
  if (!Array.isArray(p.clips) || !Array.isArray(p.tracks) || typeof p.fps !== 'number') return null;
  return ensureTracks(p as Project);
}

export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase.from('projects').select('id, name, version, updated_at').order('updated_at', { ascending: false }).limit(50);
  if (error) throw projectError(error);
  return (data ?? []) as ProjectRow[];
}

export async function getRemoteProject(id: string): Promise<RemoteProject | null> {
  const { data, error } = await supabase.from('projects').select('id, name, version, updated_at, data').eq('id', id).maybeSingle();
  if (error) throw projectError(error);
  return (data as RemoteProject | null) ?? null;
}

export async function createProject(name: string, data: unknown): Promise<{ id: string; version: number }> {
  const { data: rows, error } = await supabase.rpc('project_create', { p_name: name, p_data: data });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (error || !row) throw projectError(error ?? { message: 'failed' });
  return { id: String((row as { id: string }).id), version: Number((row as { version: number }).version) };
}

/** Save based on the version you last saw. Pass name or data as null to keep the stored one. */
export async function saveProject(id: string, name: string | null, data: unknown | null, expectedVersion: number): Promise<number> {
  const { data: v, error } = await supabase.rpc('project_save', { p_id: id, p_name: name, p_data: data, p_expected: expectedVersion });
  if (error || typeof v !== 'number') throw projectError(error ?? { message: 'failed' });
  return v;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw projectError(error);
}
