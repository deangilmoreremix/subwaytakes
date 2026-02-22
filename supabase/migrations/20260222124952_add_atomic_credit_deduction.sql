/*
  # Add atomic credit deduction function

  1. New Functions
    - `deduct_credits(p_user_id uuid, p_amount integer)` - Atomically deducts credits
      from a user's balance, returning true if successful, false if insufficient funds.
      Uses row-level locking to prevent race conditions with concurrent requests.

  2. Security
    - Function runs as SECURITY DEFINER to bypass RLS for the atomic update
    - Only callable by authenticated users
    - Checks that the requesting user matches the target user via auth.uid()
*/

CREATE OR REPLACE FUNCTION deduct_credits(p_user_id uuid, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;

  SELECT credits_balance INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN false;
  END IF;

  UPDATE user_profiles
  SET credits_balance = credits_balance - p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN true;
END;
$$;
