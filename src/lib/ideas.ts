/** Take ideas for the Take tab: the saved question bank when reachable, else a built-in starter list. */
import { listQuestions } from './questionBank';

export interface Idea { id: string; category: string; text: string }

export const STARTER_IDEAS: Idea[] = [
  { category: 'Food', text: 'Pineapple belongs on pizza and anyone who disagrees is scared of joy.' },
  { category: 'Food', text: 'Cereal is a soup and nobody can convince me otherwise.' },
  { category: 'Food', text: 'A hot dog is a sandwich.' },
  { category: 'Dating', text: 'Splitting the bill on a first date is the only fair way.' },
  { category: 'Dating', text: 'If they text back in under a minute they are not that busy.' },
  { category: 'Money', text: 'Renting forever is smarter than buying a house.' },
  { category: 'Money', text: 'Tipping culture has gone way too far.' },
  { category: 'Work', text: 'Working from home is better than the office, no debate.' },
  { category: 'Work', text: 'Nobody actually needs a meeting that could have been an email.' },
  { category: 'City', text: 'Leggings should not be pants.' },
  { category: 'City', text: 'Standing on the left of the escalator should be illegal.' },
  { category: 'City', text: 'The subway is the best way to see a city.' },
].map((x, i) => ({ id: `starter-${i}`, ...x }));

/** Pure: group ideas by category, keeping first-seen order and dropping blanks/duplicates. */
export function groupIdeas(items: Idea[]): Array<{ category: string; ideas: Idea[] }> {
  const seen = new Set<string>();
  const groups = new Map<string, Idea[]>();
  for (const it of items) {
    const text = it.text.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    const cat = it.category?.trim() || 'Ideas';
    groups.set(cat, [...(groups.get(cat) ?? []), { ...it, text }]);
  }
  return [...groups].map(([category, ideas]) => ({ category, ideas }));
}

/** Saved question bank first (limited), starters as the offline fallback and always appended after. */
export async function loadIdeas(limit = 40): Promise<{ groups: ReturnType<typeof groupIdeas>; fromBank: boolean }> {
  try {
    const rows = await listQuestions({ limit });
    const bank: Idea[] = rows.map(r => ({ id: r.id, category: r.category, text: r.question }));
    if (bank.length) return { groups: groupIdeas([...bank, ...STARTER_IDEAS]), fromBank: true };
  } catch { /* offline or table missing: fall through */ }
  return { groups: groupIdeas(STARTER_IDEAS), fromBank: false };
}
