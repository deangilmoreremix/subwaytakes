/*
  # Add Analytics Aggregation RPC

  1. New Functions
    - `get_analytics_summary(p_range_start timestamptz, p_prev_start timestamptz, p_prev_end timestamptz)`
      - Returns aggregated analytics data server-side instead of fetching all rows
      - Counts clips, episodes, exports in range
      - Computes status/type/platform breakdowns
      - Computes average viral score
      - Returns daily clip counts
      - Returns top 5 clips by viral score

  2. Security
    - Function executes as SECURITY INVOKER so RLS applies
    - Only returns data the calling user has access to
*/

CREATE OR REPLACE FUNCTION get_analytics_summary(
  p_range_start timestamptz DEFAULT NULL,
  p_prev_start timestamptz DEFAULT NULL,
  p_prev_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_total_clips bigint;
  v_total_episodes bigint;
  v_total_exports bigint;
  v_clips_in_range bigint;
  v_prev_clips bigint;
  v_episodes_in_range bigint;
  v_exports_in_range bigint;
  v_avg_viral numeric;
  v_status_breakdown jsonb;
  v_type_breakdown jsonb;
  v_platform_breakdown jsonb;
  v_daily_clips jsonb;
  v_top_clips jsonb;
BEGIN
  SELECT count(*) INTO v_total_clips FROM clips;
  SELECT count(*) INTO v_total_episodes FROM episodes;
  SELECT count(*) INTO v_total_exports FROM video_exports;

  IF p_range_start IS NOT NULL THEN
    SELECT count(*) INTO v_clips_in_range FROM clips WHERE created_at >= p_range_start;
    SELECT count(*) INTO v_episodes_in_range FROM episodes WHERE created_at >= p_range_start;
    SELECT count(*) INTO v_exports_in_range FROM video_exports WHERE created_at >= p_range_start;
  ELSE
    v_clips_in_range := v_total_clips;
    v_episodes_in_range := v_total_episodes;
    v_exports_in_range := v_total_exports;
  END IF;

  IF p_prev_start IS NOT NULL AND p_prev_end IS NOT NULL THEN
    SELECT count(*) INTO v_prev_clips FROM clips WHERE created_at >= p_prev_start AND created_at < p_prev_end;
  ELSE
    v_prev_clips := v_total_clips;
  END IF;

  SELECT coalesce(round(avg((viral_score->>'overall')::numeric), 0), 0)
  INTO v_avg_viral
  FROM clips
  WHERE (p_range_start IS NULL OR created_at >= p_range_start)
    AND viral_score IS NOT NULL
    AND (viral_score->>'overall')::numeric > 0;

  SELECT coalesce(jsonb_object_agg(s, cnt), '{}'::jsonb)
  INTO v_status_breakdown
  FROM (
    SELECT status AS s, count(*) AS cnt
    FROM clips
    WHERE (p_range_start IS NULL OR created_at >= p_range_start)
    GROUP BY status
  ) sub;

  SELECT coalesce(jsonb_object_agg(t, cnt), '{}'::jsonb)
  INTO v_type_breakdown
  FROM (
    SELECT video_type AS t, count(*) AS cnt
    FROM clips
    WHERE (p_range_start IS NULL OR created_at >= p_range_start)
    GROUP BY video_type
  ) sub;

  SELECT coalesce(jsonb_object_agg(p, cnt), '{}'::jsonb)
  INTO v_platform_breakdown
  FROM (
    SELECT platform AS p, count(*) AS cnt
    FROM video_exports
    WHERE platform IS NOT NULL
    GROUP BY platform
  ) sub;

  SELECT coalesce(jsonb_agg(row_to_json(sub) ORDER BY sub.d), '[]'::jsonb)
  INTO v_daily_clips
  FROM (
    SELECT created_at::date::text AS d, count(*) AS count
    FROM clips
    WHERE (p_range_start IS NULL OR created_at >= p_range_start)
    GROUP BY created_at::date
    ORDER BY created_at::date
  ) sub;

  SELECT coalesce(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
  INTO v_top_clips
  FROM (
    SELECT id, topic, video_type, viral_score, created_at
    FROM clips
    WHERE (p_range_start IS NULL OR created_at >= p_range_start)
      AND viral_score IS NOT NULL
      AND (viral_score->>'overall')::numeric > 0
    ORDER BY (viral_score->>'overall')::numeric DESC
    LIMIT 5
  ) sub;

  RETURN jsonb_build_object(
    'totalClips', v_total_clips,
    'totalEpisodes', v_total_episodes,
    'totalExports', v_total_exports,
    'clipsInRange', v_clips_in_range,
    'previousClipsInRange', v_prev_clips,
    'episodesInRange', v_episodes_in_range,
    'exportsInRange', v_exports_in_range,
    'avgViralScore', v_avg_viral,
    'statusBreakdown', v_status_breakdown,
    'typeBreakdown', v_type_breakdown,
    'platformBreakdown', v_platform_breakdown,
    'dailyClips', v_daily_clips,
    'topClips', v_top_clips
  );
END;
$$;
