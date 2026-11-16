import type { ComponentType, ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Clapperboard, Users, Repeat2, LayoutGrid, Settings, Wallet, Film } from 'lucide-react';
import { clsx } from '../../lib/format';
import { useAuth } from '../../lib/auth';
import { creditLevel } from '../../lib/credits';
import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { getProjectMeta, requestRename, statusText, subscribeProjectMeta } from '../../lib/projects/store';

interface Item { to: string; label: string; icon: ComponentType<{ className?: string }>; soon?: string }
const ITEMS: Item[] = [
  { to: '/create', label: 'Create', icon: Clapperboard },
  { to: '/cast', label: 'Cast', icon: Users },
  { to: '/recast', label: 'Recast', icon: Repeat2 },
  { to: '/library', label: 'Library', icon: LayoutGrid },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Rail() {
  const nav = useNavigate();
  return (
    <aside className="hidden md:flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-ink-950 py-3">
      <button onClick={() => nav('/create')} className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-hot text-black shadow-glow" aria-label="SubwayTakes">
        <Film className="h-5 w-5" />
      </button>
      {ITEMS.map(it => {
        const Icon = it.icon;
        if (it.soon) return (
          <button key={it.to} disabled title={it.soon} className="group relative flex w-14 flex-col items-center gap-1 rounded-xl py-2 text-zinc-700 cursor-not-allowed">
            <Icon className="h-[18px] w-[18px]" /><span className="text-[10px] font-medium">{it.label}</span>
            <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-zinc-700" />
          </button>
        );
        return (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => clsx('flex w-14 flex-col items-center gap-1 rounded-xl py-2 transition', isActive ? 'bg-accent-soft text-accent' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200')}>
            <Icon className="h-[18px] w-[18px]" /><span className="text-[10px] font-medium">{it.label}</span>
          </NavLink>
        );
      })}
    </aside>
  );
}

function TabBar() {
  return (
    <nav className="md:hidden grid grid-cols-5 border-t border-line bg-ink-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      {ITEMS.filter(i => !i.soon).map(it => {
        const Icon = it.icon;
        return (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => clsx('flex flex-col items-center gap-1 py-2.5', isActive ? 'text-accent' : 'text-zinc-500')}>
            <Icon className="h-5 w-5" /><span className="text-[10px] font-medium">{it.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function StudioShell({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const nav = useNavigate();
  const credits = profile?.credits_balance ?? 0;
  const level = profile ? creditLevel(profile.credits_balance) : 'unknown';
  const meta = useSyncExternalStore(subscribeProjectMeta, getProjectMeta);
  const [editing, setEditing] = useState(false);
  const initial = profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';
  return (
    <div className="flex h-full bg-ink-900 text-zinc-200">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ink-900/80 px-4 backdrop-blur">
          <div className="md:hidden grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-hot text-black"><Film className="h-4 w-4" /></div>
          <div className="min-w-0">
            {editing ? (
              <input autoFocus aria-label="Project name" defaultValue={meta.name} maxLength={80} className="w-56 rounded-md bg-ink-800 px-2 py-0.5 font-display text-[15px] font-semibold text-white outline-none ring-1 ring-accent/50"
                onBlur={e => { requestRename(e.currentTarget.value); setEditing(false); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }} />
            ) : (
              <button onClick={() => setEditing(true)} title="Rename" data-testid="project-name" className="block max-w-[220px] truncate text-left font-display text-[15px] font-semibold tracking-tight text-white hover:text-accent">{meta.name}</button>
            )}
            <div className="hidden sm:block text-[11px] text-zinc-500" data-testid="save-status">{statusText(meta)}{meta.status === 'guest' && <> · <Link to="/login" className="text-accent underline">Sign up</Link></>}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => nav('/settings')} aria-label="Credits" title="Your credits" className={clsx('flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium tnum transition',
              !profile ? 'border-line bg-ink-800 text-zinc-500' : level === 'ok' ? 'border-line bg-ink-800 text-zinc-200 hover:border-white/15' : level === 'low' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-accent/40 bg-accent-soft text-accent')}>
              <Wallet className="h-3.5 w-3.5" />
              {!profile ? '…' : <><span data-testid="credit-pill">{credits.toLocaleString('en-US')} credits</span>{(level === 'low' || level === 'empty') && <span data-testid="credit-nudge" className="hidden text-[11px] font-semibold sm:inline">· {level === 'empty' ? 'Get credits' : 'Top up'}</span>}</>}
            </button>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-[12px] font-semibold text-zinc-200 ring-1 ring-white/10">{initial}</div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <TabBar />
      </div>
    </div>
  );
}
