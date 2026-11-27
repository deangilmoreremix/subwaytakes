import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard, AlertCircle, Loader2 } from 'lucide-react';
import { listJobs, type ClipJob } from '../lib/muapi/jobs';
import { clsx } from '../lib/format';
import { useAuth } from '../lib/auth';
import { deleteProject, listProjects, type ProjectRow } from '../lib/projects';

const STARTERS = ['Pineapple belongs on pizza', 'Cereal is a soup', 'Subway delays build character', 'Pigeons run this city'];

export function GalleryPage() {
  const [jobs, setJobs] = useState<ClipJob[] | null>(null);
  useEffect(() => { listJobs(100).then(setJobs).catch(() => setJobs([])); }, []);
  const { user, isGuest } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [projectError, setProjectError] = useState('');
  useEffect(() => { if (user && !isGuest) listProjects().then(setProjects).catch(e => { setProjects([]); setProjectError(e instanceof Error ? e.message : 'Could not load projects.'); }); }, [user, isGuest]);
  async function remove(p: ProjectRow) {
    if (!window.confirm(`Delete "${p.name}"? The clips you generated stay in your library; only this edit is removed.`)) return;
    try { await deleteProject(p.id); setProjects(list => (list ?? []).filter(x => x.id !== p.id)); } catch (e) { setProjectError(e instanceof Error ? e.message : 'Could not delete it.'); }
  }
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-5 flex items-end justify-between">
        <div><h1 className="font-display text-2xl font-semibold tracking-tight text-white">Library</h1><p className="text-[13px] text-zinc-500">Everything you've generated</p></div>
        <Link to="/create" className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-br from-accent to-accent-hot px-4 text-[13px] font-semibold text-black"><Clapperboard className="h-4 w-4" />New take</Link>
      </div>
      <section aria-label="Projects" className="mb-8">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-[15px] font-semibold text-white">Projects</h2>
          <Link to="/create?project=new" className="text-[12px] text-accent underline">New episode</Link></div>
        {isGuest && <p className="rounded-xl border border-line bg-ink-850 p-3 text-[12px] text-zinc-400">Projects are saved to your account. <Link to="/login" className="text-accent underline">Create an account</Link> to keep your edits on every device.</p>}
        {projectError && <p role="alert" className="mb-2 text-[12px] text-red-300">{projectError}</p>}
        {projects && projects.length === 0 && !isGuest && <p className="text-[12px] text-zinc-500">No saved projects yet. Your edit is saved automatically once it has a clip.</p>}
        <ul className="divide-y divide-line rounded-xl border border-line bg-ink-850">
          {projects?.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
              <span className="min-w-0"><span className="block truncate text-zinc-100">{p.name}</span><span className="block text-[11px] text-zinc-500">Edited {new Date(p.updated_at).toLocaleString()}</span></span>
              <span className="flex shrink-0 items-center gap-2">
                <Link to={`/create?project=${p.id}`} className="rounded-lg bg-white/5 px-3 py-1.5 text-[12px] text-zinc-100 hover:bg-white/10">Open</Link>
                <button onClick={() => remove(p)} aria-label={`Delete ${p.name}`} className="rounded-lg px-2 py-1.5 text-[12px] text-zinc-500 hover:text-red-300">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {jobs === null && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[...Array(8)].map((_, i) => <div key={i} className="skeleton aspect-[9/16] rounded-2xl" />)}</div>}
      {jobs && jobs.length === 0 && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-ink-950 py-20 text-center">
          <Clapperboard className="mb-3 h-8 w-8 text-zinc-600" />
          <p className="font-display text-lg text-white">No shots yet</p>
          <p className="mb-4 text-[13px] text-zinc-500">Start with a hot take:</p>
          <div className="flex flex-wrap justify-center gap-2">{STARTERS.map(s => <Link key={s} to="/create" className="rounded-full border border-line bg-ink-800 px-3 py-1.5 text-[12px] text-zinc-300 hover:border-accent/50">{s}</Link>)}</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {jobs?.map(j => (
          <Link to="/create" key={j.id} className={clsx('group relative aspect-[9/16] overflow-hidden rounded-2xl border bg-ink-800', j.status === 'failed' ? 'border-red-500/30' : 'border-line hover:border-accent/50')}>
            {j.output_url
              ? <video src={j.output_url} muted loop playsInline preload="metadata" onMouseEnter={e => e.currentTarget.play().catch(() => undefined)} onMouseLeave={e => e.currentTarget.pause()} className="h-full w-full object-cover" />
              : <div className="grid h-full place-items-center p-4 text-center">{j.status === 'failed' ? <div><AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-400" /><p className="text-[11px] text-red-300">{j.error}</p></div> : <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}</div>}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
              <p className="truncate text-[12px] font-medium text-white">{typeof j.input?.take === 'string' ? j.input.take : 'Untitled take'}</p>
              <p className="truncate text-[10px] text-zinc-400">{j.model} · {new Date(j.created_at).toLocaleDateString()}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
