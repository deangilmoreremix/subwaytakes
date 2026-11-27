import { useRef, useState } from 'react';
import { FileDown, FolderOpen } from 'lucide-react';
import { readProjectFile, saveProjectFile } from '../../lib/projects/file';
import type { Project } from '../../lib/timeline/types';

/** Save the episode to a file on your computer, or open one. A backup, and a way to move work between browsers without an account. */
export function ProjectFileCard({ getProject, onOpen, name }: { getProject: () => Project; onOpen: (project: Project, name: string) => void; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setMsg(null);
    try { const done = await saveProjectFile(getProject(), name); if (done) setMsg({ ok: true, text: 'Saved. The file holds the timeline and links to your clips, never your muapi key.' }); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not save the file.' }); }
  }
  async function open(file: File) {
    setMsg(null);
    try {
      const { project, name: n } = await readProjectFile(file);
      const cur = getProject();
      if (cur.clips.length > 0 && !window.confirm('Open this file and replace the episode you are working on? You can undo it with Ctrl+Z.')) return;
      onOpen(project, n);
      setMsg({ ok: true, text: `Opened "${n}".` });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not open that file.' }); }
  }

  return (
    <div data-testid="project-file" className="rounded-xl border border-line bg-ink-950 p-3">
      <p className="text-[12px] font-medium text-zinc-100">Project file</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">Keep a copy on your computer, or open one you saved.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => void save()} data-testid="project-save-file" className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white/5 text-[12px] font-medium text-zinc-200 hover:bg-white/10"><FileDown className="h-3.5 w-3.5" />Save to file</button>
        <button onClick={() => input.current?.click()} data-testid="project-open-file" className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white/5 text-[12px] font-medium text-zinc-200 hover:bg-white/10"><FolderOpen className="h-3.5 w-3.5" />Open file</button>
        <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="Open a project file" data-testid="project-file-input" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void open(f); }} />
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} data-testid="project-file-msg" className={`mt-2 text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-red-300'}`}>{msg.text}</p>}
    </div>
  );
}
