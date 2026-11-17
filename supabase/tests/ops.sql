-- Assertions for 20261123000000_launch_ops.sql. Run after bootstrap and all migrations.
\set ON_ERROR_STOP on
\set o1 '''00000000-0000-0000-0000-000000000201'''
\set o2 '''00000000-0000-0000-0000-000000000202'''

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

INSERT INTO auth.users (id, email) VALUES (:o1, 'ops1@example.com'), (:o2, 'ops2@example.com');
INSERT INTO user_profiles (id) VALUES (:o1), (:o2);

-- ================================================================ consent records
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', false);
INSERT INTO consents (user_id, kind, version) VALUES (auth.uid(), 'face_upload', '1');
SELECT pg_temp.expect('a user can record their own consent and read it back', (SELECT count(*) FROM consents) = 1);
SELECT pg_temp.fails('consent cannot be recorded for someone else', $q$ INSERT INTO consents (user_id, kind, version) VALUES ('00000000-0000-0000-0000-000000000202', 'face_upload', '1') $q$, 'row-level security');
SELECT pg_temp.fails('a consent record cannot be edited', $q$ UPDATE consents SET version = '2' $q$, 'permission denied');
SELECT pg_temp.fails('or deleted by the user', $q$ DELETE FROM consents $q$, 'permission denied');
SELECT pg_temp.fails('the same version cannot be recorded twice (the first acceptance time stands)', $q$ INSERT INTO consents (user_id, kind, version) VALUES (auth.uid(), 'face_upload', '1') $q$, 'duplicate key');
SELECT pg_temp.fails('only known consent kinds are accepted', $q$ INSERT INTO consents (user_id, kind, version) VALUES (auth.uid(), 'anything', '1') $q$, 'check');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', false);
SELECT pg_temp.expect('another user sees none of it', (SELECT count(*) FROM consents) = 0);
RESET ROLE;

-- ================================================================ browser error reports
SELECT set_config('request.jwt.claim.sub', '', false);   -- no signed-in user for the visitor tests
SET ROLE anon;
SELECT pg_temp.expect('a visitor can report a browser error', client_error_log('TypeError: x is undefined', 'at a.js:1', 'https://app.test/create'));
SELECT pg_temp.expect('an empty report is ignored, not an error', NOT client_error_log('   '));
SELECT pg_temp.fails('visitors cannot read the log', $q$ SELECT * FROM client_errors $q$, 'permission denied');
SELECT pg_temp.fails('visitors cannot write to it directly', $q$ INSERT INTO client_errors (message) VALUES ('x') $q$, 'permission denied');
RESET ROLE;
SELECT client_error_log(repeat('m', 5000), repeat('s', 9000), repeat('u', 2000));
SELECT pg_temp.expect('long fields are cut to size', (SELECT max(char_length(message)) FROM client_errors) = 300 AND (SELECT max(char_length(stack)) FROM client_errors) = 2000 AND (SELECT max(char_length(url)) FROM client_errors) = 300);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', false);
DO $$ DECLARE ok integer := 0; i integer; BEGIN FOR i IN 1..14 LOOP IF client_error_log('flood ' || i) THEN ok := ok + 1; END IF; END LOOP; IF ok <> 10 THEN RAISE EXCEPTION 'FAIL: per-user cap allowed % reports', ok; END IF; RAISE NOTICE 'PASS: one signed-in user can file at most 10 reports a minute'; END $$;
SELECT pg_temp.fails('signed-in users cannot read other people''s error reports', $q$ SELECT * FROM client_errors $q$, 'permission denied');
RESET ROLE;

