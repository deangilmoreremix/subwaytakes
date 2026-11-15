-- Assertions for 20261121000000_checkout_entitlements.sql. Run after bootstrap, the credits migration, this migration and credits.sql.
\set ON_ERROR_STOP on
\set u1 '''00000000-0000-0000-0000-0000000000f1'''
\set u2 '''00000000-0000-0000-0000-0000000000f2'''

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

INSERT INTO auth.users (id, email) VALUES (:u1, 'buyer@example.com'), (:u2, 'other@example.com');
INSERT INTO user_profiles (id) VALUES (:u1), (:u2);

SELECT pg_temp.expect('placeholder catalogue is seeded', (SELECT count(*) FROM products) >= 7);

-- ================================================================ ordering: the price comes from the table
CREATE TEMP TABLE t_order AS SELECT * FROM order_create_pending(:u1, 'starter');
SELECT pg_temp.expect('pending order snapshots price from products', (SELECT amount_cents FROM t_order) = 3700 AND (SELECT currency FROM t_order) = 'usd');
SELECT pg_temp.fails('unknown product is refused', $q$ SELECT * FROM order_create_pending('00000000-0000-0000-0000-0000000000f1', 'nope') $q$, 'unknown_product');
UPDATE products SET active = false WHERE key = 'credits_l';
SELECT pg_temp.fails('inactive product is refused', $q$ SELECT * FROM order_create_pending('00000000-0000-0000-0000-0000000000f1', 'credits_l') $q$, 'unknown_product');
UPDATE products SET active = true WHERE key = 'credits_l';
SELECT order_attach_session((SELECT order_id FROM t_order), 'cs_1');
SELECT order_attach_session((SELECT order_id FROM t_order), 'cs_other');
SELECT pg_temp.expect('a session id attaches once', (SELECT stripe_session_id FROM orders WHERE id = (SELECT order_id FROM t_order)) = 'cs_1');

-- the price changing after the order does not change what this order costs
UPDATE products SET price_cents = 1500 WHERE key = 'starter';
SELECT pg_temp.expect('order keeps its own price snapshot', (SELECT amount_cents FROM orders WHERE id = (SELECT order_id FROM t_order)) = 3700);
UPDATE products SET price_cents = 3700 WHERE key = 'starter';

-- ================================================================ fulfilment
SELECT pg_temp.fails('wrong amount grants nothing', $q$ SELECT order_fulfil('cs_1', 'pi_1', 100, 'usd') $q$, 'amount_mismatch');
SELECT pg_temp.fails('wrong currency grants nothing', $q$ SELECT order_fulfil('cs_1', 'pi_1', 3700, 'eur') $q$, 'amount_mismatch');
SELECT pg_temp.fails('unknown session is refused', $q$ SELECT order_fulfil('cs_nope', 'pi_x', 3700, 'usd') $q$, 'order_not_found');
SELECT pg_temp.expect('nothing was granted by the failed attempts', pg_temp.balance(:u1) = 0);
SELECT pg_temp.expect('fulfilment grants the credits', order_fulfil('cs_1', 'pi_1', 3700, 'USD') = 'fulfilled' AND pg_temp.balance(:u1) = 2000);
SELECT pg_temp.expect('a duplicate delivery grants nothing more', order_fulfil('cs_1', 'pi_1', 3700, 'usd') = 'already' AND pg_temp.balance(:u1) = 2000);
SELECT pg_temp.expect('the grant is in the ledger tied to the order', (SELECT count(*) FROM credit_ledger WHERE user_id = :u1 AND kind = 'grant' AND ref = 'order:' || (SELECT order_id FROM t_order)::text) = 1);

-- ================================================================ entitlements
CREATE TEMP TABLE t_pro AS SELECT * FROM order_create_pending(:u1, 'pro_pack');
SELECT order_attach_session((SELECT order_id FROM t_pro), 'cs_pro');
SELECT order_fulfil('cs_pro', 'pi_pro', 9700, 'usd');
SELECT pg_temp.expect('bundle unlocks its entitlement and credits', entitlements_for(:u1) = ARRAY['pro_pack'] AND pg_temp.balance(:u1) = 3000);
INSERT INTO products (key, kind, name, price_cents, credits, entitlements) VALUES ('only_ent', 'bundle', 'Only unlock', 1000, 0, '{pro_pack}');
SELECT pg_temp.fails('a bundle that gives only owned unlocks is refused', $q$ SELECT * FROM order_create_pending('00000000-0000-0000-0000-0000000000f1', 'only_ent') $q$, 'already_owned');
SELECT pg_temp.fails('a bundle with credits cannot be bought twice either', $q$ SELECT * FROM order_create_pending('00000000-0000-0000-0000-0000000000f1', 'pro_pack') $q$, 'already_owned');
SELECT pg_temp.expect('credit packs can be bought repeatedly', (SELECT count(*) FROM order_create_pending('00000000-0000-0000-0000-0000000000f1', 'credits_s')) = 1);
SELECT pg_temp.expect('another user has no entitlements', entitlements_for(:u2) = '{}');

