import { useMemo, useState } from 'react';
import { Quote, Search, X } from 'lucide-react';
import { QUOTE_THEMES, QUOTE_THEME_LABELS, allQuotes, attribution, findQuote, pickQuote, searchQuotesRanked, type PickedQuote } from '../../lib/quotes';
import { FindDialog, type FindItem } from './FindDialog';
import { Label } from './ui';

const EXAMPLES = ['I want to quit', 'calm', 'courage', 'Emerson', 'dreams', 'work'];

/** Optional: share a real quote. Every quote is a sentence found word for word in a public-domain book, with its author and work. Without one, the guest gives their own advice. */
export function QuotePicker({ quote, onQuote }: { quote?: PickedQuote; onQuote: (q: PickedQuote | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<string>('all');
  const ranked = useMemo(() => searchQuotesRanked({ query, theme: theme as never }), [query, theme]);
  const items: FindItem[] = useMemo(() => ranked.map(r => ({ id: r.item.id, title: attribution(r.item), text: r.item.text, tag: QUOTE_THEME_LABELS[r.item.theme], hits: r.hits })), [ranked]);
  const themes = useMemo(() => QUOTE_THEMES.map(t => ({ id: t, label: QUOTE_THEME_LABELS[t], count: allQuotes().filter(q => q.theme === t).length })), []);
  const choose = (id: string) => { const q = findQuote(id); if (q) { onQuote(pickQuote(q)); setOpen(false); } };
  return (
    <div className="space-y-2.5" data-testid="quote-picker">
      <Label hint={<span className="flex items-center gap-1 text-zinc-500"><Quote className="h-3 w-3" />from public-domain books</span>}>Quote (optional)</Label>
      {quote && (
        <div className="relative rounded-xl border border-accent/40 bg-accent-soft/20 p-3" data-testid="picked-quote">
          <button onClick={() => onQuote(undefined)} aria-label="Remove quote" className="absolute right-2 top-2 text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          <p className="text-[13px] leading-snug text-zinc-100">“{quote.text}”</p>
          <p className="mt-1 text-[11px] font-medium text-accent">{attribution(quote)}</p>
        </div>
      )}
      <button onClick={() => setOpen(true)} data-testid="find-quote" className="flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-ink-950 px-3 text-left text-[13px] text-zinc-400 hover:border-accent/50 hover:text-zinc-200">
        <Search className="h-4 w-4 shrink-0" />{quote ? 'Find a different quote' : 'Find a quote: search by word, author or what you need'}
      </button>
      <p className="text-[11px] text-zinc-600">Quotes are word for word from the book, never reworded. Or skip this and write your own advice below.</p>
      {open && (
        <FindDialog title="Find a quote" noun="quote" placeholder="Try: I want to quit, calm, Emerson, dreams…" examples={EXAMPLES} items={items} total={allQuotes().length} themes={themes} theme={theme} onTheme={setTheme}
          query={query} onQuery={setQuery} selectedId={quote?.id} onPick={choose} onClose={() => setOpen(false)}
          footnote={<span>Public-domain books on Project Gutenberg.</span>} />
      )}
    </div>
  );
}
