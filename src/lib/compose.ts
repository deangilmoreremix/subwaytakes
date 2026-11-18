/** Small text helpers shared by the verse and quote composers. */
export const wordCount = (s: string): number => s.split(/\s+/).filter(Boolean).length;
/** The first `max` words, ending on a full stop (a clause that is cut gets one). */
export function fitWords(text: string, max: number): string {
  const w = text.trim().split(/\s+/).filter(Boolean);
  return w.length <= max ? w.join(' ') : w.slice(0, max).join(' ').replace(/[,;:-]+$/, '') + (/[.!?]$/.test(w[max - 1] ?? '') ? '' : '.');
}
