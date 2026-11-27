import { describe, expect, it } from 'vitest';
import { BALANCE_PATH, handle, keyShapeOk, type ByokCaller, type ByokDeps } from './byok.ts';

const KEY = 'mk_live_SECRETSECRETSECRET1234';
const OK: ByokCaller = { id: 'u1', isAnonymous: false, emailConfirmed: true };

function world(over: { up?: (m: string, p: string) => { status: number; json: unknown }; hit?: () => Promise<void> } = {}) {
  const w = { calls: [] as Array<{ method: string; path: string; key: string; body: unknown }>, logs: [] as string[], hits: [] as string[] };
  const deps: ByokDeps = {
    hit: async (_u, kind) => { w.hits.push(kind); if (over.hit) await over.hit(); },
    muapi: async (method, path, key, body) => { w.calls.push({ method, path, key, body }); return (over.up ?? (() => ({ status: 200, json: { request_id: 'r1' } })))(method, path); },
    log: (e, d) => { w.logs.push(JSON.stringify({ e, d })); },
  };
  return { w, deps };
}
const post = (path: string, body: unknown = { prompt: 'a calm subway ride' }) => ({ method: 'POST', path, body });

describe('who may use it', () => {
  it('needs a signed-in, confirmed, non-guest account and a key; nothing reaches muapi otherwise', async () => {
    const { w, deps } = world();
    expect((await handle(null, post('/api/v1/x'), KEY, deps)).status).toBe(401);
    expect((await handle({ ...OK, isAnonymous: true }, post('/api/v1/x'), KEY, deps)).body).toMatchObject({ code: 'account_required' });
    expect((await handle({ ...OK, emailConfirmed: false }, post('/api/v1/x'), KEY, deps)).body).toMatchObject({ code: 'verify_email' });
    expect((await handle(OK, post('/api/v1/x'), null, deps)).body).toMatchObject({ code: 'no_key' });
    expect((await handle(OK, post('/api/v1/x'), 'short', deps)).body).toMatchObject({ code: 'invalid_key' });
    expect(w.calls).toHaveLength(0);
  });
  it('key shape', () => { expect(keyShapeOk(KEY)).toBe(true); expect(keyShapeOk('a b'.repeat(8))).toBe(false); expect(keyShapeOk(5)).toBe(false); });
});

describe('paths', () => {
  it('forwards a submit with the customer key and the body', async () => {
    const { w, deps } = world();
    const r = await handle(OK, post('/api/v1/veo3.1-fast-text-to-video'), KEY, deps);
    expect(r.status).toBe(200);
    expect(w.calls[0]).toMatchObject({ method: 'POST', path: '/api/v1/veo3.1-fast-text-to-video', key: KEY });
    expect(w.hits).toEqual(['submit']);
  });
  it('polls, reads metadata and the balance (free calls)', async () => {
    const { w, deps } = world({ up: () => ({ status: 200, json: { balance: 12.5 } }) });
    expect((await handle(OK, { method: 'GET', path: '/api/v1/predictions/abc-123/result' }, KEY, deps)).status).toBe(200);
    expect((await handle(OK, { method: 'GET', path: '/api/v1/models/elevenlabs-tts-turbo-2-5' }, KEY, deps)).status).toBe(200);
    expect(await handle(OK, { method: 'GET', path: BALANCE_PATH }, KEY, deps)).toEqual({ status: 200, body: { balance: 12.5 } });
    expect(w.hits).toEqual(['free', 'free', 'free']);
  });
  it('refuses everything else', async () => {
    const { w, deps } = world();
    for (const [m, p] of [['GET', '/api/v1/account/topup'], ['POST', BALANCE_PATH], ['GET', '/api/v1/keys'], ['POST', '/api/v1/upload_file'], ['GET', '/app/admin_balances'], ['GET', '/api/v1/account/balance?x=1']]) {
      expect((await handle(OK, { method: m, path: p }, KEY, deps)).body).toMatchObject({ code: 'path_not_allowed' });
    }
    expect(w.calls).toHaveLength(0);
  });
});

describe('safety and limits', () => {
  it('the content screen refuses before muapi is touched', async () => {
    const { w, deps } = world();
    const r = await handle(OK, post('/api/v1/veo3.1-fast-text-to-video', { prompt: 'a naked person on the train' }), KEY, deps);
    expect(r.status).toBe(400); expect(r.body).toMatchObject({ code: 'blocked' });
    expect(w.calls).toHaveLength(0);
  });
  it('rate limit is reported and nothing is sent', async () => {
    const { w, deps } = world({ hit: async () => { throw new Error('rate_limited'); } });
    expect((await handle(OK, post('/api/v1/x-model'), KEY, deps)).status).toBe(429);
    expect(w.calls).toHaveLength(0);
  });
  it('a submit needs an object body', async () => {
    const { deps } = world();
    expect((await handle(OK, { method: 'POST', path: '/api/v1/x-model', body: 'hi' }, KEY, deps)).body).toMatchObject({ code: 'bad_request' });
  });
});

describe('what muapi says', () => {
  const via = (status: number, json: unknown = {}) => handle(OK, post('/api/v1/x-model'), KEY, world({ up: () => ({ status, json }) }).deps);
  it('maps a rejected key, an empty wallet, busy and down', async () => {
    expect(await via(401)).toMatchObject({ status: 401, body: { code: 'invalid_key' } });
    expect(await via(403)).toMatchObject({ status: 401, body: { code: 'invalid_key' } });
    expect(await via(402)).toMatchObject({ status: 402, body: { code: 'muapi_balance' } });
    expect(await via(400, { error: 'Insufficient balance' })).toMatchObject({ status: 402, body: { code: 'muapi_balance' } });
    expect(await via(429)).toMatchObject({ status: 429 });
    expect(await via(503)).toMatchObject({ status: 502, body: { code: 'upstream' } });
  });
  it('passes muapi validation messages through (the customer fixes those)', async () => {
    expect(await via(422, { detail: 'duration must be 4 to 8' })).toMatchObject({ status: 422, body: { error: 'duration must be 4 to 8' } });
  });
  it('a network failure is a friendly 502', async () => {
    const { deps } = world(); deps.muapi = async () => { throw new Error('boom'); };
    expect(await handle(OK, post('/api/v1/x-model'), KEY, deps)).toMatchObject({ status: 502 });
  });
  it('estimates come back in whole cents', async () => {
    const r = await handle(OK, post('/api/v1/models/veo3.1-fast-text-to-video/estimate-cost'), KEY, world({ up: () => ({ status: 200, json: { cost: 0.6 } }) }).deps);
    expect(r).toEqual({ status: 200, body: { cost: 60, unit: 'cents' } });
  });
});

describe('the key never leaks', () => {
  it('not in any response, error, or log, even when muapi echoes it', async () => {
    const { w, deps } = world({ up: () => ({ status: 400, json: { error: `bad key ${KEY} for you` } }) });
    const out = [
      await handle(OK, post('/api/v1/x-model'), KEY, deps),
      await handle(OK, post('/api/v1/x-model', { prompt: 'a naked person' }), KEY, deps),
    ];
    expect(JSON.stringify(out)).not.toContain(KEY);
    expect(w.logs.join('')).not.toContain(KEY);
    deps.muapi = async () => { throw new Error(`failed ${KEY}`); };
    expect(JSON.stringify(await handle(OK, post('/api/v1/x-model'), KEY, deps))).not.toContain(KEY);
  });
});
