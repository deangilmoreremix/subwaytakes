import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { THEMES, THEME_LABELS, TRANSLATIONS, TRANSLATION_NAMES, TRANSLATION_LICENCE, MAX_TYPED_VERSE, allVerses, pickVerse, searchVersesRanked, textOf, typedVerse, type PickedVerse, type Translation } from '../../lib/bible';
import { FindDialog, type FindItem } from './FindDialog';
import { Label, inputCls } from './ui';
import { clsx } from '../../lib/format';

const EXAMPLES = ['strength', 'scared', "can't sleep", 'new beginnings', 'John 3:16', 'forgive'];

/** Choose a verse: a card showing the current pick, a button that opens the full-size search, or type your own. The picked verse appears on screen exactly as shown. */
export function VersePicker({ verse, onVerse }: { verse?: PickedVerse; onVerse: (v: PickedVerse | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<string>('all');
  const [translation, setTranslation] = useState<Translation>(verse?.translation === 'WEB' || verse?.translation === 'BSB' ? verse.translation : 'KJV');
  const [typed, setTyped] = useState(verse?.source === 'typed');
  const [typedText, setTypedText] = useState(verse?.source === 'typed' ? verse.text : '');
  const [typedRef, setTypedRef] = useState(verse?.source === 'typed' ? verse.ref : '');

  // the picker follows the episode: when the verse changes from outside (undo, a reopened project, a template) the mode, translation and typed text follow it
  useEffect(() => {
    if (verse?.source === 'typed') { setTyped(true); if (typedVerse(typedText, typedRef).text !== verse.text) setTypedText(verse.text); if (typedVerse('x', typedRef).ref !== verse.ref) setTypedRef(verse.ref); }
    else if (verse?.source === 'library') { setTyped(false); if (verse.translation !== 'custom') setTranslation(verse.translation); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verse]);
  const toggleTyped = () => { const next = !typed; setTyped(next); onVerse(next && typedText.trim() ? typedVerse(typedText, typedRef) : undefined); };   // switching mode never leaves a hidden verse on the video
  const ranked = useMemo(() => searchVersesRanked({ query, theme: theme as never, translation }), [query, theme, translation]);
  const items: FindItem[] = useMemo(() => ranked.map(r => ({ id: r.item.ref, title: r.item.ref, text: textOf(r.item, translation), tag: THEME_LABELS[r.item.theme], hits: r.hits })), [ranked, translation]);
  const themes = useMemo(() => THEMES.map(t => ({ id: t, label: THEME_LABELS[t], count: allVerses().filter(v => v.theme === t).length })), []);
  const choose = (ref: string) => { const v = allVerses().find(x => x.ref === ref); if (v) { onVerse(pickVerse(v, translation)); setTyped(false); setOpen(false); } };
  const changeTranslation = (t: Translation) => { setTranslation(t); if (verse?.source === 'library') { const v = allVerses().find(x => x.ref === verse.ref); if (v) onVerse(pickVerse(v, t)); } };

  return (
    <div className="space-y-2.5" data-testid="verse-picker">
      <Label hint={<span className="flex items-center gap-1 text-zinc-500"><BookOpen className="h-3 w-3" />public domain</span>}>Verse</Label>
      <div className="flex gap-1" role="group" aria-label="Translation">
        {TRANSLATIONS.map(t => (
          <button key={t} onClick={() => changeTranslation(t)} aria-pressed={translation === t && !typed} title={TRANSLATION_NAMES[t]}
            className={clsx('rounded-lg border px-2.5 py-1 text-[12px]', translation === t && !typed ? 'border-accent/60 bg-accent-soft text-white' : 'border-line text-zinc-400 hover:text-zinc-200')}>{t}</button>
        ))}
        <button onClick={toggleTyped} aria-pressed={typed} className={clsx('ml-auto rounded-lg border px-2.5 py-1 text-[12px]', typed ? 'border-accent/60 bg-accent-soft text-white' : 'border-line text-zinc-400 hover:text-zinc-200')}>Type my own</button>
      </div>

      {!typed ? (<>
        {verse && verse.source === 'library' && (
          <div className="relative rounded-xl border border-accent/40 bg-accent-soft/20 p-3" data-testid="picked-verse">
            <button onClick={() => onVerse(undefined)} aria-label="Remove verse" className="absolute right-2 top-2 text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            <p className="text-[11px] font-medium text-accent">{verse.ref} · {verse.translation}</p>
            <p className="mt-1 text-[13px] leading-snug text-zinc-100">“{verse.text}”</p>
          </div>
        )}
        <button onClick={() => setOpen(true)} data-testid="find-verse" className="flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-ink-950 px-3 text-left text-[13px] text-zinc-400 hover:border-accent/50 hover:text-zinc-200">
          <Search className="h-4 w-4 shrink-0" />{verse?.source === 'library' ? 'Find a different verse' : 'Find a verse: search by word, reference or what you need'}
        </button>
      </>) : (
        <div className="space-y-2">
          <input className={inputCls} placeholder="Reference (for example Psalm 23:1)" maxLength={40} value={typedRef} onChange={e => { setTypedRef(e.target.value); onVerse(typedText.trim() ? typedVerse(typedText, e.target.value) : undefined); }} aria-label="Verse reference" />
          <textarea className={inputCls} rows={3} maxLength={MAX_TYPED_VERSE} placeholder="Type the verse exactly as you want it shown" value={typedText} onChange={e => { setTypedText(e.target.value); onVerse(e.target.value.trim() ? typedVerse(e.target.value, typedRef) : undefined); }} aria-label="Verse text" />
          <p className="text-[11px] text-zinc-600">Shown as you type it and labelled "your text". Check that your translation allows this use. We do not verify it.</p>
        </div>
      )}
      {verse && <p className="text-[11px] text-zinc-500">On screen: <b className="text-zinc-300">{verse.ref}</b> ({verse.translation === 'custom' ? 'your text' : verse.translation}){verse.source === 'library' ? ', word for word from the library.' : '.'}{verse.translation !== 'custom' && <span className="block text-zinc-600">{TRANSLATION_LICENCE[verse.translation]}</span>}</p>}

      {open && (
        <FindDialog title="Find a verse" noun="verse" placeholder="Try: strength, John 3:16, I'm scared, can't sleep…" examples={EXAMPLES} items={items} total={allVerses().length} themes={themes} theme={theme} onTheme={setTheme}
          query={query} onQuery={setQuery} selectedId={verse?.source === 'library' ? verse.ref : undefined} onPick={choose} onClose={() => setOpen(false)}
          extra={<div className="flex items-center gap-1.5 text-[11px] text-zinc-500" role="group" aria-label="Translation in search">Show text in:{TRANSLATIONS.map(t => <button key={t} onClick={() => setTranslation(t)} aria-pressed={translation === t} title={TRANSLATION_NAMES[t]} className={clsx('rounded-lg border px-2 py-0.5', translation === t ? 'border-accent text-accent' : 'border-line text-zinc-400 hover:text-zinc-200')}>{t}</button>)}</div>}
          footnote={<span>{TRANSLATION_LICENCE[translation]}</span>} />
      )}
    </div>
  );
}