-- ================================================================ refund: revoke, claw back what is unspent, never negative
SELECT pg_temp.expect('refund reverses once', order_reverse('pi_pro', 'refunded', 'customer asked') = 'reversed' AND order_reverse('pi_pro', 'refunded', 'again') = 'already');
SELECT pg_temp.expect('refund revoked the entitlement and took back its credits', entitlements_for(:u1) = '{}' AND pg_temp.balance(:u1) = 2000);
SELECT pg_temp.expect('refund recorded exactly in the order', (SELECT credits_clawed FROM orders WHERE stripe_payment_intent = 'pi_pro') = 1000 AND (SELECT clawback_shortfall FROM orders WHERE stripe_payment_intent = 'pi_pro') = 0);
SELECT pg_temp.expect('a dispute after a refund is a no-op', order_reverse('pi_pro', 'disputed', 'x') = 'already' AND pg_temp.balance(:u1) = 2000);
SELECT pg_temp.expect('events for payments we do not know are reported, not errors', order_reverse('pi_unknown', 'refunded', 'x') = 'unknown');

-- spent credits cannot be taken back: the balance never goes negative and the shortfall is recorded
CREATE TEMP TABLE t_s AS SELECT * FROM order_create_pending(:u2, 'credits_s');
SELECT order_attach_session((SELECT order_id FROM t_s), 'cs_s');
SELECT order_fulfil('cs_s', 'pi_s', 1000, 'usd');
SELECT credit_apply(:u2, -700, 'adjust', 'simulate spending', 'spent-1');
SELECT pg_temp.expect('user spent most of the pack', pg_temp.balance(:u2) = 300);
SELECT pg_temp.expect('dispute takes back only what is left', order_reverse('pi_s', 'disputed', 'chargeback') = 'reversed' AND pg_temp.balance(:u2) = 0);
SELECT pg_temp.expect('shortfall is recorded for the operator', (SELECT credits_clawed FROM orders WHERE stripe_payment_intent = 'pi_s') = 300 AND (SELECT clawback_shortfall FROM orders WHERE stripe_payment_intent = 'pi_s') = 700 AND (billing_stats()->>'clawback_shortfall_credits')::int = 700);
SELECT pg_temp.expect('a refunded purchase can be bought again and granted again', (SELECT count(*) FROM order_create_pending(:u1, 'pro_pack')) = 1);

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000f4', 'dual@example.com');
INSERT INTO user_profiles (id) VALUES ('00000000-0000-0000-0000-0000000000f4');
-- an entitlement also granted by another paid order survives a refund of one of them
INSERT INTO products (key, kind, name, price_cents, credits, entitlements) VALUES ('pro_b', 'bundle', 'Pro B', 2000, 10, '{pro_pack,extra_b}');
CREATE TEMP TABLE t_a AS SELECT * FROM order_create_pending('00000000-0000-0000-0000-0000000000f4', 'pro_pack');
SELECT order_attach_session((SELECT order_id FROM t_a), 'cs_a'); SELECT order_fulfil('cs_a', 'pi_a', 9700, 'usd');
CREATE TEMP TABLE t_b AS SELECT * FROM order_create_pending('00000000-0000-0000-0000-0000000000f4', 'pro_b');
SELECT order_attach_session((SELECT order_id FROM t_b), 'cs_b'); SELECT order_fulfil('cs_b', 'pi_b', 2000, 'usd');
SELECT order_reverse('pi_a', 'refunded', 'x');
SELECT pg_temp.expect('refunding one of two paid orders keeps the unlock the other still pays for', entitlements_for('00000000-0000-0000-0000-0000000000f4') = ARRAY['extra_b', 'pro_pack']);
SELECT order_reverse('pi_b', 'refunded', 'x');
SELECT pg_temp.expect('refunding the last one removes it', entitlements_for('00000000-0000-0000-0000-0000000000f4') = '{}');

-- ================================================================ out-of-order events: refund/dispute BEFORE fulfilment
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000000000f3', 'early@example.com');
INSERT INTO user_profiles (id) VALUES ('00000000-0000-0000-0000-0000000000f3');
CREATE TEMP TABLE t_e AS SELECT * FROM order_create_pending('00000000-0000-0000-0000-0000000000f3', 'pro_pack');
SELECT order_attach_session((SELECT order_id FROM t_e), 'cs_early');
SELECT pg_temp.expect('a reversal for a payment we cannot match yet reports unknown', order_reverse('pi_early', 'refunded', 'refund first') = 'unknown');
SELECT pg_temp.expect('and is remembered', (SELECT count(*) FROM pending_reversals WHERE stripe_payment_intent = 'pi_early') = 1);
SELECT pg_temp.expect('the late fulfilment grants nothing and records the reversal', order_fulfil('cs_early', 'pi_early', 9700, 'usd') = 'reversed_before_fulfil');
SELECT pg_temp.expect('no credits or unlocks for a payment that was already refunded', pg_temp.balance('00000000-0000-0000-0000-0000000000f3') = 0 AND entitlements_for('00000000-0000-0000-0000-0000000000f3') = '{}' AND (SELECT status FROM orders WHERE stripe_payment_intent = 'pi_early') = 'refunded' AND NOT EXISTS (SELECT 1 FROM pending_reversals WHERE stripe_payment_intent = 'pi_early'));
SELECT pg_temp.expect('and it is not granted again by a replay', order_fulfil('cs_early', 'pi_early', 9700, 'usd') = 'already' AND pg_temp.balance('00000000-0000-0000-0000-0000000000f3') = 0);

