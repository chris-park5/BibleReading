-- Remove any legacy streak cap (e.g., 14-day max) by redefining the streak update logic.
-- This migration is idempotent and safe to run even if no cap currently exists.

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_current_streak_check;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_longest_streak_check;

CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_today DATE := CURRENT_DATE;
  v_last_active DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_new_streak INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT last_active_at, current_streak, longest_streak
  INTO v_last_active, v_current_streak, v_longest_streak
  FROM users
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Already updated today.
  IF v_last_active = v_today THEN
    RETURN;
  END IF;

  -- No cap: streak can grow without an upper bound.
  IF v_last_active = v_today - 1 THEN
    v_new_streak := COALESCE(v_current_streak, 0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  UPDATE users
  SET last_active_at = v_today,
      current_streak = v_new_streak,
      longest_streak = GREATEST(COALESCE(v_longest_streak, 0), v_new_streak)
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_streak() TO authenticated;
