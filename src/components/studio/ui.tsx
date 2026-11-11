import type { ReactNode } from 'react';
import { clsx } from '../../lib/format';

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void;
  options: Array<{ value: T; label: string; disabled?: boolean; hint?: string }>;
}) {
  return (
    <div className="grid gap-1 rounded-xl bg-ink-950 p-1 border border-line" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(o => (
        <button key={o.value} disabled={o.disabled} onClick={() => onChange(o.value)} title={o.hint}
          className={clsx('h-8 rounded-lg text-[12px] font-medium transition-colors',
            o.value === value ? 'bg-ink-600 text-white shadow-panel' : 'text-zinc-500 hover:text-zinc-200',
            o.disabled && 'opacity-40 cursor-not-allowed hover:text-zinc-500')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{children}</span>
      {hint && <span className="text-[11px] text-zinc-600 tnum">{hint}</span>}
    </div>
  );
}

export const inputCls = 'w-full rounded-xl bg-ink-950 border border-line px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/10 transition';

const TIER_STYLE: Record<string, string> = {
  best: 'text-fuchsia-300 bg-fuchsia-500/10',
  balanced: 'text-sky-300 bg-sky-500/10',
  fast: 'text-emerald-300 bg-emerald-500/10',
  budget: 'text-zinc-300 bg-white/5',
};

export function ModelChip({ label, tier, audio, active, onClick }: { label: string; tier: string; audio?: boolean; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={clsx('group flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition',
        active ? 'border-accent/60 bg-accent-soft shadow-glow' : 'border-line bg-ink-850 hover:border-white/15 hover:bg-ink-800')}>
      <span className="min-w-0">
        <span className={clsx('block truncate text-[13px] font-medium', active ? 'text-white' : 'text-zinc-200')}>{label}</span>
        {audio && <span className="text-[10px] text-zinc-500">native audio</span>}
      </span>
      <span className={clsx('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', TIER_STYLE[tier])}>{tier}</span>
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">{children}</kbd>;
}
