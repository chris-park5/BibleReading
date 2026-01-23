-- Add longest_streak column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;

-- Update the function to handle longest_streak
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_last_active DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_today DATE := CURRENT_DATE;
  v_new_streak INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT last_active_at, current_streak, longest_streak
  INTO v_last_active, v_current_streak, v_longest_streak
  FROM users
  WHERE id = v_user_id;

  -- If no record found
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- If already active today, do nothing
  IF v_last_active = v_today THEN
    RETURN;
  END IF;

  -- Calculate new streak
  IF v_last_active = v_today - 1 THEN
    v_new_streak := v_current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Update users table
  UPDATE users
  SET last_active_at = v_today,
      current_streak = v_new_streak,
      longest_streak = GREATEST(v_longest_streak, v_new_streak)
  WHERE id = v_user_id;
END;
$$;
