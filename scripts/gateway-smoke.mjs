// Smoke test for a DEPLOYED muapi-gateway. Dry run by default: it signs in, reads your balance and asks the gateway for a price
// (free, no charge). With --run it makes ONE real, cheap generation and checks that the charge, the ledger and the balance agree.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... TEST_EMAIL=... TEST_PASSWORD=... node scripts/gateway-smoke.mjs
//   ... node scripts/gateway-smoke.mjs --run --cap 200      (spends up to 200 credits of the TEST account, about $2)
//
// Use a dedicated test account that has a confirmed email and some credits (grant them on the /admin page).
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const RUN = argv.includes('--run');
const CAP = Number(argv[argv.indexOf('--cap') + 1]) || 200;
const { SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL and TEST_PASSWORD (a dedicated test account).');
  process.exit(2);
}
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };

const { error: authError } = await sb.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
if (authError) { console.error('Sign-in failed:', authError.message); process.exit(1); }
const { data: { user } } = await sb.auth.getUser();
check('signed in with a confirmed, non-guest account', !!user?.email_confirmed_at && !user.is_anonymous);

const gw = async (method, path, body, idempotencyKey) => {
  const { data, error } = await sb.functions.invoke('muapi-gateway', { body: { method, path, body, idempotencyKey } });
  if (error) { let b = null; try { b = await error.context.clone().json(); } catch { /* not json */ } return { ok: false, status: error.context?.status, body: b }; }
  return { ok: true, status: 200, body: data };
};
const balance = async () => (await sb.from('user_profiles').select('credits_balance').eq('id', user.id).single()).data.credits_balance;

const SLUG = 'elevenlabs-tts-turbo-2-5'; // one short voice line: the cheapest real call we make
const INPUT = { prompt: 'Gateway smoke test.', voice_id: 'Rachel', speed: 1 };

const start = await balance();
console.log(`balance: ${start} credits`);

// ---- free checks
const q = await gw('POST', `/api/v1/models/${SLUG}/estimate-cost`, INPUT);
check('the gateway quotes a price in credits', q.ok && typeof q.body?.cost === 'number' && q.body.unit === 'credits', JSON.stringify(q.body));
check('a quote does not charge', (await balance()) === start);
const denied = await gw('GET', '/api/v1/account/balance');
check('the gateway refuses to expose the muapi account balance', !denied.ok && denied.status === 400, String(denied.status));
const foreign = await gw('GET', '/api/v1/predictions/00000000-0000-0000-0000-000000000000/result');
check("polling an id that is not yours is refused", !foreign.ok && foreign.status === 404, String(foreign.status));

if (!RUN) { console.log(`\nDRY RUN: nothing was charged. Add --run --cap ${CAP} to make one real call (quoted at ${q.body?.cost ?? '?'} credits).`); process.exit(failures ? 1 : 0); }

// ---- one real call
const cost = q.body?.cost;
if (typeof cost !== 'number') { console.error('No quote, refusing to run.'); process.exit(1); }
if (cost > CAP) { console.error(`Quote ${cost} credits is over the cap ${CAP}.`); process.exit(1); }
if (start < cost) { console.error(`Balance ${start} is below the quote ${cost}. Grant credits on /admin first.`); process.exit(1); }

const key = crypto.randomUUID();
const sub = await gw('POST', `/api/v1/${SLUG}`, INPUT, key);
check('submit succeeds and reports the charge', sub.ok && sub.body?.credits?.charged === cost && !!sub.body?.request_id, JSON.stringify(sub.body)?.slice(0, 200));
if (!sub.ok) process.exit(1);
check('the credits were taken at submit time', (await balance()) === start - cost, `balance ${await balance()}`);
const again = await gw('POST', `/api/v1/${SLUG}`, INPUT, key);
check('a retry with the same idempotency key does not charge or submit again', again.ok && again.body?.request_id === sub.body.request_id && (await balance()) === start - cost);

let final = null;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 4000));
  const r = await gw('GET', `/api/v1/predictions/${sub.body.request_id}/result`);
  if (!r.ok) { final = { failed: true, body: r.body }; break; }
  if (['completed', 'succeeded', 'success', 'done'].includes(String(r.body?.status).toLowerCase())) { final = { done: true }; break; }
}
check('the generation finished', !!final?.done, JSON.stringify(final)?.slice(0, 200));
const end = await balance();
check('a delivered result keeps the charge', end === start - cost, `balance ${end}`);
const { data: rows } = await sb.from('credit_ledger').select('delta, kind, reason').order('id', { ascending: false }).limit(3);
check('the ledger shows the spend', rows?.some(r => r.kind === 'spend' && r.delta === -cost), JSON.stringify(rows));
console.log(`\nspent ${start - end} credits. Compare with your muapi balance: the real cost should be about ${(cost / 2.5 / 100).toFixed(3)} USD.`);
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
