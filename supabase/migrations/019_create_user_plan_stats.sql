-- ==============================================================================
-- 19. Optimize Stats with user_plan_stats table
-- ==============================================================================

-- 1. Add total_chapters to plans and presets (The Denominator)
ALTER TABLE preset_plans 
ADD COLUMN IF NOT EXISTS total_chapters INTEGER DEFAULT 0;

ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS total_chapters INTEGER DEFAULT 0;

-- 2. Create user_plan_stats table (The Numerator Cache)
CREATE TABLE IF NOT EXISTS user_plan_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  completed_chapters NUMERIC(10, 2) DEFAULT 0, -- Supports partial chapters
  last_read_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_user_plan_stats UNIQUE (user_id, plan_id)
);

-- 3. RLS Policies
ALTER TABLE user_plan_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan stats" ON user_plan_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends plan stats" ON user_plan_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
      AND (
        (f.user_id = auth.uid() AND f.friend_id = user_plan_stats.user_id) OR
        (f.friend_id = auth.uid() AND f.user_id = user_plan_stats.user_id)
      )
    )
  );

-- 4. Function to atomically update stats
CREATE OR REPLACE FUNCTION update_user_plan_stats(
  p_user_id UUID,
  p_plan_id UUID,
  p_delta NUMERIC,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_plan_stats (user_id, plan_id, completed_chapters, last_read_date, updated_at)
  VALUES (p_user_id, p_plan_id, p_delta, p_date, NOW())
  ON CONFLICT (user_id, plan_id)
  DO UPDATE SET
    completed_chapters = user_plan_stats.completed_chapters + EXCLUDED.completed_chapters,
    last_read_date = GREATEST(user_plan_stats.last_read_date, EXCLUDED.last_read_date),
    updated_at = NOW();
END;
$$;
