// Operational alert rules. Pure: numbers in, alerts out (the scheduled function gathers the numbers and delivers the alerts).
export interface Metrics {
  drifted_users: number; negative_balances: number; stuck_holds: number; stale_calls: number;
  calls_24h: number; failed_calls_24h: number; paid_orders_24h: number; reversed_orders_24h: number; needs_attention_24h: number; client_errors_1h: number;
  /** from muapi; null when it could not be read, undefined when it was not checked */
  muapi_balance_usd?: number | null; muapi_reachable?: boolean;
}
export interface Thresholds {
  lowBalanceUsd: number; stuckHolds: number; staleCalls: number; minCalls: number; failureRate: number; clientErrors1h: number; reversalFloor: number; reversalShare: number;
}
export const DEFAULT_THRESHOLDS: Thresholds = { lowBalanceUsd: 20, stuckHolds: 5, staleCalls: 10, minCalls: 20, failureRate: 0.3, clientErrors1h: 50, reversalFloor: 3, reversalShare: 0.3 };
export type Severity = 'info' | 'warn' | 'critical';
export interface Alert { kind: string; severity: Severity; message: string; detail: Record<string, number | string | null> }

/** muapi's balance answer, tolerant of shape: a bare number, {balance}, {data:{balance}} or {credits}. */
export function parseBalanceUsd(json: unknown): number | null {
  const pick = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  if (pick(json) !== null) return pick(json);
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    for (const k of ['balance', 'credits', 'available']) { const n = pick(o[k]); if (n !== null) return n; }
    if (o.data && typeof o.data === 'object') return parseBalanceUsd(o.data);
  }
  return null;
}

/** Which problems exist right now. An alert kind that is not returned is considered cleared. */
export function opsDecide(m: Metrics, t: Thresholds = DEFAULT_THRESHOLDS): Alert[] {
  const out: Alert[] = [];
  if (m.drifted_users > 0) out.push({ kind: 'ledger_drift', severity: 'critical', message: `${m.drifted_users} account balance(s) do not equal their ledger. Stop and investigate before taking more money.`, detail: { users: m.drifted_users } });
  if (m.negative_balances > 0) out.push({ kind: 'negative_balance', severity: 'critical', message: `${m.negative_balances} account(s) have a negative balance.`, detail: { users: m.negative_balances } });
  if (m.needs_attention_24h > 0) out.push({ kind: 'payment_needs_attention', severity: 'critical', message: `${m.needs_attention_24h} Stripe event(s) in the last 24 hours need a human: a customer may have paid without receiving credits, or a partial refund needs a decision.`, detail: { events: m.needs_attention_24h } });
  if (m.muapi_reachable === false) out.push({ kind: 'muapi_unreachable', severity: 'warn', message: 'muapi could not be reached from the scheduled check. Customers may be seeing generation errors.', detail: {} });
  if (typeof m.muapi_balance_usd === 'number' && m.muapi_balance_usd < t.lowBalanceUsd) out.push({ kind: 'muapi_low_balance', severity: m.muapi_balance_usd < t.lowBalanceUsd / 4 ? 'critical' : 'warn', message: `The muapi balance is $${m.muapi_balance_usd.toFixed(2)}, below $${t.lowBalanceUsd.toFixed(2)}. Top it up before generations start failing.`, detail: { balance_usd: m.muapi_balance_usd, threshold_usd: t.lowBalanceUsd } });
  if (m.stuck_holds > t.stuckHolds) out.push({ kind: 'stuck_holds', severity: 'warn', message: `${m.stuck_holds} credit holds have been open for over 2 hours. Check that the reaper is scheduled.`, detail: { holds: m.stuck_holds } });
  if (m.stale_calls > t.staleCalls) out.push({ kind: 'stale_calls', severity: 'warn', message: `${m.stale_calls} muapi jobs are still unsettled after 2 hours. Check the reaper and muapi.`, detail: { calls: m.stale_calls } });
  if (m.calls_24h >= t.minCalls && m.failed_calls_24h / m.calls_24h > t.failureRate) out.push({ kind: 'high_failure_rate', severity: 'warn', message: `${m.failed_calls_24h} of ${m.calls_24h} generations failed in the last 24 hours (${Math.round((m.failed_calls_24h / m.calls_24h) * 100)}%). Customers were refunded, but something is wrong upstream.`, detail: { failed: m.failed_calls_24h, calls: m.calls_24h } });
  if (m.reversed_orders_24h >= t.reversalFloor && m.reversed_orders_24h > m.paid_orders_24h * t.reversalShare) out.push({ kind: 'refund_spike', severity: 'warn', message: `${m.reversed_orders_24h} orders were refunded or disputed in the last 24 hours against ${m.paid_orders_24h} paid. Look for card testing or a broken promise on the sales page.`, detail: { reversed: m.reversed_orders_24h, paid: m.paid_orders_24h } });
  if (m.client_errors_1h > t.clientErrors1h) out.push({ kind: 'client_error_spike', severity: 'warn', message: `${m.client_errors_1h} browser errors reported in the last hour. A release may have broken something.`, detail: { errors: m.client_errors_1h } });
  return out;
}

export const alertText = (a: Alert): string => `${a.severity === 'critical' ? '[CRITICAL]' : a.severity === 'warn' ? '[WARNING]' : '[info]'} SubwayTakes: ${a.message}`;
