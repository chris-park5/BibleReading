-- Align login streak date basis with client-local date when provided
-- and prevent first-day zero streak when last_active_at defaults to today.

CREATE OR REPLACE FUNCTION public.update_user_streak(p_today_local DATE DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_today DATE := COALESCE(p_today_local, CURRENT_DATE);
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

  -- If already updated today, still normalize first-day zero state.
  IF v_last_active = v_today THEN
    IF COALESCE(v_current_streak, 0) <= 0 THEN
      UPDATE users
      SET current_streak = 1,
          longest_streak = GREATEST(COALESCE(v_longest_streak, 0), 1)
      WHERE id = v_user_id;
    END IF;
    RETURN;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.update_user_streak(date) TO authenticated;
