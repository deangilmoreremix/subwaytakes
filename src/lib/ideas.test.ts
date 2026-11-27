import { describe, expect, it, vi } from 'vitest';

vi.mock('./questionBank', () => ({ listQuestions: vi.fn() }));
import { listQuestions } from './questionBank';
import { STARTER_IDEAS, groupIdeas, loadIdeas } from './ideas';

describe('groupIdeas', () => {
  it('groups by category in first-seen order and drops blanks and duplicates', () => {
    const g = groupIdeas([
      { id: '1', category: 'Food', text: ' Pizza rules ' }, { id: '2', category: 'Work', text: 'Meetings suck' },
      { id: '3', category: 'Food', text: 'pizza rules' }, { id: '4', category: 'Food', text: '   ' }, { id: '5', category: '', text: 'No category' },
    ]);
    expect(g.map(x => x.category)).toEqual(['Food', 'Work', 'Ideas']);
    expect(g[0].ideas.map(i => i.text)).toEqual(['Pizza rules']);
  });
  it('has starters in several categories', () => expect(new Set(STARTER_IDEAS.map(i => i.category)).size).toBeGreaterThanOrEqual(4));
});

describe('loadIdeas', () => {
  it('puts saved questions first and keeps the starters', async () => {
    vi.mocked(listQuestions).mockResolvedValueOnce([{ id: 'q1', category: 'Money', question: 'Is rent a scam?' }] as never);
    const r = await loadIdeas();
    expect(r.fromBank).toBe(true);
    expect(r.groups.find(g => g.category === 'Money')!.ideas[0].text).toBe('Is rent a scam?');
    expect(r.groups.some(g => g.category === 'Food')).toBe(true);
  });
  it('falls back to the starters when the bank is unreachable or empty', async () => {
    vi.mocked(listQuestions).mockRejectedValueOnce(new Error('offline'));
    expect((await loadIdeas()).fromBank).toBe(false);
    vi.mocked(listQuestions).mockResolvedValueOnce([]);
    expect((await loadIdeas()).fromBank).toBe(false);
  });
});
