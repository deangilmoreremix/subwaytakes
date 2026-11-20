/** Small text helpers shared by the verse and quote composers. */
export const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length;
/** The first `max` words, ending on a full stop (a clause that is cut gets one). */
const DANGLING = new Set(['and', 'or', 'but', 'the', 'a', 'an', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'that', 'than', 'so', 'as', 'my', 'your', 'our', 'their', 'is', 'am', 'are', 'was', 'be', 'i']);
export function fitWords(text: string, max: number): string {
  const w = text.trim().split(/\s+/).filter(Boolean);
  if (w.length <= max) return w.join(' ');
  const cut = w.slice(0, max);
  const endsSentence = /[.!?]$/.test(cut[cut.length - 1] ?? '');
  // never stop on a word that needs a next word ("... and."): drop such words from the end of a cut
  while (!endsSentence && cut.length > 1 && DANGLING.has((cut[cut.length - 1] ?? '').toLowerCase().replace(/[^a-z']/g, ''))) cut.pop();
  return cut.join(' ').replace(/[,;:-]+$/, '') + (/[.!?]$/.test(cut[cut.length - 1] ?? '') ? '' : '.');
}
