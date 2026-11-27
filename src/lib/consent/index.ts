import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../auth';

/** Bump when the wording changes: everyone is asked again and the new acceptance is recorded next to the old one. */
export const FACE_CONSENT_VERSION = '1';
export const FACE_CONSENT_TEXT = 'I have the right to use this photo or video. The person in it is me, or they have agreed to this use. They are an adult, and I am not trying to imitate a real person who has not agreed.';

const LOCAL = `subwaytakes.consent.face.${FACE_CONSENT_VERSION}`;
const readLocal = (uid: string): boolean => { try { return localStorage.getItem(`${LOCAL}.${uid}`) === '1'; } catch { return false; } };
const writeLocal = (uid: string): void => { try { localStorage.setItem(`${LOCAL}.${uid}`, '1'); } catch { /* storage unavailable */ } };

/**
 * Consent to upload faces (Cast portraits, Recast source clips and reference photos). The acceptance is recorded against the account with the
 * time and the wording version, as evidence. The uploads themselves are not technically blocked server-side: this is a record plus a gate in the page.
 */
export function useFaceConsent() {
  const { user, isGuest } = useAuth();
  const uid = user && !isGuest ? user.id : null;
  const [accepted, setAccepted] = useState(() => (uid ? readLocal(uid) : false));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) { setAccepted(false); return; }
    if (readLocal(uid)) { setAccepted(true); return; }
    let live = true;
    supabase.from('consents').select('version').eq('kind', 'face_upload').eq('version', FACE_CONSENT_VERSION).maybeSingle()
      .then(({ data }) => { if (live && data) { writeLocal(uid); setAccepted(true); } }, () => undefined);
    return () => { live = false; };
  }, [uid]);

  const accept = useCallback(async () => {
    if (!uid) { setError('Sign in to continue.'); return; }
    setError('');
    const { error: e } = await supabase.from('consents').insert({ user_id: uid, kind: 'face_upload', version: FACE_CONSENT_VERSION });
    // a duplicate means it was already recorded (another tab or device): that is fine
    if (e && !/duplicate|23505/i.test(`${e.code ?? ''} ${e.message ?? ''}`)) { setError('Could not record your agreement. Try again.'); return; }
    writeLocal(uid); setAccepted(true);
  }, [uid]);

  return { accepted, accept, error };
}
