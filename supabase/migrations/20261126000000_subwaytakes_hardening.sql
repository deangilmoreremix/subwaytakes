/*
  SubwayTakes: hardening after review of 20261125000000_subwaytakes_schema.sql. Additive and re-runnable; touches only schema `subwaytakes`
  and this app's own bucket policies (`subwaytakes_*`). Nothing of any other app is changed.

    1. rate_hit: take a per-(user, kind) advisory lock, count, refuse BEFORE inserting. Parallel calls can no longer all pass the check.
    2. media bucket: drop the public SELECT policy on storage.objects. A public bucket still serves a file to anyone who has its exact URL
       (muapi and the video exporter need that), but nobody can LIST or enumerate other people's files through the API any more.
    3. client_error_log: signed-in users only (a signed-out visitor can no longer write to the error table).
*/

CREATE OR REPLACE FUNCTION subwaytakes.rate_hit(p_user uuid, p_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = subwaytakes, pg_temp AS $$
DECLARE n integer; lim integer;
BEGIN
  IF p_kind NOT IN ('free', 'submit') THEN RAISE EXCEPTION 'bad_kind'; END IF;
  lim := CASE WHEN p_kind = 'free' THEN 120 ELSE 30 END;
  -- one caller at a time per user and kind, so the count below always sees every earlier call (held until this transaction ends)
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_kind, 0));
  SELECT count(*) INTO n FROM subwaytakes.rate_hits WHERE user_id = p_user AND kind = p_kind AND at > now() - interval '1 minute';
  IF n >= lim THEN RAISE EXCEPTION 'rate_limited'; END IF;
  INSERT INTO subwaytakes.rate_hits (user_id, kind) VALUES (p_user, p_kind);
  IF random() < 0.02 THEN DELETE FROM subwaytakes.rate_hits WHERE at < now() - interval '1 hour'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION subwaytakes.rate_hit(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION subwaytakes.rate_hit(uuid, text) TO service_role;

DROP POLICY IF EXISTS "subwaytakes_media_public_read" ON storage.objects;

REVOKE EXECUTE ON FUNCTION subwaytakes.client_error_log(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION subwaytakes.client_error_log(text, text, text) TO authenticated, service_role;
