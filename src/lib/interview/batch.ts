import type { TakeSpec } from './index';
import { showOf } from '../shows';

export const MAX_BATCH = 10;

/** One line per episode, blanks and duplicates dropped, capped at MAX_BATCH. */
export function parseBatchLines(text: string, max = MAX_BATCH): { lines: string[]; dropped: number } {
  const seen = new Set<string>();
  const all = text.split(/\r?\n/).map(l => l.replace(/^\s*(?:[-*\d.)]+\s+)/, '').trim()).filter(Boolean).filter(l => { const k = l.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  return { lines: all.slice(0, max), dropped: Math.max(0, all.length - max) };
}

/**
 * Turn each line into a spec. For shows with a host question the line IS the question (the guest answer is cleared so the
 * model improvises the answer); for Hot Take the line is the take. Debate duels cannot be batched (two sides per episode).
 */
export function batchSpecs(base: TakeSpec, lines: string[]): { specs: TakeSpec[]; problem: string | null } {
  const show = showOf(base.show);
  if (show.guests === 2) return { specs: [], problem: 'Debate duels need two sides each, so they cannot be batched. Pick another show.' };
  const specs = lines.map(line => show.editableQuestion ? { ...base, question: line.slice(0, 160) } : { ...base, take: line.slice(0, 220) });
  return { specs, problem: null };
}
