import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, alertText, opsDecide, parseBalanceUsd, type Metrics } from './ops';

const calm: Metrics = { drifted_users: 0, negative_balances: 0, stuck_holds: 0, stale_calls: 0, calls_24h: 100, failed_calls_24h: 2, paid_orders_24h: 10, reversed_orders_24h: 0, needs_attention_24h: 0, client_errors_1h: 0, muapi_balance_usd: 120, muapi_reachable: true };
const kinds = (m: Partial<Metrics>) => opsDecide({ ...calm, ...m }).map(a => a.kind);

describe('opsDecide', () => {
  it('is quiet when everything is fine', () => { expect(opsDecide(calm)).toEqual([]); });
  it('raises critical alerts for money integrity problems', () => {
    expect(kinds({ drifted_users: 1 })).toContain('ledger_drift'); expect(kinds({ negative_balances: 2 })).toContain('negative_balance'); expect(kinds({ needs_attention_24h: 1 })).toContain('payment_needs_attention');
    for (const a of opsDecide({ ...calm, drifted_users: 1, negative_balances: 1, needs_attention_24h: 1 })) expect(a.severity).toBe('critical');
  });
  it('warns on a low muapi balance and goes critical when it is nearly gone', () => {
    expect(opsDecide({ ...calm, muapi_balance_usd: 19.99 })[0]).toMatchObject({ kind: 'muapi_low_balance', severity: 'warn' });
    expect(opsDecide({ ...calm, muapi_balance_usd: 3 })[0]).toMatchObject({ kind: 'muapi_low_balance', severity: 'critical' });
    expect(kinds({ muapi_balance_usd: 20 })).not.toContain('muapi_low_balance'); expect(kinds({ muapi_balance_usd: null })).not.toContain('muapi_low_balance'); expect(kinds({ muapi_balance_usd: undefined })).not.toContain('muapi_low_balance');
  });
  it('flags an unreachable muapi, stuck holds and stale calls only past their thresholds', () => {
    expect(kinds({ muapi_reachable: false })).toContain('muapi_unreachable');
    expect(kinds({ stuck_holds: 5 })).not.toContain('stuck_holds'); expect(kinds({ stuck_holds: 6 })).toContain('stuck_holds');
    expect(kinds({ stale_calls: 10 })).not.toContain('stale_calls'); expect(kinds({ stale_calls: 11 })).toContain('stale_calls');
  });
  it('failure rate needs enough calls to mean anything', () => {
    expect(kinds({ calls_24h: 10, failed_calls_24h: 10 })).not.toContain('high_failure_rate');
    expect(kinds({ calls_24h: 100, failed_calls_24h: 31 })).toContain('high_failure_rate'); expect(kinds({ calls_24h: 100, failed_calls_24h: 30 })).not.toContain('high_failure_rate');
  });
  it('refund spike needs a few reversals AND a large share of paid orders', () => {
    expect(kinds({ reversed_orders_24h: 2, paid_orders_24h: 0 })).not.toContain('refund_spike');
    expect(kinds({ reversed_orders_24h: 3, paid_orders_24h: 5 })).toContain('refund_spike');
    expect(kinds({ reversed_orders_24h: 3, paid_orders_24h: 100 })).not.toContain('refund_spike');
  });
  it('browser error spikes', () => { expect(kinds({ client_errors_1h: 50 })).not.toContain('client_error_spike'); expect(kinds({ client_errors_1h: 51 })).toContain('client_error_spike'); });
  it('respects custom thresholds', () => { expect(opsDecide({ ...calm, muapi_balance_usd: 90 }, { ...DEFAULT_THRESHOLDS, lowBalanceUsd: 100 }).map(a => a.kind)).toEqual(['muapi_low_balance']); });
  it('every alert has a plain message and one line of text for a notification', () => {
    for (const a of opsDecide({ ...calm, drifted_users: 1, muapi_balance_usd: 1, stuck_holds: 9, client_errors_1h: 99 })) { expect(a.message.length).toBeGreaterThan(20); expect(alertText(a)).toMatch(/^\[(CRITICAL|WARNING|info)\] SubwayTakes: /); expect(alertText(a)).not.toContain('\n'); }
  });
});

describe('parseBalanceUsd', () => {
  it('reads the shapes muapi might use', () => {
    expect(parseBalanceUsd(12.5)).toBe(12.5); expect(parseBalanceUsd({ balance: 6.74 })).toBe(6.74); expect(parseBalanceUsd({ data: { balance: '3.5' } })).toBe(3.5); expect(parseBalanceUsd({ credits: 8 })).toBe(8);
  });
  it('says null rather than guessing', () => { for (const bad of [null, undefined, {}, [], 'abc', { balance: 'x' }, { data: {} }, NaN]) expect(parseBalanceUsd(bad)).toBeNull(); });
});
