-- ============================================
-- 12. Add Daily Reading Stats (Per Plan) & Increment RPC
-- ============================================

CREATE TABLE IF NOT EXISTS daily_reading_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_daily_reading_stats_per_plan UNIQUE (user_id, plan_id, date)
);

-- RLS Policies
ALTER TABLE daily_reading_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stats" ON daily_reading_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stats" ON daily_reading_stats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS tr_update_daily_stats_at ON daily_reading_stats;
CREATE TRIGGER tr_update_daily_stats_at
BEFORE UPDATE ON daily_reading_stats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RPC for atomic increment
CREATE OR REPLACE FUNCTION increment_daily_reading_stat(
  p_user_id UUID,
  p_plan_id UUID,
  p_date DATE,
  p_delta INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_reading_stats (user_id, plan_id, date, count)
  VALUES (p_user_id, p_plan_id, p_date, p_delta)
  ON CONFLICT (user_id, plan_id, date)
  DO UPDATE SET 
    count = daily_reading_stats.count + EXCLUDED.count,
    updated_at = NOW();
END;
$$;