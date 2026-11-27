import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { FACE_CONSENT_TEXT } from '../lib/consent';

/** Shown above any control that uploads a face. The upload stays off until the box is ticked and the agreement is recorded. */
export function FaceConsent({ onAccept, error }: { onAccept: () => Promise<void>; error?: string }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div role="group" aria-label="Photo and video consent" className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-[12px] text-amber-100">
      <p className="flex items-center gap-1.5 font-medium"><ShieldCheck className="h-3.5 w-3.5" />Before you upload a face</p>
      <label className="mt-2 flex items-start gap-2 text-zinc-200"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5" /><span>{FACE_CONSENT_TEXT}</span></label>
      <button type="button" disabled={!checked || busy} onClick={async () => { setBusy(true); try { await onAccept(); } finally { setBusy(false); } }} className="mt-2 h-8 rounded-lg bg-amber-400/20 px-3 text-[12px] font-semibold text-amber-100 disabled:opacity-50">I agree</button>
      {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
    </div>
  );
}
