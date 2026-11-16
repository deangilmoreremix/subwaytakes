import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../auth';

/** What the first-run checklist remembers. Everything else on it is read from the real state of the project and balance. */
export interface OnboardingFlags { dismissed?: boolean; exported?: boolean }

export interface StepInput {
  /** The show, place or take has been changed from the starting values. */
  customised: boolean;
  /** The take has been written by the customer. */
  tookTake: boolean;
  balance: number | null;
  videoClips: number;
  captionClips: number;
  exported: boolean;
}
export interface Step { id: 'choose' | 'take' | 'credits' | 'generate' | 'captions' | 'export'; label: string; hint: string; done: boolean }

/** The checklist, derived from what the customer has actually done (so it can never tick something that did not happen). */
export function onboardingSteps(i: StepInput): Step[] {
  return [
    { id: 'choose', label: 'Pick a show, a city or a template', hint: 'Templates are one-click starting points. Browsing and the Ideas list are free.', done: i.customised },
    { id: 'take', label: 'Write your take', hint: 'Type it in the box under the preview, or pick one from Ideas.', done: i.tookTake },
    { id: 'credits', label: 'Add credits to generate', hint: 'Generation uses credits. Studio Starter in Settings gets you going.', done: (i.balance ?? 0) > 0 || i.videoClips > 0 },
    { id: 'generate', label: 'Generate your first shot', hint: 'Press Generate. You see the price first.', done: i.videoClips > 0 },
    { id: 'captions', label: 'Add captions', hint: 'Select the clip, then Inspector, Clip, Generate captions.', done: i.captionClips > 0 },
    { id: 'export', label: 'Export your episode', hint: 'Top right. MP4 is made in your browser.', done: i.exported },
  ];
}
export const nextStep = (steps: Step[]): Step | undefined => steps.find(s => !s.done);
export const allDone = (steps: Step[]): boolean => steps.every(s => s.done);

const LOCAL = 'subwaytakes.onboarding.v1';
function readLocal(): OnboardingFlags { try { return JSON.parse(localStorage.getItem(LOCAL) ?? '{}') as OnboardingFlags; } catch { return {}; } }
function writeLocal(f: OnboardingFlags): void { try { localStorage.setItem(LOCAL, JSON.stringify(f)); } catch { /* storage unavailable */ } }

/** Flags live in this browser for everyone and in the account (user_settings) for signed-in customers, so a dismissed card stays dismissed on every device. */
export function useOnboardingFlags() {
  const { user, isGuest } = useAuth();
  const uid = user && !isGuest ? user.id : null;
  const [flags, setFlags] = useState<OnboardingFlags>(readLocal);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    supabase.from('user_settings').select('onboarding').maybeSingle().then(({ data }) => {
      const remote = (data as { onboarding?: OnboardingFlags } | null)?.onboarding;
      if (live && remote && typeof remote === 'object') setFlags(f => { const m = { ...f, ...remote, dismissed: !!(f.dismissed || remote.dismissed), exported: !!(f.exported || remote.exported) }; writeLocal(m); return m; });
    }, () => undefined);
    return () => { live = false; };
  }, [uid]);

  const update = useCallback((patch: OnboardingFlags) => {
    setFlags(f => {
      const next = { ...f, ...patch }; writeLocal(next);
      if (uid) void supabase.from('user_settings').upsert({ user_id: uid, onboarding: next, updated_at: new Date().toISOString() }).then(() => undefined, () => undefined);
      return next;
    });
  }, [uid]);
  return { flags, update };
}
