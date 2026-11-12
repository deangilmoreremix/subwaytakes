import { useEffect, useState } from 'react';
import { muapi, getMuapiKey } from './client';
import { FALLBACK_ELEVEN, MINIMAX_VOICES, TTS_SLUG, parseElevenVoices, type Voice, type VoiceProvider } from './voices';

let cachedEleven: Voice[] | null = null;

/** Voice list per provider. ElevenLabs is read live from muapi (fallback list if offline / no key). */
export function useVoices(provider: VoiceProvider): { voices: Voice[]; live: boolean } {
  const [eleven, setEleven] = useState<Voice[]>(cachedEleven ?? FALLBACK_ELEVEN);
  const [live, setLive] = useState(!!cachedEleven);
  useEffect(() => {
    if (provider !== 'elevenlabs' || cachedEleven || !getMuapiKey()) return;
    let on = true;
    muapi.model(TTS_SLUG.elevenlabs).then(m => {
      const v = parseElevenVoices(m);
      if (on && v.length) { cachedEleven = v; setEleven(v); setLive(true); }
    }).catch(() => undefined);
    return () => { on = false; };
  }, [provider]);
  return provider === 'elevenlabs' ? { voices: eleven, live } : { voices: MINIMAX_VOICES, live: true };
}
