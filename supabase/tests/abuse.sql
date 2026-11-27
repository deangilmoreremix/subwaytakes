-- Abuse and privilege audit. Run after bootstrap and ALL migrations. It does not test one feature: it checks the whole database surface
-- from the point of view of a hostile signed-in user and a hostile visitor, so a new table or function that quietly opens a door fails here.
\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.expect(name text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %', name; END IF; RAISE NOTICE 'PASS: %', name; END $$;

-- ================================================================ 1. which functions can clients call at all?
-- Allowlist: the only functions a signed-in user or a visitor may execute. Anything else (every money, order, reward and ops function) is service_role only.
CREATE TEMP TABLE t_auth_fns AS
  SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
CREATE TEMP TABLE t_anon_fns AS
  SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND has_function_privilege('anon', p.oid, 'EXECUTE');

SELECT pg_temp.expect('signed-in users can execute ONLY the allowlisted functions (found: ' || COALESCE((SELECT string_agg(proname, ', ' ORDER BY proname) FROM t_auth_fns WHERE proname NOT IN ('client_error_log', 'my_referral', 'project_create', 'project_save')), 'none unexpected') || ')',
  NOT EXISTS (SELECT 1 FROM t_auth_fns WHERE proname NOT IN ('client_error_log', 'my_referral', 'project_create', 'project_save')));
SELECT pg_temp.expect('visitors can execute only the error reporter (found: ' || COALESCE((SELECT string_agg(proname, ', ' ORDER BY proname) FROM t_anon_fns WHERE proname <> 'client_error_log'), 'none unexpected') || ')',
  NOT EXISTS (SELECT 1 FROM t_anon_fns WHERE proname <> 'client_error_log'));
SELECT pg_temp.expect('the legacy client-callable balance functions are gone from client reach',
  NOT EXISTS (SELECT 1 FROM t_auth_fns WHERE proname IN ('deduct_credits', 'atomic_deduct_tokens', 'credit_apply', 'credit_reserve', 'order_fulfil', 'order_reverse', 'entitlement_set', 'referral_claim')));

-- ================================================================ 2. which tables can clients write?
CREATE TEMP TABLE t_writes AS
  SELECT grantee, table_name, privilege_type FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND grantee IN ('authenticated', 'anon', 'PUBLIC') AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
SELECT pg_temp.expect('no table grants write access to PUBLIC (everyone)', NOT EXISTS (SELECT 1 FROM t_writes WHERE grantee = 'PUBLIC'));

SELECT pg_temp.expect('visitors have no write privilege on any table (found: ' || COALESCE((SELECT string_agg(table_name || ':' || privilege_type, ', ') FROM t_writes WHERE grantee = 'anon'), 'none') || ')',
  NOT EXISTS (SELECT 1 FROM t_writes WHERE grantee = 'anon'));
SELECT pg_temp.expect('signed-in users can write only the tables they own (found extra: ' || COALESCE((SELECT string_agg(table_name || ':' || privilege_type, ', ') FROM t_writes WHERE grantee = 'authenticated' AND NOT (
    (table_name = 'clip_jobs' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')) OR (table_name = 'consents' AND privilege_type = 'INSERT') OR (table_name = 'brand_kits' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
    OR (table_name = 'user_settings' AND privilege_type IN ('INSERT', 'UPDATE')) OR (table_name = 'projects' AND privilege_type = 'DELETE'))), 'none') || ')',
  NOT EXISTS (SELECT 1 FROM t_writes WHERE grantee = 'authenticated' AND NOT (
    (table_name = 'clip_jobs' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')) OR (table_name = 'consents' AND privilege_type = 'INSERT') OR (table_name = 'brand_kits' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE'))
    OR (table_name = 'user_settings' AND privilege_type IN ('INSERT', 'UPDATE')) OR (table_name = 'projects' AND privilege_type = 'DELETE'))));

-- the profile: a user may edit harmless columns but never the balance or tier
SELECT pg_temp.expect('no client can write the credit balance or the plan tier',
  NOT EXISTS (SELECT 1 FROM information_schema.column_privileges WHERE table_schema = 'public' AND table_name = 'user_profiles' AND grantee IN ('authenticated', 'anon') AND column_name IN ('credits_balance', 'subscription_tier') AND privilege_type IN ('INSERT', 'UPDATE')));

-- ================================================================ 3. every table clients can read is protected by row-level security
SELECT pg_temp.expect('every table a client can read has row-level security on (missing: ' || COALESCE((SELECT string_agg(DISTINCT tp.table_name, ', ') FROM information_schema.table_privileges tp JOIN pg_class c ON c.relname = tp.table_name AND c.relnamespace = 'public'::regnamespace
    WHERE tp.table_schema = 'public' AND tp.grantee IN ('authenticated', 'anon', 'PUBLIC') AND tp.privilege_type = 'SELECT' AND NOT c.relrowsecurity), 'none') || ')',
  NOT EXISTS (SELECT 1 FROM information_schema.table_privileges tp JOIN pg_class c ON c.relname = tp.table_name AND c.relnamespace = 'public'::regnamespace
    WHERE tp.table_schema = 'public' AND tp.grantee IN ('authenticated', 'anon', 'PUBLIC') AND tp.privilege_type = 'SELECT' AND NOT c.relrowsecurity));
SELECT pg_temp.expect('money, order, reward and operations tables are invisible to clients (visible: ' || COALESCE((SELECT string_agg(DISTINCT table_name, ', ') FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee IN ('authenticated', 'anon') AND privilege_type = 'SELECT'
    AND table_name IN ('credit_holds', 'muapi_calls', 'gateway_hits', 'gateway_settings', 'model_prices', 'admin_users', 'stripe_events', 'pending_reversals', 'billing_audit', 'referral_settings', 'ops_alerts', 'client_errors', 'safety_terms')), 'none') || ')',
  NOT EXISTS (SELECT 1 FROM information_schema.table_privileges WHERE table_schema = 'public' AND grantee IN ('authenticated', 'anon') AND privilege_type = 'SELECT'
    AND table_name IN ('credit_holds', 'muapi_calls', 'gateway_hits', 'gateway_settings', 'model_prices', 'admin_users', 'stripe_events', 'pending_reversals', 'billing_audit', 'referral_settings', 'ops_alerts', 'client_errors', 'safety_terms')));

-- ================================================================ 4. a signup farm cannot flood the gateway: limits are per account and bite at the configured number
INSERT INTO auth.users (id, email) SELECT ('00000000-0000-0000-0000-0000000003' || lpad(i::text, 2, '0'))::uuid, 'farm' || i || '@example.com' FROM generate_series(1, 20) i;
INSERT INTO user_profiles (id) SELECT ('00000000-0000-0000-0000-0000000003' || lpad(i::text, 2, '0'))::uuid FROM generate_series(1, 20) i;
UPDATE gateway_settings SET max_calls_per_minute = 30, max_free_per_minute = 240;
DO $$
DECLARE u uuid; allowed integer; farm_allowed integer := 0; i integer; k integer; hit_ok boolean;
BEGIN
  FOR i IN 1..20 LOOP
    u := ('00000000-0000-0000-0000-0000000003' || lpad(i::text, 2, '0'))::uuid; allowed := 0;
    FOR k IN 1..300 LOOP
      BEGIN PERFORM credit_hit(u, 'free'); allowed := allowed + 1; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%rate_limited%' THEN RAISE; END IF; END;
    END LOOP;
    IF allowed <> 240 THEN RAISE EXCEPTION 'FAIL: account % was allowed % free calls a minute (limit 240)', i, allowed; END IF;
    farm_allowed := farm_allowed + allowed;
    allowed := 0;
    FOR k IN 1..60 LOOP
      BEGIN PERFORM credit_hit(u, 'submit'); allowed := allowed + 1; EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%rate_limited%' THEN RAISE; END IF; END;
    END LOOP;
    IF allowed <> 30 THEN RAISE EXCEPTION 'FAIL: account % was allowed % paid submits a minute (limit 30)', i, allowed; END IF;
  END LOOP;
  RAISE NOTICE 'PASS: each of 20 farmed accounts is held to 240 free and 30 paid calls a minute, independently (%s total free calls)', farm_allowed;
END $$;

-- a fresh account gets no credits for existing: nothing to spend
SELECT pg_temp.expect('farmed accounts start at zero credits and cannot reserve anything', (SELECT sum(credits_balance) FROM user_profiles WHERE id::text LIKE '00000000-0000-0000-0000-0000000003%') = 0);

-- ================================================================ 5. every SECURITY DEFINER function pins its search_path (otherwise a client-created object could shadow a name it uses)
SELECT pg_temp.expect('every SECURITY DEFINER function in public pins search_path (unpinned: ' || COALESCE((SELECT string_agg(p.proname, ', ') FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%') AND p.proname NOT IN ('deduct_credits', 'atomic_deduct_tokens')), 'none') || ')',
  NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%') AND p.proname NOT IN ('deduct_credits', 'atomic_deduct_tokens')));
