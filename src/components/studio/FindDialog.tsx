import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, X, Shuffle, Check, SearchX } from 'lucide-react';
import { highlight } from '../../lib/search/rank';
import { clsx } from '../../lib/format';

export interface FindItem { id: string; /** reference or author line */ title: string; text: string; /** small tag, for example the theme */ tag: string; hits: string[] }
export interface FindTheme { id: string; label: string; count: number }

/**
 * A full-size "find it" dialog for the verse and quote libraries: type to search (word, reference, author, theme, or what you are going through),
 * filter by theme, move with the arrow keys, press Enter or click to choose. Presentational: the owner holds the query and does the searching.
 */
export function FindDialog({ title, noun, placeholder, examples, items, total, themes, theme, onTheme, query, onQuery, selectedId, onPick, onClose, extra, footnote }: {
  title: string; noun: string; placeholder: string; examples: string[]; items: FindItem[]; total: number; themes: FindTheme[]; theme: string; onTheme: (id: string) => void;
  query: string; onQuery: (q: string) => void; selectedId?: string; onPick: (id: string) => void; onClose: () => void; extra?: ReactNode; footnote?: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const shown = useMemo(() => items.slice(0, 80), [items]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { setActive(0); }, [query, theme, items.length]);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && shown[active]) { e.preventDefault(); onPick(shown[active].id); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title} onKeyDown={key}>
      <div className="flex h-[min(88vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-ink-850 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="font-display text-[15px] font-semibold text-white">{title}</div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input ref={input} value={query} onChange={e => onQuery(e.target.value)} placeholder={placeholder} aria-label={`Search ${noun}s`} data-testid="find-input" autoComplete="off" spellCheck={false}
              className="h-11 w-full rounded-xl border border-line bg-ink-950 pl-10 pr-10 text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/10" />
            {query && <button onClick={() => onQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Themes">
            <button onClick={() => onTheme('all')} aria-pressed={theme === 'all'} className={clsx('rounded-full border px-2.5 py-1 text-[11px]', theme === 'all' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-zinc-400 hover:text-zinc-200')}>All <span className="tnum text-zinc-500">{total}</span></button>
            {themes.map(t => <button key={t.id} onClick={() => onTheme(t.id)} aria-pressed={theme === t.id} className={clsx('rounded-full border px-2.5 py-1 text-[11px]', theme === t.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-zinc-400 hover:text-zinc-200')}>{t.label} <span className="tnum text-zinc-500">{t.count}</span></button>)}
          </div>
          {extra}
        </div>

        <div className="flex items-center justify-between px-4 pt-3 text-[11px] text-zinc-500" aria-live="polite">
          <span data-testid="find-count">{items.length === 0 ? `No ${noun}s found` : `${items.length} ${noun}${items.length === 1 ? '' : 's'}${query ? ' for “' + query + '”' : ''}${items.length > shown.length ? `, showing the best ${shown.length}` : ''}`}</span>
          {items.length > 0 && <button onClick={() => onPick(items[Math.floor(Math.random() * items.length)].id)} className="inline-flex items-center gap-1 text-zinc-400 hover:text-white"><Shuffle className="h-3 w-3" />Surprise me</button>}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4" role="listbox" aria-label={`${noun}s`} data-testid="find-results">
          {items.length === 0 && (
            <div className="grid place-items-center gap-3 py-8 text-center">
              <SearchX className="h-8 w-8 text-zinc-600" />
              <p className="max-w-sm text-[13px] text-zinc-400">Nothing matches that. Try a single word, a {noun === 'verse' ? 'reference like Psalm 23:1' : 'name like Emerson'}, or what you are going through, like one of these:</p>
            </div>
          )}
          {!query && items.length > 0 && examples.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-1 text-[11px] text-zinc-500">Try:{examples.map(x => <button key={x} onClick={() => onQuery(x)} className="rounded-full border border-line px-2.5 py-1 text-zinc-300 hover:border-accent/50 hover:text-white">{x}</button>)}</div>
          )}
          {items.length === 0 && <div className="flex flex-wrap justify-center gap-1.5">{examples.map(x => <button key={x} onClick={() => onQuery(x)} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-zinc-300 hover:border-accent/50 hover:text-white">{x}</button>)}</div>}
          {shown.map((it, i) => {
            const picked = it.id === selectedId;
            return (
              <button key={it.id} ref={i === active ? activeRef : undefined} role="option" aria-selected={picked} data-result={it.id} onClick={() => onPick(it.id)} onMouseEnter={() => setActive(i)}
                className={clsx('block w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors', i === active ? 'border-accent/60 bg-accent-soft/30' : 'border-line bg-ink-950 hover:border-zinc-600', picked && 'ring-1 ring-accent')}>
                <span className="flex items-center justify-between gap-2 text-[12px] font-medium text-accent">
                  <span className="truncate">{highlight(it.title, it.hits).map((p, k) => p.match ? <mark key={k} className="rounded bg-accent/25 px-0.5 text-accent">{p.t}</mark> : <span key={k}>{p.t}</span>)}</span>
                  <span className="flex shrink-0 items-center gap-2"><span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-normal text-zinc-500">{it.tag}</span>{picked && <Check className="h-3.5 w-3.5" />}</span>
                </span>
                <span className="mt-1 block text-[13.5px] leading-snug text-zinc-200">{highlight(it.text, it.hits).map((p, k) => p.match ? <mark key={k} className="rounded bg-accent/25 px-0.5 text-white">{p.t}</mark> : <span key={k}>{p.t}</span>)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[11px] text-zinc-600">
          <span><kbd className="rounded border border-line px-1">↑</kbd> <kbd className="rounded border border-line px-1">↓</kbd> to move, <kbd className="rounded border border-line px-1">Enter</kbd> to choose, <kbd className="rounded border border-line px-1">Esc</kbd> to close</span>
          {footnote}
        </div>
      </div>
    </div>
  );
}
