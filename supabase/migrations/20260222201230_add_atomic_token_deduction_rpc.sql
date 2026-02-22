/*
  # Add atomic token deduction RPC

  1. New Functions
    - `atomic_deduct_tokens(p_user_id uuid, p_amount int)` - Atomically checks and deducts tokens in a single operation to prevent race conditions (TOCTOU)
  
  2. Security
    - Function executes as definer with security constraints
    - Validates the user has sufficient balance before deduction
*/

CREATE OR REPLACE FUNCTION atomic_deduct_tokens(p_user_id uuid, p_amount int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_monthly int;
  v_purchased int;
  v_used int;
  v_available int;
  v_from_monthly int;
  v_remaining int;
BEGIN
  SELECT monthly_tokens, purchased_tokens, used_this_month
  INTO v_monthly, v_purchased, v_used
  FROM token_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_available := v_monthly + v_purchased - v_used;
  IF v_available < p_amount THEN
    RETURN false;
  END IF;

  v_from_monthly := LEAST(v_monthly - v_used, p_amount);
  IF v_from_monthly < 0 THEN
    v_from_monthly := 0;
  END IF;
  v_remaining := p_amount - v_from_monthly;

  UPDATE token_balances
  SET
    used_this_month = v_used + v_from_monthly,
    purchased_tokens = v_purchased - v_remaining
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;
