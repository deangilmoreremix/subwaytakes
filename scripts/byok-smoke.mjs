// Smoke test of the DEPLOYED subwaytakes-byok proxy with a real signed-in account and your own muapi key. READ-ONLY and free:
// it reads your muapi wallet balance and asks for one price estimate. It never submits a generation, so it cannot spend money.
// Dry run by default (prints what it would call). Needs, as environment variables (nothing is written to disk or printed):
//   SUPABASE_URL, SUPABASE_ANON_KEY   the project's public values
//   ST_EMAIL, ST_PASSWORD             an account that has confirmed its email (not a guest)
//   MUAPI_KEY                         your own muapi key
// Usage:  node scripts/byok-smoke.mjs            (dry run)      node scripts/byok-smoke.mjs --run
const RUN = process.argv.includes('--run');
const need = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'ST_EMAIL', 'ST_PASSWORD', 'MUAPI_KEY'];
const missing = need.filter(n => !process.env[n]);
const FN = (process.env.SUPABASE_URL ?? '<SUPABASE_URL>').replace(/\/$/, '') + '/functions/v1/subwaytakes-byok';

console.log('Plan (read-only, no spend):');
console.log('  1. sign in with ST_EMAIL / ST_PASSWORD to get a session token');
console.log(`  2. POST ${FN}  { method: GET, path: /api/v1/account/balance }  with your key in the x-muapi-key header`);
console.log(`  3. POST ${FN}  { method: POST, path: /api/v1/models/veo3.1-fast-text-to-video/estimate-cost }  (a price, nothing is generated)`);
console.log('  4. a deliberately wrong key must come back as invalid_key, and a path outside the allowlist as path_not_allowed');
if (!RUN) { console.log(`\nDRY RUN: nothing was called. ${missing.length ? 'Still missing: ' + missing.join(', ') + '. ' : ''}Add --run to execute.`); process.exit(0); }
if (missing.length) { console.error('Missing environment variables: ' + missing.join(', ')); process.exit(2); }

let failures = 0;
const check = (name, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', name, extra); if (!ok) failures++; };
const base = process.env.SUPABASE_URL.replace(/\/$/, '');

const login = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.ST_EMAIL, password: process.env.ST_PASSWORD }) });
const session = await login.json();
check('signed in', !!session.access_token, login.ok ? '' : `(${login.status} ${session.error_description ?? session.msg ?? ''})`);
if (!session.access_token) process.exit(1);

async function call(key, payload) {
  const r = await fetch(FN, { method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, apikey: process.env.SUPABASE_ANON_KEY, 'content-type': 'application/json', ...(key ? { 'x-muapi-key': key } : {}) }, body: JSON.stringify(payload) });
  let body; try { body = await r.json(); } catch { body = {}; }
  return { status: r.status, body };
}

const bal = await call(process.env.MUAPI_KEY, { method: 'GET', path: '/api/v1/account/balance' });
check('your key is accepted and the balance is readable', bal.status === 200, `status ${bal.status}; shape: ${JSON.stringify(Object.keys(bal.body ?? {}))}`);
if (bal.status === 200) console.log('  balance response (as muapi returned it):', JSON.stringify(bal.body).slice(0, 200).replaceAll(process.env.MUAPI_KEY, '[key removed]'));

const est = await call(process.env.MUAPI_KEY, { method: 'POST', path: '/api/v1/models/veo3.1-fast-text-to-video/estimate-cost', body: { prompt: 'a calm subway ride', aspect_ratio: '9:16', duration: 8 } });
check('a price comes back in whole cents', est.status === 200 && est.body?.unit === 'cents' && Number.isInteger(est.body?.cost), JSON.stringify(est.body).slice(0, 120));

const bad = await call('mk_bad_NOTAREALKEY0123456789abcd', { method: 'GET', path: '/api/v1/account/balance' });
check('a wrong key is reported as invalid_key', bad.status === 401 && bad.body?.code === 'invalid_key', `status ${bad.status} ${bad.body?.code}`);

const none = await call(null, { method: 'GET', path: '/api/v1/account/balance' });
check('no key is reported as no_key', none.body?.code === 'no_key', `status ${none.status} ${none.body?.code}`);

const denied = await call(process.env.MUAPI_KEY, { method: 'POST', path: '/api/v1/account/topup' });
check('a path outside the allowlist is refused before muapi is touched', denied.body?.code === 'path_not_allowed', `status ${denied.status} ${denied.body?.code}`);

const blocked = await call(process.env.MUAPI_KEY, { method: 'POST', path: '/api/v1/veo3.1-fast-text-to-video', body: { prompt: 'a naked person on a train' } });
check('the content screen refuses before anything is submitted', blocked.status === 400 && blocked.body?.code === 'blocked', `status ${blocked.status} ${blocked.body?.code}`);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED (real account and key, read-only)');
process.exit(failures ? 1 : 0);
