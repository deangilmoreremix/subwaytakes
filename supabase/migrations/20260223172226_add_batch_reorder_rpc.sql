/*
  # Add batch reorder RPC for compilation clips

  1. New Functions
    - `reorder_compilation_clips(p_compilation_id, p_ordered_clip_ids)` -
      atomically reorders all clips in a compilation in a single DB call
      instead of N individual UPDATE queries

  2. Security
    - Function checks that the calling user owns the compilation
    - Uses SECURITY DEFINER to bypass RLS for the batch update
*/

CREATE OR REPLACE FUNCTION reorder_compilation_clips(
  p_compilation_id uuid,
  p_ordered_clip_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM compilations WHERE id = p_compilation_id;
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR i IN 1..array_length(p_ordered_clip_ids, 1) LOOP
    UPDATE compilation_clips
    SET sequence = i
    WHERE compilation_id = p_compilation_id
      AND clip_id = p_ordered_clip_ids[i];
  END LOOP;
END;
$$;
