-- Add streak tracking columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_active_at DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;

-- Function to update streak
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
  v_today DATE := CURRENT_DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT last_active_at, current_streak
  INTO v_last_active, v_current_streak
  FROM users
  WHERE id = v_user_id;

  -- If no record found (should not happen for logged in user but safe check)
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- If already active today, do nothing
  IF v_last_active = v_today THEN
    RETURN;
  END IF;

  -- If active yesterday, increment streak
  IF v_last_active = v_today - 1 THEN
    UPDATE users
    SET last_active_at = v_today,
        current_streak = v_current_streak + 1
    WHERE id = v_user_id;
  ELSE
    -- Streak broken or first time
    UPDATE users
    SET last_active_at = v_today,
        current_streak = 1
    WHERE id = v_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_streak() TO authenticated;
