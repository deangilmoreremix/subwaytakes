/**
 * Vox-pop poll ("Question of the day"): one question asked to several different guests, who each answer with one of two labels
 * (Yes or No, A or B), cut back to back and finished with a results card. Pure planning and counting; the app runs the guests through batch.
 * Guests are ORIGINAL characters written for the pool, never real people.
 */
import { DEFAULT_TAKE, type TakeSpec } from '../interview';
import { applyShow } from '../shows';

export const POLL_MIN_GUESTS = 2;
export const POLL_MAX_GUESTS = 5;
export const POLL_RESULT_FRAMES = 90;   // 3 seconds at 30 fps
export const LABEL_MAX = 14;

/** Different looks, ages and outfits so five answers do not look like one person. */
export const GUEST_POOL: readonly string[] = [
  'a local commuter in their 30s in a winter jacket',
  'a woman in her 50s with short grey hair and a red scarf',
  'a man in his 20s with a backpack and headphones around his neck',
  'a woman in her 20s in a denim jacket with long braids',
  'a man in his 60s with a flat cap and a wool coat',
  'a woman in her 40s in a business coat holding a coffee',
  'a man in his 30s in a hoodie with a beard and glasses',
  'a woman in her 30s in a bright raincoat with curly hair',
];

export interface PollAnswer { label: 0 | 1; text: string }

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Two usable option labels, short, different from each other (case-insensitive). Falls back to Yes and No. */
export function pollLabels(a: string, b: string): [string, string] {
  const x = clean(a).slice(0, LABEL_MAX) || 'Yes';
  let y = clean(b).slice(0, LABEL_MAX) || 'No';
  if (x.toLowerCase() === y.toLowerCase()) y = x.toLowerCase() === 'no' ? 'Yes' : 'No';
  return [x, y];
}

/**
 * One line per guest, starting with the label they chose: "Yes: obviously, it is the best." Up to POLL_MAX_GUESTS.
 * A line without a known label at the start is refused, so the count can never be wrong by guessing.
 */
export function parsePollLines(text: string, labels: [string, string], max = POLL_MAX_GUESTS): { answers: PollAnswer[]; problem: string | null; dropped: number } {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const answers: PollAnswer[] = [];
  for (const [i, line] of lines.entries()) {
    const m = /^([^:]{1,24}):\s*(.+)$/.exec(line);
    const which = m ? labels.findIndex(l => l.toLowerCase() === m[1].trim().toLowerCase()) : -1;
    if (!m || which < 0) return { answers: [], problem: `Line ${i + 1} must start with "${labels[0]}:" or "${labels[1]}:" so the vote can be counted.`, dropped: 0 };
    if (answers.length < max) answers.push({ label: which as 0 | 1, text: m[2].slice(0, 200) });
  }
  const dropped = Math.max(0, lines.length - max);
  if (answers.length < POLL_MIN_GUESTS) return { answers, problem: `A poll needs at least ${POLL_MIN_GUESTS} guests (one line each).`, dropped };
  return { answers, problem: null, dropped };
}

export function tally(answers: readonly PollAnswer[]): [number, number] {
  const c: [number, number] = [0, 0];
  for (const a of answers) c[a.label]++;
  return c;
}

export interface Bar { label: string; count: number; percent: number; winner: boolean }

/** Bars for the results card. Percentages are whole numbers that add up to 100 (largest remainder), a tie has no winner. */
export function pollBars(labels: [string, string], counts: [number, number]): Bar[] {
  const total = counts[0] + counts[1];
  if (total <= 0) return labels.map(label => ({ label, count: 0, percent: 0, winner: false }));
  const exact = counts.map(c => (c * 100) / total);
  const floors = exact.map(Math.floor);
  let left = 100 - floors[0] - floors[1];
  const order = [0, 1].sort((i, j) => (exact[j] - floors[j]) - (exact[i] - floors[i]) || counts[j] - counts[i]);
  for (const i of order) if (left > 0) { floors[i]++; left--; }
  const top = Math.max(counts[0], counts[1]);
  return labels.map((label, i) => ({ label, count: counts[i], percent: floors[i], winner: counts[i] === top && counts[0] !== counts[1] }));
}

/** What the results card stores on its clip. Validated again when a project file or an old save is opened. */
export interface PollResults { type: 'poll-results'; question: string; labels: [string, string]; counts: [number, number] }

export function normalizePollResults(raw: unknown): PollResults | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PollResults>;
  if (r.type !== 'poll-results' || typeof r.question !== 'string' || !Array.isArray(r.labels) || !Array.isArray(r.counts)) return null;
  const [a, b] = r.labels, [x, y] = r.counts;
  if (typeof a !== 'string' || typeof b !== 'string' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const n = (v: number) => Math.min(99, Math.max(0, Math.round(v)));
  return { type: 'poll-results', question: clean(r.question).slice(0, 160), labels: pollLabels(a, b), counts: [n(x as number), n(y as number)] };
}

/** One episode spec per guest: the same question, a different guest each, the guest's own answer as their line. */
export function pollSpecs(base: TakeSpec, question: string, answers: readonly PollAnswer[]): TakeSpec[] {
  const asked = applyShow({ ...DEFAULT_TAKE, ...base }, 'one_question');           // a show whose host question is editable
  const q = clean(question).slice(0, 160) || asked.question || '';
  return answers.map((a, i) => ({ ...asked, question: q, take: a.text, take2: undefined, guestDescription: GUEST_POOL[i % GUEST_POOL.length] }));
}
