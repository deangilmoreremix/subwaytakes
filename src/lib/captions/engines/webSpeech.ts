// Live dictation with the browser's Web Speech API. No word timestamps, so this is for typing takes and live previews, not for timed captions.
// Support varies by browser and some browsers send the audio to the vendor's service; the UI says so.

interface RecognitionResultItem { transcript: string }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<ArrayLike<RecognitionResultItem> & { isFinal: boolean }> }
interface Recognition { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: RecognitionEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void; abort(): void }
type RecognitionCtor = new () => Recognition;

export function recognitionCtor(w: unknown = typeof window === 'undefined' ? undefined : window): RecognitionCtor | null {
  const g = w as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor } | undefined;
  return g?.SpeechRecognition ?? g?.webkitSpeechRecognition ?? null;
}
export const dictationSupported = (w?: unknown): boolean => recognitionCtor(w) !== null;

export interface Dictation { stop(): void }
export interface DictationHandlers { onText(finalText: string, interim: string): void; onError(message: string): void; onEnd(): void }

const ERRORS: Record<string, string> = { 'not-allowed': 'Microphone permission was denied.', 'service-not-allowed': 'Speech recognition is not allowed in this browser.', 'no-speech': 'No speech was heard.', 'audio-capture': 'No microphone was found.', network: 'Speech recognition needs a network connection in this browser.' };

export function startDictation(lang: string, h: DictationHandlers, w?: unknown): Dictation | null {
  const Ctor = recognitionCtor(w); if (!Ctor) return null;
  const r = new Ctor(); r.lang = lang && lang !== 'auto' ? lang : (typeof navigator === 'undefined' ? 'en-US' : navigator.language || 'en-US');
  r.continuous = true; r.interimResults = true;
  let finalText = '';
  r.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const res = e.results[i]; const t = res[0]?.transcript ?? ''; if (res.isFinal) finalText += (finalText ? ' ' : '') + t.trim(); else interim += t; }
    h.onText(finalText, interim.trim());
  };
  r.onerror = e => h.onError(ERRORS[e.error] ?? `Speech recognition error: ${e.error}`);
  r.onend = () => h.onEnd();
  r.start();
  return { stop: () => r.stop() };
}