-- ================================================================ chargeback abuse and price sanity
SELECT pg_temp.fails('after a dispute, new checkouts are refused', $q$ SELECT * FROM order_create_pending('00000000-0000-0000-0000-0000000000f2', 'credits_s') $q$, 'billing_blocked');
SELECT pg_temp.fails('a product cannot sell absurd credits for its price', $q$ UPDATE products SET credits = 1000000 WHERE key = 'credits_s' $q$, 'check');
SELECT pg_temp.expect('the commercial licence is not on sale (nothing enforces it yet)', (SELECT NOT active FROM products WHERE key = 'commercial'));
SELECT billing_audit_write('00000000-0000-0000-0000-0000000000f1', 'test', '{"a":1}');
SELECT pg_temp.expect('audit rows are written', (SELECT count(*) FROM billing_audit WHERE action = 'test') = 1);

-- ================================================================ operator entitlement grants
SELECT entitlement_set(:u2, 'recast', true);
SELECT pg_temp.expect('operator grant adds the entitlement', entitlements_for(:u2) = ARRAY['recast']);
SELECT entitlement_set(:u2, 'recast', false);
SELECT pg_temp.expect('operator revoke removes it', entitlements_for(:u2) = '{}');

-- ================================================================ event log
SELECT pg_temp.expect('first delivery is recorded', stripe_event_record('evt_1', 'x', 'processed'));
SELECT pg_temp.expect('a duplicate delivery is detected', NOT stripe_event_record('evt_1', 'x', 'processed') AND stripe_event_seen('evt_1'));
SELECT stripe_event_record('evt_2', 'checkout.session.completed', 'needs_attention', 'no order');
SELECT pg_temp.expect('needs-attention events are counted for the operator', (billing_stats()->>'needs_attention')::int = 1);

-- ================================================================ access control
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
SELECT pg_temp.expect('user sees only their own orders', (SELECT count(*) FROM orders) >= 1 AND NOT EXISTS (SELECT 1 FROM orders WHERE user_id <> auth.uid()));
SELECT pg_temp.expect('user sees only their own entitlements', NOT EXISTS (SELECT 1 FROM entitlements WHERE user_id <> auth.uid()));
SELECT pg_temp.expect('user can read active products', (SELECT count(*) FROM products) >= 5);
SELECT pg_temp.fails('user cannot change a price', $q$ UPDATE products SET price_cents = 50 WHERE key = 'starter' $q$, 'permission denied');
SELECT pg_temp.fails('user cannot create an order', $q$ INSERT INTO orders (user_id, product_key, product_name, amount_cents, currency, credits, entitlements) VALUES (auth.uid(), 'starter', 'x', 1, 'usd', 99999, '{}') $q$, 'permission denied');
SELECT pg_temp.fails('user cannot mark an order paid', $q$ UPDATE orders SET status = 'paid' $q$, 'permission denied');
SELECT pg_temp.fails('user cannot grant themselves an entitlement', $q$ INSERT INTO entitlements (user_id, key) VALUES (auth.uid(), 'pro_pack') $q$, 'permission denied');
SELECT pg_temp.fails('user cannot read the Stripe event log', $q$ SELECT * FROM stripe_events $q$, 'permission denied');
SELECT pg_temp.fails('user cannot call order_fulfil', $q$ SELECT order_fulfil('cs_1', 'pi_1', 3700, 'usd') $q$, 'permission denied');
SELECT pg_temp.fails('user cannot call order_create_pending', $q$ SELECT * FROM order_create_pending(auth.uid(), 'starter') $q$, 'permission denied');
SELECT pg_temp.fails('user cannot call entitlement_set', $q$ SELECT entitlement_set(auth.uid(), 'pro_pack', true) $q$, 'permission denied');
SELECT pg_temp.fails('user cannot read the audit trail', $q$ SELECT * FROM billing_audit $q$, 'permission denied');
SELECT pg_temp.fails('user cannot read pending reversals', $q$ SELECT * FROM pending_reversals $q$, 'permission denied');
SELECT pg_temp.fails('user cannot read billing stats', $q$ SELECT billing_stats() $q$, 'permission denied');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails('anonymous cannot read products', $q$ SELECT * FROM products $q$, 'permission denied');
RESET ROLE;

-- ================================================================ global invariants (the ledger still balances after purchases and clawbacks)
SELECT pg_temp.expect('for EVERY user, balance = sum(ledger)', NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.credits_balance IS DISTINCT FROM (SELECT COALESCE(sum(delta), 0) FROM credit_ledger l WHERE l.user_id = p.id)));
SELECT pg_temp.expect('no balance is negative', NOT EXISTS (SELECT 1 FROM user_profiles WHERE credits_balance < 0));
