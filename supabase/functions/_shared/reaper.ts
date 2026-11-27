// What the scheduled reaper does with a job that has been "submitted" for a long time. It asks muapi; it never refunds blindly.
export type ReapAction = 'settle' | 'release' | 'wait';

/** A job that is still running after this long is given up on and refunded (it is also hidden from the customer: see the poll rule). */
export const HARD_TIMEOUT_MINUTES = 24 * 60;

export function reapDecision(muapi: { status: 'completed' | 'failed' | 'cancelled' | 'queued' | 'processing' | 'unknown' }, ageMinutes: number): ReapAction {
  if (muapi.status === 'completed') return 'settle';          // delivered at muapi: the charge stands
  if (muapi.status === 'failed' || muapi.status === 'cancelled') return 'release';
  if (ageMinutes >= HARD_TIMEOUT_MINUTES) return 'release';  // never resolved: refund, and the poll rule stops it being delivered later
  return 'wait';                                              // still running, or muapi could not be reached: try again next time
}

export interface ReapDeps {
  /** Holds with no muapi job after `minutes` are refunded by the database. Returns how many. */
  reapUnsubmitted(minutes: number): Promise<number>;
  staleCalls(minutes: number, limit: number): Promise<Array<{ requestId: string; ageMinutes: number }>>;
  /** Ask muapi about one job. Throws or returns 'unknown' when muapi cannot be reached. */
  muapiStatus(requestId: string): Promise<'completed' | 'failed' | 'cancelled' | 'queued' | 'processing' | 'unknown'>;
  settle(requestId: string): Promise<string>;
  release(requestId: string, reason: string): Promise<string>;
  log(event: string, data: Record<string, unknown>): void;
}

/** One reaper pass. A failure on one job never stops the others, and nothing is refunded unless muapi said failed or the hard timeout passed. */
export async function reapOnce(deps: ReapDeps): Promise<{ unsubmitted: number; settled: number; released: number; waiting: number; errors: number }> {
  const out = { unsubmitted: 0, settled: 0, released: 0, waiting: 0, errors: 0 };
  out.unsubmitted = await deps.reapUnsubmitted(60);
  for (const c of await deps.staleCalls(30, 50)) {
    try {
      let status: Awaited<ReturnType<ReapDeps['muapiStatus']>> = 'unknown';
      try { status = await deps.muapiStatus(c.requestId); } catch { status = 'unknown'; }
      const action = reapDecision({ status }, c.ageMinutes);
      if (action === 'settle') { await deps.settle(c.requestId); out.settled++; }
      else if (action === 'release') { await deps.release(c.requestId, status === 'failed' || status === 'cancelled' ? 'job failed at muapi (reaper)' : 'never resolved (reaper)'); out.released++; }
      else out.waiting++;
    } catch {
      out.errors++;
      deps.log('reap_error', { requestId: c.requestId });
    }
  }
  return out;
}
