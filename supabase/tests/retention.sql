-- Assertions for 20261122000000_retention.sql. Run after bootstrap, clip_jobs, credits, billing and retention migrations.
\set ON_ERROR_STOP on
\set p1 '''00000000-0000-0000-0000-000000000101'''
\set p2 '''00000000-0000-0000-0000-000000000102'''
\set p3 '''00000000-0000-0000-0000-000000000103'''
\set rr '''00000000-0000-0000-0000-000000000111'''
\set e1 '''00000000-0000-0000-0000-000000000112'''
\set e2 '''00000000-0000-0000-0000-000000000113'''
\set e3 '''00000000-0000-0000-0000-000000000114'''

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
-- buy a product for a user the way the webhook would
CREATE FUNCTION pg_temp.buy(u uuid, product text, sess text, pi text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE oid uuid; cents integer;
BEGIN
  SELECT order_id, amount_cents INTO oid, cents FROM order_create_pending(u, product);
  PERFORM order_attach_session(oid, sess);
  RETURN order_fulfil(sess, pi, cents, 'usd');
END $$;

INSERT INTO auth.users (id, email) SELECT i, 'u' || right(i::text, 3) || '@example.com' FROM unnest(ARRAY[:p1, :p2, :p3, :rr, :e1, :e2, :e3]::uuid[]) i;
INSERT INTO user_profiles (id) SELECT i FROM unnest(ARRAY[:p1, :p2, :p3, :rr, :e1, :e2, :e3]::uuid[]) i;

-- ================================================================ projects
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
CREATE TEMP TABLE t_p AS SELECT * FROM project_create('  ', '{"clips":[]}');
RESET ROLE;
GRANT ALL ON t_p TO authenticated;
SET ROLE authenticated;
SELECT pg_temp.expect('a project is created for the caller with a default name and version 1', (SELECT version FROM t_p) = 1 AND (SELECT name FROM projects WHERE id = (SELECT id FROM t_p)) = 'Untitled episode');
SELECT pg_temp.expect('saving with the current version bumps it', project_save((SELECT id FROM t_p), 'Take 1', '{"clips":[1]}', 1) = 2);
SELECT pg_temp.fails('saving from a stale copy is a conflict, not an overwrite', $q$ SELECT project_save((SELECT id FROM t_p), 'Stale', '{"clips":[2]}', 1) $q$, 'version_conflict');
SELECT pg_temp.expect('the conflicting save changed nothing', (SELECT data->'clips'->>0 FROM projects WHERE id = (SELECT id FROM t_p)) = '1' AND (SELECT name FROM projects WHERE id = (SELECT id FROM t_p)) = 'Take 1');
SELECT pg_temp.fails('clients cannot edit a project row directly (no version bypass)', $q$ UPDATE projects SET version = 1 $q$, 'permission denied');
SELECT pg_temp.fails('clients cannot insert a project row directly (no limit or size bypass)', $q$ INSERT INTO projects (user_id) VALUES (auth.uid()) $q$, 'permission denied');
SELECT pg_temp.fails('a project must be a JSON object', $q$ SELECT * FROM project_create('x', '[1]') $q$, 'check');
SELECT pg_temp.fails('a huge project is refused', $q$ SELECT * FROM project_create('big', jsonb_build_object('x', repeat('a', 700000))) $q$, 'check');
SELECT pg_temp.fails('names over 80 characters are refused', $q$ SELECT * FROM project_create(repeat('n', 81), '{}') $q$, 'check');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
SELECT pg_temp.expect('another user cannot see the project', (SELECT count(*) FROM projects) = 0);
SELECT pg_temp.fails('another user cannot save into it', $q$ SELECT project_save((SELECT id FROM t_p), 'mine now', '{}', 2) $q$, 'not_found');
DELETE FROM projects WHERE id = (SELECT id FROM t_p);
RESET ROLE;
SELECT pg_temp.expect('another user cannot delete it', (SELECT count(*) FROM projects WHERE id = (SELECT id FROM t_p)) = 1);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
DELETE FROM projects WHERE id = (SELECT id FROM t_p);
SELECT pg_temp.expect('the owner can delete it', (SELECT count(*) FROM projects) = 0);
-- 50 project limit
DO $$ BEGIN FOR i IN 1..50 LOOP PERFORM project_create('p' || i, '{}'); END LOOP; END $$;
SELECT pg_temp.fails('the 51st project is refused', $q$ SELECT * FROM project_create('one too many', '{}') $q$, 'project_limit');
RESET ROLE;
SET ROLE anon;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
SELECT set_config('request.jwt.claims', '{"is_anonymous":true}', false);
SELECT pg_temp.fails('guest (anonymous sign-in) accounts cannot store projects', $q$ SELECT * FROM project_create('x', '{}') $q$, 'account_required');
SELECT set_config('request.jwt.claims', '', false);
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails('anonymous callers cannot create projects', $q$ SELECT * FROM project_create('x', '{}') $q$, 'permission denied');
RESET ROLE;

-- ================================================================ user settings
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
INSERT INTO user_settings (user_id, onboarding) VALUES (auth.uid(), '{"dismissed":true}');
UPDATE user_settings SET onboarding = '{"dismissed":false}' WHERE user_id = auth.uid();
SELECT pg_temp.expect('a user can keep their own onboarding flags', (SELECT onboarding->>'dismissed' FROM user_settings) = 'false');
SELECT pg_temp.fails('a user cannot write settings for someone else', $q$ INSERT INTO user_settings (user_id) VALUES ('00000000-0000-0000-0000-000000000102') $q$, 'row-level security');
SELECT pg_temp.fails('settings are size limited', $q$ UPDATE user_settings SET onboarding = jsonb_build_object('x', repeat('a', 5000)) $q$, 'check');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
SELECT pg_temp.expect('another user sees none of it', (SELECT count(*) FROM user_settings) = 0);
RESET ROLE;

-- ================================================================ brand kit
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
INSERT INTO brand_kits (user_id, handle, primary_color, logo_url, sponsor_text) VALUES (auth.uid(), '@subway.takes', '#12ab34', 'https://x.supabase.co/storage/v1/object/public/media/00000000-0000-0000-0000-000000000101/logo.png', 'Brought to you by Acme');
SELECT pg_temp.expect('a valid brand kit saves', (SELECT show_watermark FROM brand_kits) = true);
SELECT pg_temp.fails('a bad colour is refused', $q$ UPDATE brand_kits SET primary_color = 'red' $q$, 'check');
SELECT pg_temp.fails('a handle with markup characters is refused', $q$ UPDATE brand_kits SET handle = '<script>' $q$, 'check');
SELECT pg_temp.fails('a logo with a user@host trick is refused', $q$ UPDATE brand_kits SET logo_url = 'https://x.supabase.co@evil.example/storage/v1/object/public/media/00000000-0000-0000-0000-000000000101/logo.png' $q$, 'check');
SELECT pg_temp.fails('a logo path with dot-dot is refused', $q$ UPDATE brand_kits SET logo_url = 'https://x.supabase.co/storage/v1/object/public/media/00000000-0000-0000-0000-000000000101/..%2f..%2fx.png' $q$, 'check');
SELECT pg_temp.fails('a logo from someone else''s folder is refused', $q$ UPDATE brand_kits SET logo_url = 'https://x.supabase.co/storage/v1/object/public/media/00000000-0000-0000-0000-000000000102/logo.png' $q$, 'check');
SELECT pg_temp.fails('an http logo is refused', $q$ UPDATE brand_kits SET logo_url = 'http://x.supabase.co/storage/v1/object/public/media/00000000-0000-0000-0000-000000000101/logo.png' $q$, 'check');
SELECT pg_temp.fails('a logo outside the media bucket is refused', $q$ UPDATE brand_kits SET logo_url = 'https://evil.example/logo.png' $q$, 'check');
SELECT pg_temp.fails('a long sponsor line is refused', $q$ UPDATE brand_kits SET sponsor_text = repeat('s', 81) $q$, 'check');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', false);
SELECT pg_temp.expect('another user cannot read it', (SELECT count(*) FROM brand_kits) = 0);
RESET ROLE;

-- ================================================================ dubbing pipeline value
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
INSERT INTO clip_jobs (user_id, pipeline, model) VALUES (auth.uid(), 'dub', 'sync-lipsync');
SELECT pg_temp.expect('clip_jobs accepts the dub pipeline', (SELECT count(*) FROM clip_jobs WHERE pipeline = 'dub') = 1);
SELECT pg_temp.fails('and still refuses an unknown one', $q$ INSERT INTO clip_jobs (user_id, pipeline, model) VALUES (auth.uid(), 'nope', 'x') $q$, 'check');
RESET ROLE;

-- ================================================================ referrals
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000111', false);
CREATE TEMP TABLE t_code AS SELECT my_referral()->>'code' AS code;
RESET ROLE;
SELECT pg_temp.expect('a referrer gets an 8 character code, and the same one next time', (SELECT code FROM t_code) ~ '^[A-Z0-9]{8}$' AND (SELECT my_referral() IS NOT NULL));
SELECT pg_temp.fails('you cannot claim your own code', $q$ SELECT referral_claim('00000000-0000-0000-0000-000000000111', (SELECT code FROM t_code)) $q$, 'self_referral');
SELECT pg_temp.fails('an unknown code is refused', $q$ SELECT referral_claim('00000000-0000-0000-0000-000000000112', 'ZZZZZZZZ') $q$, 'unknown_code');
SELECT pg_temp.expect('a new account can claim a code (case-insensitive)', referral_claim(:e1, lower((SELECT code FROM t_code))) = 'claimed');
SELECT pg_temp.fails('only one claim per account', $q$ SELECT referral_claim('00000000-0000-0000-0000-000000000112', (SELECT code FROM t_code)) $q$, 'already_claimed');
SELECT pg_temp.expect('claiming grants nothing', pg_temp.balance(:e1) = 0 AND pg_temp.balance(:rr) = 0);

-- an existing customer cannot be "referred"
SELECT pg_temp.buy(:e3, 'credits_s', 'cs_old', 'pi_old');
SELECT pg_temp.fails('an account that already bought cannot claim a code', $q$ SELECT referral_claim('00000000-0000-0000-0000-000000000114', (SELECT code FROM t_code)) $q$, 'not_new_customer');

-- the reward: first purchase of at least the minimum
SELECT pg_temp.expect('the first purchase is fulfilled', pg_temp.buy(:e1, 'credits_s', 'cs_ref1', 'pi_ref1') = 'fulfilled');
SELECT pg_temp.expect('referrer and referee are rewarded from the real purchase', pg_temp.balance(:rr) = 300 AND pg_temp.balance(:e1) = 1000 + 200);
SELECT pg_temp.expect('rewards are capped by order size (30 percent of 1000 credits = 300)', (SELECT referrer_reward FROM referrals WHERE referee_id = :e1) = 300 AND (SELECT referee_reward FROM referrals WHERE referee_id = :e1) = 200);
SELECT pg_temp.expect('the referral is marked rewarded against that order', (SELECT status FROM referrals WHERE referee_id = :e1) = 'rewarded' AND (SELECT reward_order_id FROM referrals WHERE referee_id = :e1) = (SELECT id FROM orders WHERE stripe_session_id = 'cs_ref1'));
SELECT pg_temp.expect('a second purchase earns nothing more', pg_temp.buy(:e1, 'credits_s', 'cs_ref2', 'pi_ref2') = 'fulfilled' AND pg_temp.balance(:rr) = 300 AND pg_temp.balance(:e1) = 2200);
SELECT pg_temp.expect('a duplicate webhook delivery cannot reward twice', order_fulfil('cs_ref1', 'pi_ref1', 1000, 'usd') = 'already' AND pg_temp.balance(:rr) = 300);

-- reversal takes the rewards back
SELECT pg_temp.expect('refunding the rewarded order reverses it', order_reverse('pi_ref1', 'refunded', 'test') = 'reversed');
SELECT pg_temp.expect('both rewards are taken back, never below zero', pg_temp.balance(:rr) = 0 AND pg_temp.balance(:e1) = 2200 - 1000 - 200 AND (SELECT status FROM referrals WHERE referee_id = :e1) = 'void');

-- a reward can never exceed the sale: a small order caps it
UPDATE referral_settings SET max_reward_pct = 10;
SELECT referral_claim(:p3, (SELECT code FROM t_code));
SELECT pg_temp.buy(:p3, 'credits_s', 'cs_pct', 'pi_pct');
SELECT pg_temp.expect('with a 10 percent cap a 1000-credit order rewards at most 100 each', (SELECT referrer_reward FROM referrals WHERE referee_id = :p3) = 100 AND (SELECT referee_reward FROM referrals WHERE referee_id = :p3) = 100);
SELECT pg_temp.expect('refunding it after the credits are spent records the unrecoverable reward', (SELECT order_reverse('pi_pct', 'refunded', 'x')) = 'reversed');
UPDATE referral_settings SET max_reward_pct = 30;

-- reciprocal claims are refused
INSERT INTO referral_codes (user_id, code) VALUES (:e1, 'RECIPRO1');
SELECT pg_temp.fails('A referring B and B referring A is refused', $q$ SELECT referral_claim('00000000-0000-0000-0000-000000000111', 'RECIPRO1') $q$, 'reciprocal_referral');

-- minimum order, cap and switch
UPDATE referral_settings SET min_order_cents = 5000;
SELECT referral_claim(:e2, (SELECT code FROM t_code));
SELECT pg_temp.buy(:e2, 'credits_s', 'cs_small', 'pi_small');
SELECT pg_temp.expect('a purchase below the minimum earns no reward', pg_temp.balance(:rr) = 0 AND (SELECT status FROM referrals WHERE referee_id = :e2) = 'claimed');
UPDATE referral_settings SET min_order_cents = 1000, max_rewards_per_referrer = 0;
SELECT pg_temp.expect('a referrer at the cap earns nothing (void)', pg_temp.buy(:p2, 'credits_s', 'cs_cap0', 'pi_cap0') = 'fulfilled');
UPDATE referral_settings SET max_rewards_per_referrer = 20, enabled = false;
SELECT pg_temp.fails('claims are refused while referrals are switched off', $q$ SELECT referral_claim('00000000-0000-0000-0000-000000000103', (SELECT code FROM t_code)) $q$, 'referrals_disabled');
UPDATE referral_settings SET enabled = true;

-- access control
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000112', false);
SELECT pg_temp.fails('users cannot call referral_claim', $q$ SELECT referral_claim(auth.uid(), 'AAAAAAAA') $q$, 'permission denied');
SELECT pg_temp.fails('users cannot call the reward trigger function', $q$ SELECT referral_on_paid() $q$, 'permission denied');
SELECT pg_temp.fails('users cannot read the stats', $q$ SELECT retention_stats() $q$, 'permission denied');
SELECT pg_temp.fails('users cannot change reward settings', $q$ UPDATE referral_settings SET referrer_reward = 100000 $q$, 'permission denied');
SELECT pg_temp.expect('a referee sees their own referral row but not other people''s', (SELECT count(*) FROM referrals WHERE referee_id <> auth.uid() AND referrer_id <> auth.uid()) = 0);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', false);
SELECT pg_temp.expect('an unrelated user sees no referrals', (SELECT count(*) FROM referrals) = 0);
RESET ROLE;

-- ================================================================ operator numbers and invariants
SELECT pg_temp.expect('retention stats report buyers, projects and referrals', (retention_stats()->>'paying_users')::int >= 3 AND (retention_stats()->>'projects_saved')::int = 50 AND (retention_stats()->>'referrals_rewarded')::int = 0 AND (retention_stats()->>'referrals_claimed')::int >= 2);
SELECT pg_temp.expect('for EVERY user, balance = sum(ledger) after rewards and reversals', NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.credits_balance IS DISTINCT FROM (SELECT COALESCE(sum(delta), 0) FROM credit_ledger l WHERE l.user_id = p.id)));
SELECT pg_temp.expect('no balance is negative', NOT EXISTS (SELECT 1 FROM user_profiles WHERE credits_balance < 0));
