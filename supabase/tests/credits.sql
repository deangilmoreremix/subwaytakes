-- Assertions for 20261120000000_credits_ledger.sql. Run after bootstrap.sql and the migration. Any failure raises and aborts.
\set ON_ERROR_STOP on
\set legacy '''00000000-0000-0000-0000-0000000000a1'''
\set zero   '''00000000-0000-0000-0000-0000000000a2'''

CREATE FUNCTION pg_temp.expect(name text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', name; END IF; RAISE NOTICE 'PASS: %', name; END $$;

CREATE FUNCTION pg_temp.fails(name text, stmt text, expect_msg text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE stmt; EXCEPTION WHEN OTHERS THEN
    IF expect_msg IS NOT NULL AND SQLERRM NOT LIKE '%' || expect_msg || '%' THEN RAISE EXCEPTION 'FAIL: % (wrong error: %)', name, SQLERRM; END IF;
    RAISE NOTICE 'PASS: %', name; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: % (statement succeeded)', name;
END $$;

CREATE FUNCTION pg_temp.balance(u uuid) RETURNS integer LANGUAGE sql AS $$ SELECT credits_balance FROM user_profiles WHERE id = u $$;
CREATE FUNCTION pg_temp.ledger_sum(u uuid) RETURNS integer LANGUAGE sql AS $$ SELECT COALESCE(sum(delta), 0)::int FROM credit_ledger WHERE user_id = u $$;

-- ================================================================ migration outcome
SELECT pg_temp.expect('legacy balance is kept, as an opening ledger row', pg_temp.balance(:legacy) = 100 AND (SELECT count(*) FROM credit_ledger WHERE user_id = :legacy AND kind = 'opening') = 1);
SELECT pg_temp.expect('invariant holds after migration (balance = sum(ledger))', pg_temp.balance(:legacy) = pg_temp.ledger_sum(:legacy) AND pg_temp.balance(:zero) = pg_temp.ledger_sum(:zero));
SELECT pg_temp.expect('default balance is now 0', (SELECT column_default FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'credits_balance') = '0');

-- ================================================================ clients cannot touch money
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
SELECT pg_temp.fails('user cannot set their own credits_balance', $q$ UPDATE user_profiles SET credits_balance = 999999 WHERE id = auth.uid() $q$, 'permission denied');
SELECT pg_temp.fails('user cannot change subscription_tier', $q$ UPDATE user_profiles SET subscription_tier = 'enterprise' WHERE id = auth.uid() $q$, 'permission denied');
SELECT pg_temp.fails('user cannot call the old deduct_credits', $q$ SELECT deduct_credits(auth.uid(), 1) $q$, 'permission denied');
SELECT pg_temp.fails('user cannot call credit_apply', $q$ SELECT credit_apply(auth.uid(), 500, 'grant', 'free money') $q$, 'permission denied');
SELECT pg_temp.fails('user cannot call credit_reserve', $q$ SELECT * FROM credit_reserve(auth.uid(), 1, 'x') $q$, 'permission denied');
SELECT pg_temp.fails('user cannot insert ledger rows', $q$ INSERT INTO credit_ledger (user_id, delta, kind) VALUES (auth.uid(), 500, 'grant') $q$, 'permission denied');
UPDATE user_profiles SET display_name = 'Maya' WHERE id = auth.uid();
SELECT pg_temp.expect('user can still edit harmless profile fields', (SELECT display_name FROM user_profiles WHERE id = auth.uid()) = 'Maya');
RESET ROLE;

-- an old client that still inserts a profile with 100 free credits gets 0
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000b1', 'farm@example.com');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
INSERT INTO user_profiles (id, display_name) VALUES ('00000000-0000-0000-0000-0000000000b1', 'farm');
RESET ROLE;
SELECT pg_temp.expect('new profiles start at 0 credits', pg_temp.balance('00000000-0000-0000-0000-0000000000b1') = 0);
-- and the guard trigger alone (as the table owner, bypassing grants) still refuses a direct balance write
SELECT pg_temp.fails('guard trigger blocks direct balance writes even for the owner', $q$ UPDATE user_profiles SET credits_balance = 5 WHERE id = '00000000-0000-0000-0000-0000000000a2' $q$, 'only change through the credit ledger');

-- ledger is append-only
SELECT pg_temp.fails('ledger rows cannot be edited', $q$ UPDATE credit_ledger SET delta = 1000 WHERE kind = 'opening' $q$, 'append-only');
SELECT pg_temp.fails('ledger rows cannot be deleted', $q$ DELETE FROM credit_ledger $q$, 'append-only');

-- ledger RLS: a user reads only their own rows
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT pg_temp.expect('user reads own ledger only', (SELECT count(*) FROM credit_ledger) = 1 AND (SELECT user_id FROM credit_ledger LIMIT 1) = '00000000-0000-0000-0000-0000000000a1');
RESET ROLE;

-- ================================================================ service_role operations
SET ROLE service_role;
SELECT pg_temp.expect('grant adds credits and returns the new balance', credit_apply(:zero, 300, 'grant', 'test grant', 'order-1') = 300);
SELECT pg_temp.expect('the same grant ref is a no-op (idempotent)', credit_apply(:zero, 300, 'grant', 'test grant', 'order-1') = 300);
SELECT pg_temp.expect('invariant after grant', pg_temp.balance(:zero) = pg_temp.ledger_sum(:zero));
SELECT pg_temp.fails('a grant cannot be negative', $q$ SELECT credit_apply('00000000-0000-0000-0000-0000000000a2', -5, 'grant', 'x') $q$, 'bad_amount');
SELECT pg_temp.fails('an adjustment cannot push the balance below zero', $q$ SELECT credit_apply('00000000-0000-0000-0000-0000000000a2', -9999, 'adjust', 'x') $q$, 'would_go_negative');
SELECT pg_temp.expect('a negative adjustment within the balance works', credit_apply(:zero, -50, 'adjust', 'goodwill reversal', 'adj-1') = 250);
RESET ROLE;

-- ================================================================ reserve / settle / release
SET ROLE service_role;
CREATE TEMP TABLE h1 AS SELECT * FROM credit_reserve(:zero, 100, 'veo3.1-fast-text-to-video', 'idem-1');
SELECT pg_temp.expect('reserve takes credits immediately', pg_temp.balance(:zero) = 150 AND (SELECT NOT reused FROM h1));
SELECT pg_temp.expect('same idempotency key returns the same hold and does not charge twice', (SELECT hold_id FROM credit_reserve(:zero, 100, 'veo3.1-fast-text-to-video', 'idem-1')) = (SELECT hold_id FROM h1) AND pg_temp.balance(:zero) = 150);
SELECT credit_attach_request((SELECT hold_id FROM h1), 'req-1', 0.6);
SELECT pg_temp.expect('settle keeps the charge', credit_settle('req-1') = 'completed' AND pg_temp.balance(:zero) = 150);
SELECT pg_temp.expect('settle twice is harmless', credit_settle('req-1') = 'completed' AND pg_temp.balance(:zero) = 150);
SELECT pg_temp.expect('release after settle does not refund a delivered clip', credit_release('req-1') = 'completed' AND pg_temp.balance(:zero) = 150);

CREATE TEMP TABLE h2 AS SELECT * FROM credit_reserve(:zero, 60, 'omnihuman-2-0', 'idem-2');
SELECT credit_attach_request((SELECT hold_id FROM h2), 'req-2', 0.24);
SELECT pg_temp.expect('failure refunds the hold', credit_release('req-2', 'muapi failed') = 'failed' AND pg_temp.balance(:zero) = 150);
SELECT pg_temp.expect('refund happens exactly once', credit_release('req-2', 'again') = 'failed' AND pg_temp.balance(:zero) = 150 AND (SELECT count(*) FROM credit_ledger WHERE kind = 'refund' AND ref = 'hold:' || (SELECT hold_id FROM h2)) = 1);
SELECT pg_temp.expect('a settle after a refund never flips it back', credit_settle('req-2') = 'failed' AND pg_temp.balance(:zero) = 150);
SELECT pg_temp.expect('unknown request ids are reported, not charged', credit_settle('nope') = 'unknown' AND credit_release('nope') = 'unknown');

CREATE TEMP TABLE h3 AS SELECT * FROM credit_reserve(:zero, 40, 'x', 'idem-3');
SELECT pg_temp.expect('submit failure (no request id) releases by hold', credit_release_hold((SELECT hold_id FROM h3), 'submit rejected') = 'released' AND pg_temp.balance(:zero) = 150);
SELECT pg_temp.expect('releasing a hold twice refunds once', credit_release_hold((SELECT hold_id FROM h3), 'again') = 'released' AND pg_temp.balance(:zero) = 150);

SELECT pg_temp.fails('insufficient credits is refused', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a2', 1000, 'x', 'idem-big') $q$, 'insufficient_credits');
SELECT pg_temp.expect('a refused reserve changes nothing', pg_temp.balance(:zero) = 150);
SELECT pg_temp.fails('a profile with no row cannot reserve', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-00000000ffff', 1, 'x') $q$, 'insufficient_credits');
SELECT pg_temp.fails('zero or negative amounts are refused', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a2', 0, 'x') $q$, 'bad_amount');
RESET ROLE;
SELECT pg_temp.expect('invariant holds after the whole sequence', pg_temp.balance(:zero) = pg_temp.ledger_sum(:zero));

-- ================================================================ limits and kill switch
SET ROLE service_role;
SELECT credit_apply(:legacy, 4000, 'grant', 'limit tests', 'lim-1');
RESET ROLE;
UPDATE gateway_settings SET max_credits_per_call = 200;
SET ROLE service_role;
SELECT pg_temp.fails('per-call cap', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a1', 201, 'x', 'cap-1') $q$, 'amount_too_large');
RESET ROLE;
UPDATE gateway_settings SET max_credits_per_call = 1500, max_open_holds = 2;
SET ROLE service_role;
SELECT * FROM credit_reserve(:legacy, 10, 'x', 'open-1'); SELECT * FROM credit_reserve(:legacy, 10, 'x', 'open-2');
SELECT pg_temp.fails('too many open holds', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a1', 10, 'x', 'open-3') $q$, 'too_many_open');
RESET ROLE;
UPDATE gateway_settings SET max_open_holds = 10, max_calls_per_minute = 2, max_free_per_minute = 3;
SET ROLE service_role;
SELECT credit_hit(:legacy, 'submit'); SELECT credit_hit(:legacy, 'submit');
SELECT pg_temp.fails('submit attempts are limited per minute (counted before any muapi call)', $q$ SELECT credit_hit('00000000-0000-0000-0000-0000000000a1', 'submit') $q$, 'rate_limited');
SELECT credit_hit(:legacy, 'free'); SELECT credit_hit(:legacy, 'free'); SELECT credit_hit(:legacy, 'free');
SELECT pg_temp.fails('free calls (quotes, polls, metadata) are limited too', $q$ SELECT credit_hit('00000000-0000-0000-0000-0000000000a1', 'free') $q$, 'rate_limited');
SELECT pg_temp.expect('limits are per user', (SELECT count(*) FROM (SELECT credit_hit('00000000-0000-0000-0000-0000000000a2', 'submit')) x) = 1);
SELECT pg_temp.fails('only known kinds are accepted', $q$ SELECT credit_hit('00000000-0000-0000-0000-0000000000a1', 'other') $q$, 'bad_kind');
RESET ROLE;
DELETE FROM gateway_hits;
UPDATE gateway_settings SET max_calls_per_minute = 30, daily_credit_cap = 100;
SET ROLE service_role;
SELECT pg_temp.fails('daily credit cap counts what was already spent today', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a1', 90, 'x', 'daily-1') $q$, 'daily_cap');
RESET ROLE;
UPDATE gateway_settings SET daily_credit_cap = 5000, kill_switch = true;
SET ROLE service_role;
SELECT pg_temp.fails('kill switch stops every reserve', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a1', 1, 'x', 'kill-1') $q$, 'killed');
RESET ROLE;
UPDATE gateway_settings SET kill_switch = false;

-- ================================================================ idempotency keys are bound to the exact request
SET ROLE service_role;
CREATE TEMP TABLE hk AS SELECT * FROM credit_reserve(:legacy, 50, 'veo3.1-fast-text-to-video', 'key-A', 'hash-cheap');
SELECT pg_temp.expect('first use of a key reserves', (SELECT NOT reused FROM hk));
SELECT pg_temp.expect('same key + same request returns the same hold, no second charge', (SELECT hold_id FROM credit_reserve(:legacy, 50, 'veo3.1-fast-text-to-video', 'key-A', 'hash-cheap')) = (SELECT hold_id FROM hk));
SELECT pg_temp.fails('same key with a DIFFERENT body is refused (no cheaper charge for a bigger job)', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a1', 50, 'veo3.1-fast-text-to-video', 'key-A', 'hash-expensive') $q$, 'idem_mismatch');
SELECT pg_temp.fails('same key with a different price is refused', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a1', 5, 'veo3.1-fast-text-to-video', 'key-A', 'hash-cheap') $q$, 'idem_mismatch');
SELECT pg_temp.fails('same key on a different model is refused', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a1', 50, 'omnihuman-2-0', 'key-A', 'hash-cheap') $q$, 'idem_mismatch');
SELECT credit_release_hold((SELECT hold_id FROM hk), 'submit rejected');
SELECT pg_temp.fails('a refunded key can never start a new, uncharged job', $q$ SELECT * FROM credit_reserve('00000000-0000-0000-0000-0000000000a1', 50, 'veo3.1-fast-text-to-video', 'key-A', 'hash-cheap') $q$, 'idem_reused');
SELECT pg_temp.expect('keys are per user (another user may reuse the same text)', (SELECT hold_id FROM credit_reserve('00000000-0000-0000-0000-0000000000a2', 5, 'x', 'key-A', 'hash-cheap')) IS NOT NULL);
SELECT credit_release_hold((SELECT id FROM credit_holds WHERE user_id = '00000000-0000-0000-0000-0000000000a2' AND idem_key = 'key-A'), 'cleanup');
-- one muapi job per hold
CREATE TEMP TABLE hk2 AS SELECT * FROM credit_reserve(:legacy, 10, 'x', 'key-B', 'h');
SELECT credit_attach_request((SELECT hold_id FROM hk2), 'job-once', 0.1);
SELECT pg_temp.fails('a hold cannot back two muapi jobs', $q$ SELECT credit_attach_request((SELECT id FROM credit_holds WHERE idem_key = 'key-B'), 'job-twice', 0.1) $q$, 'duplicate key');
SELECT credit_settle('job-once');
RESET ROLE;

-- ================================================================ admin credit rules
SET ROLE service_role;
SELECT credit_apply(:zero, 10, 'grant', 'goodwill', 'g-1', '00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.expect('an admin grant records who made it', (SELECT actor FROM credit_ledger WHERE ref = 'g-1') = '00000000-0000-0000-0000-0000000000a1');
SELECT pg_temp.fails('reusing a ref with a different amount is an error, not a silent success', $q$ SELECT credit_apply('00000000-0000-0000-0000-0000000000a2', 99, 'grant', 'x', 'g-1') $q$, 'ref_conflict');
SELECT pg_temp.expect('reusing a ref with the same amount is a harmless repeat', credit_apply(:zero, 10, 'grant', 'goodwill', 'g-1') = pg_temp.balance(:zero));
RESET ROLE;

-- ================================================================ profile safety
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
UPDATE user_profiles SET display_name = 'Maya', updated_at = now() WHERE id = auth.uid();
SELECT pg_temp.expect('the app can still touch updated_at when editing a profile', (SELECT display_name FROM user_profiles WHERE id = auth.uid()) = 'Maya');
SELECT pg_temp.fails('a user cannot delete their own profile row (and with it the balance)', $q$ DELETE FROM user_profiles WHERE id = auth.uid() $q$, 'permission denied');
SELECT pg_temp.fails('clients cannot read the attempt log', $q$ SELECT * FROM gateway_hits $q$, 'permission denied');
SELECT pg_temp.fails('clients cannot read holds or calls', $q$ SELECT * FROM credit_holds $q$, 'permission denied');
SELECT pg_temp.fails('the legacy token deduction cannot be called by clients any more', $q$ SELECT atomic_deduct_tokens(auth.uid(), 1) $q$, 'permission denied');
RESET ROLE;
-- the ledger refuses rows for a user with no profile instead of drifting
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000d1', 'noprofile@example.com');
SELECT pg_temp.fails('a ledger row without a profile is an error (balance and ledger cannot drift)', $q$ INSERT INTO credit_ledger (user_id, delta, kind, reason) VALUES ('00000000-0000-0000-0000-0000000000d1', 5, 'grant', 'x') $q$, 'no profile');

-- ================================================================ reaper
UPDATE credit_holds SET created_at = now() - interval '2 hours' WHERE user_id = :legacy AND status = 'held';
-- a stale hold WITH a muapi job must be left alone (the gateway asks muapi; refunding blindly would hand out free finished jobs)
SET ROLE service_role;
CREATE TEMP TABLE hr AS SELECT * FROM credit_reserve(:legacy, 7, 'x', 'key-running', 'h');
SELECT credit_attach_request((SELECT hold_id FROM hr), 'job-running', 0.05);
RESET ROLE;
UPDATE credit_holds SET created_at = now() - interval '2 hours' WHERE id = (SELECT hold_id FROM hr);
UPDATE muapi_calls SET created_at = now() - interval '2 hours' WHERE request_id = 'job-running';
SET ROLE service_role;
SELECT pg_temp.expect('reaper refunds stale holds that never became a job', credit_reap_holds(60) >= 2);
SELECT pg_temp.expect('reaper leaves a hold with a running job alone', (SELECT status FROM credit_holds WHERE id = (SELECT hold_id FROM hr)) = 'held');
SELECT pg_temp.expect('reaper is idempotent', credit_reap_holds(60) = 0);
SELECT pg_temp.expect('the stale job is listed for the gateway to check with muapi', (SELECT count(*) FROM credit_stale_calls(30, 50) WHERE request_id = 'job-running') = 1);
SELECT pg_temp.expect('a settled or failed job is not listed again', (SELECT count(*) FROM credit_stale_calls(30, 50) WHERE request_id = 'job-once') = 0);
SELECT pg_temp.expect('refunding the stale job (what the gateway does when muapi says failed) works exactly once', credit_release('job-running', 'timed out') = 'failed' AND credit_release('job-running', 'again') = 'failed');
RESET ROLE;
SELECT pg_temp.expect('invariant holds after limits and reaper', pg_temp.balance(:legacy) = pg_temp.ledger_sum(:legacy));

-- ================================================================ global invariant
SELECT pg_temp.expect('for EVERY user, balance = sum(ledger)', NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.credits_balance IS DISTINCT FROM (SELECT COALESCE(sum(delta), 0) FROM credit_ledger l WHERE l.user_id = p.id)));
SELECT pg_temp.expect('no balance is negative', NOT EXISTS (SELECT 1 FROM user_profiles WHERE credits_balance < 0));

-- ================================================================ admin helpers
SELECT pg_temp.expect('credit_find_user is case-insensitive', credit_find_user('  ZERO@example.com ') = :zero);
SELECT pg_temp.expect('credit_stats reports sold, spent and outstanding credits', (credit_stats()->>'credits_granted')::int >= 4300 AND (credit_stats()->>'credits_outstanding')::int = (SELECT sum(credits_balance) FROM user_profiles));
SET ROLE authenticated;
SELECT pg_temp.fails('users cannot read stats', $q$ SELECT credit_stats() $q$, 'permission denied');
SELECT pg_temp.fails('users cannot look up other users by email', $q$ SELECT credit_find_user('zero@example.com') $q$, 'permission denied');
RESET ROLE;
