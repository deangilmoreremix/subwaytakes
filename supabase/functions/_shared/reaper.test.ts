import { describe, expect, it } from 'vitest';
import { reapDecision, reapOnce, type ReapDeps } from './reaper';

describe('reapDecision', () => {
  it('settles completed, refunds failed and cancelled, waits for running jobs, gives up after 24h', () => {
    expect(reapDecision({ status: 'completed' }, 40)).toBe('settle');
    expect(reapDecision({ status: 'failed' }, 40)).toBe('release');
    expect(reapDecision({ status: 'cancelled' }, 40)).toBe('release');
    expect(reapDecision({ status: 'processing' }, 40)).toBe('wait');
    expect(reapDecision({ status: 'unknown' }, 40)).toBe('wait');
    expect(reapDecision({ status: 'processing' }, 24 * 60)).toBe('release');
  });
});

function fake(calls: Array<{ requestId: string; ageMinutes: number }>, statuses: Record<string, string | Error>) {
  const log: string[] = [];
  const deps: ReapDeps = {
    reapUnsubmitted: async () => 2,
    staleCalls: async () => calls,
    muapiStatus: async id => { const s = statuses[id]; if (s instanceof Error) throw s; return (s ?? 'unknown') as never; },
    settle: async id => { log.push('settle:' + id); return 'settled'; },
    release: async id => { log.push('release:' + id); return 'released'; },
    log: () => {},
  };
  return { deps, log };
}

describe('reapOnce', () => {
  it('settles, refunds and waits per job, and reports counts', async () => {
    const { deps, log } = fake([{ requestId: 'a', ageMinutes: 45 }, { requestId: 'b', ageMinutes: 45 }, { requestId: 'c', ageMinutes: 45 }], { a: 'completed', b: 'failed', c: 'processing' });
    expect(await reapOnce(deps)).toEqual({ unsubmitted: 2, settled: 1, released: 1, waiting: 1, errors: 0 });
    expect(log).toEqual(['settle:a', 'release:b']);
  });
  it('never refunds when muapi cannot be reached, until the hard timeout', async () => {
    const { deps, log } = fake([{ requestId: 'a', ageMinutes: 90 }, { requestId: 'b', ageMinutes: 24 * 60 + 1 }], { a: new Error('net'), b: new Error('net') });
    const r = await reapOnce(deps);
    expect(r).toMatchObject({ waiting: 1, released: 1 }); expect(log).toEqual(['release:b']);
  });
  it('one failing job does not stop the rest', async () => {
    const { deps, log } = fake([{ requestId: 'a', ageMinutes: 45 }, { requestId: 'b', ageMinutes: 45 }], { a: 'completed', b: 'completed' });
    let first = true; const orig = deps.settle; deps.settle = async id => { if (first) { first = false; throw new Error('db'); } return orig(id); };
    expect(await reapOnce(deps)).toMatchObject({ errors: 1, settled: 1 }); expect(log).toEqual(['settle:b']);
  });
});
