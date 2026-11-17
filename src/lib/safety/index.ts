// The same screen the gateway runs, so people see a clear message before anything is submitted. The server still enforces it.
export { checkBody, checkText, collectText, SAFETY_CATEGORIES, type SafetyCategory, type SafetyResult } from '../../../supabase/functions/_shared/safety';

/** The request was refused by the content screen. Nothing was charged. */
export class ContentBlockedError extends Error {
  constructor(public category: string, message: string) { super(message); this.name = 'ContentBlockedError'; }
}
