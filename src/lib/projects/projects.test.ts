import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { ProjectConflictError, parseRemote, projectError } from './index';
import { statusText, type ProjectMeta } from './store';
import { DEFAULT_PROJECT } from '../timeline/types';

describe('projectError', () => {
  it('turns database codes into messages a person can act on', () => {
    expect(projectError({ message: 'version_conflict' })).toBeInstanceOf(ProjectConflictError);
    expect(projectError({ message: 'project_limit' }).message).toMatch(/50 saved projects/);
    expect(projectError({ message: 'violates check constraint "projects_data_check"' }).message).toMatch(/too large/);
    expect(projectError({ message: 'not_found' }).message).toMatch(/no longer exists/);
    expect(projectError({ message: 'not_authenticated' }).message).toMatch(/Sign in/);
  });
  it('never leaks raw database text for anything else, and reassures that the work is safe', () => {
    const e = projectError({ message: 'FATAL: password authentication failed for user "postgres"' });
    expect(e.message).not.toMatch(/FATAL|postgres/); expect(e.message).toMatch(/safe in this browser/);
    expect(projectError(null).message).toMatch(/safe in this browser/);
  });
});

describe('parseRemote', () => {
  it('accepts a saved project and fills in anything an older version lacked', () => {
    const p = parseRemote(JSON.parse(JSON.stringify(DEFAULT_PROJECT)));
    expect(p).not.toBeNull(); expect(p!.tracks.length).toBeGreaterThan(0);
  });
  it('rejects things that are not projects', () => {
    for (const bad of [null, undefined, 'x', 5, [], {}, { clips: [], tracks: [] }, { clips: 'no', tracks: [], fps: 30 }, { clips: [], tracks: {}, fps: 30 }]) expect(parseRemote(bad)).toBeNull();
  });
});

describe('statusText', () => {
  const base: ProjectMeta = { id: null, name: 'x', status: 'local', savedAt: null };
  it('says plainly where the work lives', () => {
    expect(statusText(base)).toBe('Draft in this browser');
    expect(statusText({ ...base, status: 'guest' })).toMatch(/Sign up to save/);
    expect(statusText({ ...base, status: 'saving' })).toBe('Saving…');
    expect(statusText({ ...base, status: 'saved', savedAt: Date.now() })).toMatch(/^Saved · /);
    expect(statusText({ ...base, status: 'conflict' })).toMatch(/another device/);
    expect(statusText({ ...base, status: 'error', message: 'Offline' })).toBe('Offline');
  });
});
