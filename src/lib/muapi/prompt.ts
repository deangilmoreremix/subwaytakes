// The take/interview spec and prompt builders now live in src/lib/interview. Re-exported here
// so existing imports keep working.
export { DEFAULT_TAKE, OPENER, spokenLines, buildNativePrompt, buildStillPrompt, cutsPlan, cutsProblem, titleLines, type TakeSpec, type InterviewFormat, type Tone } from '../interview';
import { buildStillPrompt, type TakeSpec } from '../interview';

/** Image prompt for the lipsync pipeline (the guest portrait). */
export function buildGuestStillPrompt(t: TakeSpec): string {
  return buildStillPrompt(t, 'guest');
}