-- ================================================================ alerts: one open per kind, refreshed, cleared, resolved
SELECT pg_temp.expect('a new alert is reported as new', ops_alert_raise('stuck_holds', 'warn', '7 holds', '{"holds":7}'));
SELECT pg_temp.expect('the same problem again refreshes it instead of adding another', NOT ops_alert_raise('stuck_holds', 'critical', '9 holds', '{"holds":9}'));
SELECT pg_temp.expect('there is still exactly one open alert for it, with the latest numbers', (SELECT count(*) FROM ops_alerts WHERE kind = 'stuck_holds' AND resolved_at IS NULL) = 1 AND (SELECT detail->>'holds' FROM ops_alerts WHERE kind = 'stuck_holds') = '9' AND (SELECT severity FROM ops_alerts WHERE kind = 'stuck_holds') = 'critical');
SELECT ops_alert_raise('refund_spike', 'warn', 'spike');
SELECT pg_temp.expect('a different problem is its own alert', (SELECT count(*) FROM ops_alerts WHERE resolved_at IS NULL) = 2);
SELECT pg_temp.expect('clearing closes the kinds that are no longer active', ops_alert_clear_except(ARRAY['refund_spike']) = 1);
SELECT pg_temp.expect('and keeps the active kind open', (SELECT count(*) FROM ops_alerts WHERE resolved_at IS NULL) = 1 AND EXISTS (SELECT 1 FROM ops_alerts WHERE kind = 'refund_spike' AND resolved_at IS NULL));
SELECT pg_temp.expect('a cleared problem that returns raises a NEW alert', ops_alert_raise('stuck_holds', 'warn', 'again'));
SELECT pg_temp.expect('an alert can be resolved by an operator, once', ops_alert_resolve((SELECT id FROM ops_alerts WHERE kind = 'refund_spike' AND resolved_at IS NULL), :o1));
SELECT pg_temp.expect('and resolving it again does nothing', NOT ops_alert_resolve((SELECT id FROM ops_alerts WHERE kind = 'refund_spike' ORDER BY id DESC LIMIT 1), :o1));
SELECT ops_alert_clear_except('{}');
SELECT pg_temp.expect('clearing with an empty list closes everything', (SELECT count(*) FROM ops_alerts WHERE resolved_at IS NULL) = 0);

-- housekeeping
INSERT INTO client_errors (message, created_at) VALUES ('old', now() - interval '30 days');
INSERT INTO ops_alerts (kind, severity, message, resolved_at) VALUES ('ancient', 'info', 'x', now() - interval '120 days');
SELECT pg_temp.expect('pruning reports what it removed', ops_prune() >= 2);
SELECT pg_temp.expect('old browser errors and old resolved alerts are gone', NOT EXISTS (SELECT 1 FROM client_errors WHERE message = 'old') AND NOT EXISTS (SELECT 1 FROM ops_alerts WHERE kind = 'ancient'));

-- ================================================================ metrics
SELECT pg_temp.expect('metrics report the numbers the alert rules read', (ops_metrics() ?& ARRAY['drifted_users', 'negative_balances', 'stuck_holds', 'stale_calls', 'calls_24h', 'failed_calls_24h', 'paid_orders_24h', 'reversed_orders_24h', 'needs_attention_24h', 'client_errors_1h', 'open_alerts']));
SELECT pg_temp.expect('no account has drifted from its ledger and none is negative', (ops_metrics()->>'drifted_users')::int = 0 AND (ops_metrics()->>'negative_balances')::int = 0);

-- ================================================================ access control
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', false);
SELECT pg_temp.fails('users cannot read metrics', $q$ SELECT ops_metrics() $q$, 'permission denied');
SELECT pg_temp.fails('users cannot raise or resolve alerts', $q$ SELECT ops_alert_raise('x', 'info', 'y') $q$, 'permission denied');
SELECT pg_temp.fails('users cannot read alerts', $q$ SELECT * FROM ops_alerts $q$, 'permission denied');
SELECT pg_temp.fails('users cannot read or change the blocked-terms list', $q$ SELECT * FROM safety_terms $q$, 'permission denied');
SELECT pg_temp.fails('users cannot add a blocked term', $q$ INSERT INTO safety_terms (term) VALUES ('anything') $q$, 'permission denied');
SELECT pg_temp.fails('users cannot prune', $q$ SELECT ops_prune() $q$, 'permission denied');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails('visitors cannot read metrics', $q$ SELECT ops_metrics() $q$, 'permission denied');
RESET ROLE;
INSERT INTO safety_terms (term) VALUES ('jane roe');
SELECT pg_temp.expect('the operator can add a blocked term', (SELECT count(*) FROM safety_terms) = 1);
SELECT pg_temp.fails('a one-letter term is refused', $q$ INSERT INTO safety_terms (term) VALUES ('x') $q$, 'check');
