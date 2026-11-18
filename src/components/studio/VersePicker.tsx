import { useMemo, useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { THEMES, THEME_LABELS, TRANSLATIONS, TRANSLATION_NAMES, TRANSLATION_LICENCE, MAX_TYPED_VERSE, pickVerse, searchVerses, textOf, typedVerse, type PickedVerse, type Translation, type VerseTheme } from '../../lib/bible';
import { Label, inputCls } from './ui';
import { clsx } from '../../lib/format';

/** Pick a verse from the verified public-domain library (KJV or WEB), or type your own. The picked verse appears on screen exactly as it is here. */
export function VersePicker({ verse, onVerse }: { verse?: PickedVerse; onVerse: (v: PickedVerse | undefined) => void }) {
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<VerseTheme | 'all'>('all');
  const [translation, setTranslation] = useState<Translation>(verse?.translation === 'WEB' || verse?.translation === 'BSB' ? verse.translation : 'KJV');
  const [typed, setTyped] = useState(verse?.source === 'typed');
  const [typedText, setTypedText] = useState(verse?.source === 'typed' ? verse.text : '');
  const [typedRef, setTypedRef] = useState(verse?.source === 'typed' ? verse.ref : '');
  const results = useMemo(() => searchVerses({ query, theme, translation }).slice(0, 60), [query, theme, translation]);

  return (
    <div className="space-y-2.5" data-testid="verse-picker">
      <Label hint={<span className="flex items-center gap-1 text-zinc-500"><BookOpen className="h-3 w-3" />public domain</span>}>Verse</Label>
      <div className="flex gap-1" role="group" aria-label="Translation">
        {TRANSLATIONS.map(t => (
          <button key={t} onClick={() => { setTranslation(t); if (verse?.source === 'library') { const hit = searchVerses({ query: verse.ref, translation: t })[0]; if (hit) onVerse(pickVerse(hit, t)); } }} aria-pressed={translation === t} title={TRANSLATION_NAMES[t]}
            className={clsx('rounded-lg border px-2.5 py-1 text-[12px]', translation === t && !typed ? 'border-accent/60 bg-accent-soft text-white' : 'border-line text-zinc-400 hover:text-zinc-200')}>{t}</button>
        ))}
        <button onClick={() => setTyped(v => !v)} aria-pressed={typed} className={clsx('ml-auto rounded-lg border px-2.5 py-1 text-[12px]', typed ? 'border-accent/60 bg-accent-soft text-white' : 'border-line text-zinc-400 hover:text-zinc-200')}>Type my own</button>
      </div>

      {!typed ? (<>
        <input className={inputCls} placeholder="Search by reference (John 3:16) or a word (strength)" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search verses" />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Themes">
          {(['all', ...THEMES] as const).map(t => <button key={t} onClick={() => setTheme(t)} aria-pressed={theme === t} className={clsx('rounded-full border px-2 py-0.5 text-[11px]', theme === t ? 'border-accent text-accent' : 'border-line text-zinc-500 hover:text-zinc-300')}>{t === 'all' ? 'All' : THEME_LABELS[t]}</button>)}
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="Verses">
          {results.length === 0 && <p className="p-2 text-[12px] text-zinc-500">No verse matches. Try a reference like Psalm 23:1, or type your own.</p>}
          {results.map(v => {
            const picked = verse?.source === 'library' && verse.ref === v.ref;
            const text = textOf(v, translation);
            return (
              <button key={v.ref} role="option" aria-selected={picked} data-verse={v.ref} onClick={() => onVerse(pickVerse(v, translation))}
                className={clsx('block w-full rounded-lg border px-2.5 py-1.5 text-left', picked ? 'border-accent bg-accent-soft/40' : 'border-line bg-ink-950 hover:border-zinc-600')}>
                <span className="flex items-center justify-between text-[11px] font-medium text-accent">{v.ref}{picked && <Check className="h-3 w-3" />}</span>
                <span className="line-clamp-2 text-[12px] text-zinc-300">{text}</span>
              </button>
            );
          })}
        </div>
      </>) : (
        <div className="space-y-2">
          <input className={inputCls} placeholder="Reference (for example Psalm 23:1)" maxLength={40} value={typedRef} onChange={e => { setTypedRef(e.target.value); onVerse(typedText.trim() ? typedVerse(typedText, e.target.value) : undefined); }} aria-label="Verse reference" />
          <textarea className={inputCls} rows={3} maxLength={MAX_TYPED_VERSE} placeholder="Type the verse exactly as you want it shown" value={typedText} onChange={e => { setTypedText(e.target.value); onVerse(e.target.value.trim() ? typedVerse(e.target.value, typedRef) : undefined); }} aria-label="Verse text" />
          <p className="text-[11px] text-zinc-600">Shown as you type it and labelled "your text". Check that your translation allows this use. We do not verify it.</p>
        </div>
      )}
      {verse && <p className="text-[11px] text-zinc-500">On screen: <b className="text-zinc-300">{verse.ref}</b> ({verse.translation === 'custom' ? 'your text' : verse.translation}){verse.source === 'library' ? ', word for word from the library.' : '.'}{verse.translation !== 'custom' && <span className="block text-zinc-600">{TRANSLATION_LICENCE[verse.translation]}</span>}</p>}
    </div>
  );
}
