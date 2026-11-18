import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { dictationSupported, startDictation, type Dictation } from '../../lib/captions/engines/webSpeech';

/** Speak your take instead of typing it (browser speech recognition). Hidden where the browser has none. Some browsers send the audio to the vendor's service. */
export function DictateButton({ value, onChange, lang = 'auto', max = 220 }: { value: string; onChange: (v: string) => void; lang?: string; max?: number }) {
  const [on, setOn] = useState(false); const [msg, setMsg] = useState('');
  const handle = useRef<Dictation | null>(null);
  const base = useRef('');
  useEffect(() => () => handle.current?.stop(), []);
  if (!dictationSupported()) return null;
  const toggle = () => {
    if (on) { handle.current?.stop(); return; }
    setMsg(''); base.current = value.trim();
    const h = startDictation(lang, {
      onText: (final, interim) => onChange([base.current, final, interim].filter(Boolean).join(' ').slice(0, max)),
      onError: m => { setMsg(m); setOn(false); },
      onEnd: () => { setOn(false); handle.current = null; },
    });
    if (h) { handle.current = h; setOn(true); }
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" onClick={toggle} aria-pressed={on} title="Speak your take. Support varies by browser; some send audio to the browser vendor." data-testid="dictate"
        className={`inline-flex items-center gap-1 text-[11px] ${on ? 'text-red-300' : 'text-zinc-500 hover:text-zinc-200'}`}>
        {on ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3" />}{on ? 'Stop' : 'Dictate'}
      </button>
      {msg && <span className="text-[10px] text-red-300" role="alert">{msg}</span>}
    </span>
  );
}
